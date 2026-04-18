import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GET /api/lab-management/smc-admin/suggest-matches
 *
 * For every unlinked SMC requirement (skill_id IS NULL), returns the top
 * candidate matches from the skills catalog. The UI uses this to power
 * the "Auto-link suggestions" bulk action: admin reviews each and clicks
 * confirm/reject/skip.
 *
 * Returns up to 3 candidates per row, scored by:
 *   - exact (ci) match            → confidence 1.0
 *   - one contains the other (ci) → 0.7 – 0.9 depending on length ratio
 *   - Levenshtein distance <= 4   → 0.3 – 0.6 depending on distance
 *
 * Optional query params:
 *   program_id, semester — scope the suggestions
 *   min_confidence       — float 0-1 filter (default 0.3)
 */

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m: number[][] = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        m[i][j] = m[i - 1][j - 1];
      } else {
        m[i][j] = Math.min(
          m[i - 1][j - 1] + 1,
          m[i][j - 1] + 1,
          m[i - 1][j] + 1
        );
      }
    }
  }
  return m[b.length][a.length];
}

type Candidate = {
  skill_id: string;
  skill_name: string;
  category: string | null;
  confidence: number;
  method: 'exact' | 'contains' | 'fuzzy';
};

function scoreCandidates(smcName: string, catalog: any[]): Candidate[] {
  const n = smcName.trim().toLowerCase();
  const out: Candidate[] = [];

  for (const s of catalog) {
    const sn = (s.name || '').toLowerCase();
    if (!sn) continue;

    if (sn === n) {
      out.push({
        skill_id: s.id,
        skill_name: s.name,
        category: s.category,
        confidence: 1.0,
        method: 'exact',
      });
      continue;
    }

    if (sn.includes(n) || n.includes(sn)) {
      // Score by length ratio: closer lengths = higher confidence
      const minLen = Math.min(sn.length, n.length);
      const maxLen = Math.max(sn.length, n.length);
      const ratio = minLen / maxLen;
      out.push({
        skill_id: s.id,
        skill_name: s.name,
        category: s.category,
        confidence: 0.7 + ratio * 0.2, // 0.7 – 0.9
        method: 'contains',
      });
      continue;
    }

    // Fuzzy only on non-trivial strings to avoid 3-letter false matches
    if (sn.length >= 6 && n.length >= 6) {
      const d = levenshtein(sn, n);
      if (d <= 4) {
        // 0 → 0.6, 1 → 0.525, 2 → 0.45, 3 → 0.375, 4 → 0.3
        const confidence = Math.max(0.3, 0.6 - d * 0.075);
        out.push({
          skill_id: s.id,
          skill_name: s.name,
          category: s.category,
          confidence,
          method: 'fuzzy',
        });
      }
    }
  }

  out.sort((a, b) => b.confidence - a.confidence);
  return out.slice(0, 3);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('lead_instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const sp = request.nextUrl.searchParams;
    const programId = sp.get('program_id');
    const semesterParam = sp.get('semester');
    const semester =
      semesterParam && !isNaN(parseInt(semesterParam, 10))
        ? parseInt(semesterParam, 10)
        : null;
    const minConfidence = parseFloat(sp.get('min_confidence') || '0.3');

    let rowsQuery = supabase
      .from('smc_requirements')
      .select('id, program_id, semester, skill_name, category')
      .is('skill_id', null)
      .eq('is_active', true);
    if (programId) rowsQuery = rowsQuery.eq('program_id', programId);
    if (semester !== null) rowsQuery = rowsQuery.eq('semester', semester);

    const [{ data: rows, error: rowsError }, { data: skills, error: skillsError }] =
      await Promise.all([
        rowsQuery,
        supabase
          .from('skills')
          .select('id, name, category')
          .eq('is_active', true),
      ]);

    if (rowsError || skillsError) {
      console.error('[smc-admin/suggest] error:', rowsError || skillsError);
      return NextResponse.json(
        { success: false, error: 'Failed to load data' },
        { status: 500 }
      );
    }

    const suggestions = (rows || []).map((r) => {
      const candidates = scoreCandidates(r.skill_name, skills || []).filter(
        (c) => c.confidence >= minConfidence
      );
      return {
        smc_id: r.id,
        program_id: r.program_id,
        semester: r.semester,
        skill_name: r.skill_name,
        category: r.category,
        candidates,
        top_candidate: candidates[0] || null,
      };
    });

    // Summary counts for the UI (e.g. "12 high-confidence suggestions")
    const highConfidence = suggestions.filter(
      (s) => s.top_candidate && s.top_candidate.confidence >= 0.9
    ).length;
    const mediumConfidence = suggestions.filter(
      (s) =>
        s.top_candidate &&
        s.top_candidate.confidence >= 0.6 &&
        s.top_candidate.confidence < 0.9
    ).length;
    const lowConfidence = suggestions.filter(
      (s) =>
        s.top_candidate &&
        s.top_candidate.confidence < 0.6
    ).length;
    const noSuggestions = suggestions.filter(
      (s) => !s.top_candidate
    ).length;

    return NextResponse.json({
      success: true,
      suggestions,
      summary: {
        total_unlinked: suggestions.length,
        high_confidence: highConfidence,
        medium_confidence: mediumConfidence,
        low_confidence: lowConfidence,
        no_suggestions: noSuggestions,
      },
    });
  } catch (e) {
    console.error('[smc-admin/suggest] error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
