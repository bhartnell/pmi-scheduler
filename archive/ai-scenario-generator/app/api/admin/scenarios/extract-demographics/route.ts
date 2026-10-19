import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';

/**
 * POST /api/admin/scenarios/extract-demographics
 *
 * Bulk-fills demographic + history fields on scenarios where the
 * original import dumped everything into patient_presentation as a
 * prose block. Targets scenarios with chief_complaint IS NULL
 * (configurable via body) and uses Claude to extract structured
 * fields back out of the prose:
 *
 *   chief_complaint    text
 *   patient_name       text
 *   patient_age        integer
 *   patient_sex        'male' | 'female' | 'other' | null
 *   patient_weight     text  (e.g. "85 kg" or "187 lbs")
 *   medical_history    text[]
 *   medications        text[]
 *   allergies          text  (free-form, "NKDA" / "PCN, sulfa" / ...)
 *
 * Body:
 *   {
 *     scenario_ids?: string[],   // optional — limit to specific rows
 *     dry_run?: boolean          // default true; defensive
 *   }
 *
 * Response:
 *   {
 *     total_checked, total_with_changes, total_applied, total_errors,
 *     changelog: [{ scenario_id, title, fields_filled[], errors[] }],
 *   }
 *
 * Cost: one Claude call per scenario. Paced at 600ms gaps to stay
 * under per-minute Anthropic limits and to be friendly to billing.
 *
 * Idempotent: only fills fields that are currently null/empty.
 * Existing values are never overwritten.
 */

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1024;
const PACING_MS = 200;
const DEFAULT_LIMIT = 15;     // safe under 60s maxDuration
const HARD_LIMIT = 50;        // cap caller-supplied limit defensively

// Vercel function timeout — Anthropic responses average 2-3s
// each; with PACING_MS=200 we can process ~15-20 scenarios per
// run before risking a function timeout. Caller invokes the
// endpoint repeatedly in chunks via the limit body param.
export const maxDuration = 60;

// Trim helper for nullable strings.
function nullEmpty(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  return t.length === 0 ? null : t;
}

function isEmpty(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === 'string' && val.trim() === '') return true;
  if (Array.isArray(val) && val.length === 0) return true;
  return false;
}

interface ExtractedDemographics {
  chief_complaint?: string | null;
  patient_name?: string | null;
  patient_age?: number | null;
  patient_sex?: 'male' | 'female' | 'other' | null;
  patient_weight?: string | null;
  medical_history?: string[] | null;
  medications?: string[] | null;
  allergies?: string | null;
}

function buildPrompt(title: string, presentation: string): string {
  return `You are extracting structured demographic and history fields
from an EMS scenario's prose presentation block. Return ONLY a JSON
object — no markdown, no commentary.

Scenario title: ${title}

Patient presentation prose:
"""
${presentation}
"""

Extract these fields where the prose explicitly states them. Use
null for any field NOT clearly present:

  chief_complaint  : short imperative phrase (e.g. "Central chest pain radiating to left arm").
  patient_name     : full name as written, or null.
  patient_age      : integer years (convert "6 months" → 0, "newborn" → 0).
  patient_sex      : "male" | "female" | "other" — null if unstated.
  patient_weight   : as written ("85 kg", "187 lbs", "70 kg / 154 lbs").
  medical_history  : array of conditions as bullet items (["HTN", "Type 2 diabetes"]).
                     Empty array if "no PMHx" / "none reported".
                     null if not mentioned at all.
  medications      : array of medication names + dosages where given
                     (["Metoprolol 50 mg PO BID", "ASA 81 mg PO QD"]).
                     Empty array for "none".
                     null if not mentioned.
  allergies        : free-text string (e.g. "NKDA", "Penicillin, sulfa drugs").
                     null if not mentioned.

Strict rules:
- Do NOT invent values. If unstated, return null.
- Do NOT include hospital course, vitals, or assessment findings.
- Output strictly JSON with these exact keys, no extra fields.`;
}

export async function POST(request: NextRequest) {
  // Top-level try/catch — without this, ANY unexpected throw
  // (supabase error, JSON parse, network blip) returns a blank
  // 500 with no body. Operator gets nothing actionable.
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'ANTHROPIC_API_KEY is not configured in Vercel environment variables',
          fix: 'Add ANTHROPIC_API_KEY to Vercel project settings → Environment Variables, then redeploy.',
        },
        { status: 500 }
      );
    }

    let body: { scenario_ids?: string[]; dry_run?: boolean; limit?: number } = {};
    try {
      body = await request.json();
    } catch {
      /* empty body OK */
    }
    const dryRun = body.dry_run !== false; // DEFAULT TRUE
    const limit = Math.min(
      Math.max(1, typeof body.limit === 'number' ? body.limit : DEFAULT_LIMIT),
      HARD_LIMIT
    );

    const supabase = getSupabaseAdmin();

    // Fetch target rows. Either the explicit list or every scenario
    // missing chief_complaint AND with patient_presentation prose.
    // Order by id for stable pagination across batches.
    let q = supabase
      .from('scenarios')
      .select(
        'id, title, patient_presentation, chief_complaint, patient_name, patient_age, patient_sex, patient_weight, medical_history, medications, allergies'
      )
      .eq('is_active', true)
      .not('patient_presentation', 'is', null)
      .order('id', { ascending: true });
    if (body.scenario_ids && body.scenario_ids.length > 0) {
      q = q.in('id', body.scenario_ids);
    } else {
      q = q.is('chief_complaint', null);
    }

    const { data: allEligible, error: sErr } = await q;
    if (sErr) {
      return NextResponse.json({ success: false, error: sErr.message }, { status: 500 });
    }
    const totalEligible = (allEligible ?? []).length;
    // Process at most `limit` scenarios per call. Caller invokes
    // again to chase the remaining ones — keeps each request well
    // under Vercel's 60s function timeout.
    const scenarios = (allEligible ?? []).slice(0, limit);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const changelog: Array<{
    scenario_id: string;
    title: string;
    fields_filled: string[];
    raw_extracted?: ExtractedDemographics;
    errors: string[];
  }> = [];
  let totalApplied = 0;
  let totalWithChanges = 0;
  let totalErrors = 0;

  for (const sc of scenarios ?? []) {
    const presentation = sc.patient_presentation as string | null;
    if (!presentation || presentation.trim().length < 30) {
      changelog.push({
        scenario_id: sc.id as string,
        title: sc.title as string,
        fields_filled: [],
        errors: ['patient_presentation too short or empty'],
      });
      continue;
    }

    let extracted: ExtractedDemographics;
    try {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: buildPrompt(sc.title as string, presentation) }],
      });
      const text = message.content.find(c => c.type === 'text');
      if (!text || text.type !== 'text') throw new Error('No text in AI response');

      let raw = text.text.trim();
      if (raw.startsWith('```json')) raw = raw.slice(7);
      else if (raw.startsWith('```')) raw = raw.slice(3);
      if (raw.endsWith('```')) raw = raw.slice(0, -3);
      raw = raw.trim();
      extracted = JSON.parse(raw);
    } catch (err) {
      totalErrors++;
      changelog.push({
        scenario_id: sc.id as string,
        title: sc.title as string,
        fields_filled: [],
        errors: [`AI extraction failed: ${err instanceof Error ? err.message : String(err)}`],
      });
      await new Promise(r => setTimeout(r, PACING_MS));
      continue;
    }

    // Build the patch — only fill fields currently empty.
    const patch: Record<string, unknown> = {};
    const fieldsFilled: string[] = [];

    const tryFill = (
      column: string,
      currentVal: unknown,
      newVal: unknown,
      validate: (v: unknown) => boolean = () => true
    ) => {
      if (!isEmpty(currentVal)) return;        // existing value wins
      if (newVal === null || newVal === undefined) return;
      if (!validate(newVal)) return;
      patch[column] = newVal;
      fieldsFilled.push(column);
    };

    tryFill('chief_complaint', sc.chief_complaint, nullEmpty(extracted.chief_complaint));
    tryFill('patient_name', sc.patient_name, nullEmpty(extracted.patient_name));
    tryFill(
      'patient_age',
      sc.patient_age,
      typeof extracted.patient_age === 'number' && Number.isFinite(extracted.patient_age)
        ? Math.floor(extracted.patient_age)
        : null
    );
    tryFill(
      'patient_sex',
      sc.patient_sex,
      ['male', 'female', 'other'].includes(extracted.patient_sex as string)
        ? extracted.patient_sex
        : null
    );
    tryFill('patient_weight', sc.patient_weight, nullEmpty(extracted.patient_weight));
    tryFill(
      'medical_history',
      sc.medical_history,
      Array.isArray(extracted.medical_history) ? extracted.medical_history : null
    );
    tryFill(
      'medications',
      sc.medications,
      Array.isArray(extracted.medications) ? extracted.medications : null
    );
    tryFill('allergies', sc.allergies, nullEmpty(extracted.allergies));

    if (fieldsFilled.length === 0) {
      changelog.push({
        scenario_id: sc.id as string,
        title: sc.title as string,
        fields_filled: [],
        raw_extracted: extracted,
        errors: [],
      });
      await new Promise(r => setTimeout(r, PACING_MS));
      continue;
    }

    totalWithChanges++;

    if (!dryRun) {
      const { error: uErr } = await supabase
        .from('scenarios')
        .update(patch)
        .eq('id', sc.id);
      if (uErr) {
        totalErrors++;
        changelog.push({
          scenario_id: sc.id as string,
          title: sc.title as string,
          fields_filled: [],
          raw_extracted: extracted,
          errors: [`UPDATE failed: ${uErr.message}`],
        });
      } else {
        totalApplied++;
        changelog.push({
          scenario_id: sc.id as string,
          title: sc.title as string,
          fields_filled: fieldsFilled,
          errors: [],
        });
      }
    } else {
      changelog.push({
        scenario_id: sc.id as string,
        title: sc.title as string,
        fields_filled: fieldsFilled,
        raw_extracted: extracted,
        errors: [],
      });
    }

      await new Promise(r => setTimeout(r, PACING_MS));
    }

    return NextResponse.json({
      success: true,
      dry_run: dryRun,
      total_checked: scenarios.length,
      total_eligible: totalEligible,
      remaining_count: Math.max(0, totalEligible - scenarios.length),
      total_with_changes: totalWithChanges,
      total_applied: totalApplied,
      total_errors: totalErrors,
      changelog,
    });
  } catch (err) {
    // Top-level catch — surfaces actionable error info to the
    // operator instead of a blank 500. Logs full stack to Vercel
    // function logs for post-mortem.
    console.error('[extract-demographics] unhandled error:', err);
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack?.split('\n').slice(0, 5).join('\n') : undefined;
    return NextResponse.json(
      {
        success: false,
        error: `Extraction failed: ${msg}`,
        stack: process.env.NODE_ENV !== 'production' ? stack : undefined,
      },
      { status: 500 }
    );
  }
}
