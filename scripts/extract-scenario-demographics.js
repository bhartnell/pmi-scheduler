#!/usr/bin/env node
// Direct-DB equivalent of /api/admin/scenarios/extract-demographics.
// Mirrors the endpoint exactly so we don't have to wait on Vercel
// deploys to land before the operator can run the bulk extraction.
//
// Defaults to DRY RUN. Pass --apply to actually write.
// Pass --limit N to cap how many scenarios get processed (useful
// for sampling 1-3 first to validate the prompt before running on
// all 56).

const fs = require('fs');
const path = require('path');

try {
  const envPath = path.join(__dirname, '..', '.env.local');
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i > 0) process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
  }
} catch {}

const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk').default;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const APPLY = process.argv.includes('--apply');
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit');
  if (i === -1) return null;
  const n = parseInt(process.argv[i + 1], 10);
  return Number.isFinite(n) ? n : null;
})();

function nullEmpty(s) {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  return t.length === 0 ? null : t;
}
function isEmpty(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

function buildPrompt(title, presentation) {
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
  medical_history  : array of conditions as bullet items.
                     Empty array if "no PMHx" / "none reported".
                     null if not mentioned at all.
  medications      : array of medication names + dosages where given.
                     Empty array for "none".
                     null if not mentioned.
  allergies        : free-text string ("NKDA", "Penicillin, sulfa").
                     null if not mentioned.

Strict rules:
- Do NOT invent values. If unstated, return null.
- Do NOT include hospital course, vitals, or assessment findings.
- Output strictly JSON with these exact keys, no extra fields.`;
}

(async () => {
  console.log(`Mode: ${APPLY ? 'APPLY (will write)' : 'DRY RUN'}`);
  if (LIMIT) console.log(`Limit: ${LIMIT}`);

  const { data: scenarios, error } = await supabase
    .from('scenarios')
    .select(
      'id, title, patient_presentation, chief_complaint, patient_name, patient_age, patient_sex, patient_weight, medical_history, medications, allergies'
    )
    .eq('is_active', true)
    .is('chief_complaint', null)
    .not('patient_presentation', 'is', null);
  if (error) {
    console.error('Fetch failed:', error.message);
    process.exit(1);
  }

  const list = LIMIT ? scenarios.slice(0, LIMIT) : scenarios;
  console.log(`\nProcessing ${list.length} scenarios (of ${scenarios.length} eligible)...\n`);

  let totalApplied = 0, totalChanged = 0, totalErrors = 0;

  for (const sc of list) {
    const presentation = sc.patient_presentation;
    if (!presentation || presentation.trim().length < 30) {
      console.log(`SKIP ${sc.id.slice(0, 8)} · "${sc.title.slice(0, 50)}" · presentation too short`);
      continue;
    }

    let extracted;
    try {
      const m = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: buildPrompt(sc.title, presentation) }],
      });
      const text = m.content.find(c => c.type === 'text');
      if (!text) throw new Error('No text in response');
      let raw = text.text.trim();
      if (raw.startsWith('```json')) raw = raw.slice(7);
      else if (raw.startsWith('```')) raw = raw.slice(3);
      if (raw.endsWith('```')) raw = raw.slice(0, -3);
      extracted = JSON.parse(raw.trim());
    } catch (err) {
      totalErrors++;
      console.log(`ERR  ${sc.id.slice(0, 8)} · "${sc.title.slice(0, 50)}" · ${err.message}`);
      await new Promise(r => setTimeout(r, 600));
      continue;
    }

    const patch = {};
    const filled = [];
    const fill = (col, cur, val, valid = () => true) => {
      if (!isEmpty(cur)) return;
      if (val === null || val === undefined) return;
      if (!valid(val)) return;
      patch[col] = val;
      filled.push(col);
    };

    fill('chief_complaint', sc.chief_complaint, nullEmpty(extracted.chief_complaint));
    fill('patient_name', sc.patient_name, nullEmpty(extracted.patient_name));
    fill(
      'patient_age',
      sc.patient_age,
      typeof extracted.patient_age === 'number' && Number.isFinite(extracted.patient_age)
        ? Math.floor(extracted.patient_age)
        : null
    );
    fill(
      'patient_sex',
      sc.patient_sex,
      ['male', 'female', 'other'].includes(extracted.patient_sex) ? extracted.patient_sex : null
    );
    fill('patient_weight', sc.patient_weight, nullEmpty(extracted.patient_weight));
    fill(
      'medical_history',
      sc.medical_history,
      Array.isArray(extracted.medical_history) ? extracted.medical_history : null
    );
    fill(
      'medications',
      sc.medications,
      Array.isArray(extracted.medications) ? extracted.medications : null
    );
    fill('allergies', sc.allergies, nullEmpty(extracted.allergies));

    if (filled.length === 0) {
      console.log(`SKIP ${sc.id.slice(0, 8)} · "${sc.title.slice(0, 50)}" · nothing extractable`);
      await new Promise(r => setTimeout(r, 600));
      continue;
    }

    totalChanged++;

    if (APPLY) {
      const { error: uErr } = await supabase.from('scenarios').update(patch).eq('id', sc.id);
      if (uErr) {
        totalErrors++;
        console.log(`UPDF ${sc.id.slice(0, 8)} · ${uErr.message}`);
      } else {
        totalApplied++;
        console.log(`OK   ${sc.id.slice(0, 8)} · "${sc.title.slice(0, 50)}" · ${filled.join(', ')}`);
      }
    } else {
      console.log(`DRY  ${sc.id.slice(0, 8)} · "${sc.title.slice(0, 50)}" · would fill: ${filled.join(', ')}`);
    }

    await new Promise(r => setTimeout(r, 600));
  }

  console.log(`\n──── SUMMARY ────`);
  console.log(`Total checked: ${list.length}`);
  console.log(`Total with changes: ${totalChanged}`);
  console.log(`Total applied: ${totalApplied}`);
  console.log(`Total errors: ${totalErrors}`);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
