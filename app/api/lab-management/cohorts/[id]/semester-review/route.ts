import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GET /api/lab-management/cohorts/[id]/semester-review?semester=N
 *
 * Compares a cohort's lab templates (what was planned) against the
 * actual lab stations that ran (what happened). Returns four buckets:
 *
 *   covered     — template items that ran exactly once
 *   not_yet     — template items with zero actuals (the gap list)
 *   repeated    — template items that ran 2+ times
 *   additions   — actual stations that matched zero template items
 *
 * Used at end-of-semester template reviews (decide which deviations
 * become permanent template changes) and mid-semester (see what the
 * template still requires before semester end).
 *
 * Matching strategy (strongest first):
 *   1. Resolve both sides to skills.id via:
 *        template: fuzzy-match skills.name jsonb.name → skills.id
 *        actual:   station_skills.skill_id (primary)
 *                  lab_stations.skill_sheet_id → skill_sheets.canonical_skill_id
 *   2. Anything unresolved stays keyed by name and can only match by
 *      name equality / contains / Levenshtein <= 3.
 */

// ── Levenshtein (same implementation used by smc-completion) ──
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

function matchNameToSkill(
  name: string,
  catalog: Array<{ id: string; name: string }>
): { id: string; method: 'exact' | 'contains' | 'fuzzy' } | null {
  const n = name.trim().toLowerCase();
  for (const s of catalog) {
    if (s.name.toLowerCase() === n) return { id: s.id, method: 'exact' };
  }
  for (const s of catalog) {
    const sn = s.name.toLowerCase();
    if (sn.includes(n) || n.includes(sn))
      return { id: s.id, method: 'contains' };
  }
  for (const s of catalog) {
    if (s.name.length < 6 || n.length < 6) continue; // avoid short-string false matches
    if (levenshtein(n, s.name.toLowerCase()) <= 3) {
      return { id: s.id, method: 'fuzzy' };
    }
  }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const { id: cohortId } = await params;
    const supabase = getSupabaseAdmin();

    const sp = request.nextUrl.searchParams;
    const semesterParam = sp.get('semester');
    const semesterFilter =
      semesterParam && !isNaN(parseInt(semesterParam, 10))
        ? parseInt(semesterParam, 10)
        : null;

    // 1. Cohort + program
    const { data: cohort, error: cohortError } = await supabase
      .from('cohorts')
      .select(
        'id, cohort_number, current_semester, program:programs!cohorts_program_id_fkey(id, name, abbreviation)'
      )
      .eq('id', cohortId)
      .single();

    if (cohortError || !cohort) {
      return NextResponse.json(
        { success: false, error: 'Cohort not found' },
        { status: 404 }
      );
    }

    const program = cohort.program as any;
    const effectiveSemester =
      semesterFilter !== null ? semesterFilter : cohort.current_semester ?? 1;

    // The lab_day_templates.program column stores lowercase values
    // ('emt', 'aemt', 'paramedic') — distinct from programs.abbreviation
    // ('EMT', 'AEMT', 'PM'). Map both directions here.
    const abbr = (program?.abbreviation || '').toUpperCase();
    let templateProgramKey = '';
    if (abbr === 'EMT') templateProgramKey = 'emt';
    else if (abbr === 'AEMT') templateProgramKey = 'aemt';
    else if (abbr === 'PM' || abbr === 'PMD') templateProgramKey = 'paramedic';

    // 2. Load skills catalog (for name → skill_id resolution)
    const { data: skillsRows } = await supabase
      .from('skills')
      .select('id, name, category')
      .eq('is_active', true);
    const catalog = skillsRows || [];

    // 3. Load templates for this program + semester and their stations.
    //    skills jsonb on each station lists required skills by name.
    const { data: templates } = await supabase
      .from('lab_day_templates')
      .select('id, template_number, program, semester')
      .eq('program', templateProgramKey)
      .eq('semester', effectiveSemester);

    const templateIds = (templates || []).map((t) => t.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let templateStations: any[] = [];
    if (templateIds.length > 0) {
      const { data } = await supabase
        .from('lab_template_stations')
        .select(
          'id, template_id, station_name, station_type, scenario_title, skills'
        )
        .in('template_id', templateIds);
      templateStations = data || [];
    }

    // 4. Aggregate template items. One logical "item" per distinct
    //    skill name across all template stations. Extra station_name
    //    entries (no skills jsonb) become fallback name-keyed items.
    type TemplateItem = {
      name: string;
      skill_id: string | null;
      category: string | null;
      min_attempts: number;
      platinum_skill: boolean;
      template_number: number | null;
      match_method: 'exact' | 'contains' | 'fuzzy' | 'none';
    };
    const templateItemByKey = new Map<string, TemplateItem>();
    const templateNumberById: Record<string, number | null> = {};
    for (const t of templates || []) {
      templateNumberById[t.id] = t.template_number ?? null;
    }

    for (const ts of templateStations) {
      const templateNumber = templateNumberById[ts.template_id] ?? null;
      const skills = Array.isArray(ts.skills) ? ts.skills : [];
      for (const sk of skills) {
        if (!sk || typeof sk !== 'object') continue;
        const name = String(sk.name || '').trim();
        if (!name) continue;
        const match = matchNameToSkill(name, catalog);
        const key = match ? `id:${match.id}` : `name:${name.toLowerCase()}`;
        const existing = templateItemByKey.get(key);
        if (existing) {
          existing.min_attempts = Math.max(
            existing.min_attempts,
            Number(sk.min_attempts) || 1
          );
          existing.platinum_skill = existing.platinum_skill || !!sk.platinum_skill;
          // Earliest template_number wins for "scheduled week" hint
          if (
            templateNumber != null &&
            (existing.template_number == null ||
              templateNumber < existing.template_number)
          ) {
            existing.template_number = templateNumber;
          }
        } else {
          templateItemByKey.set(key, {
            name,
            skill_id: match?.id ?? null,
            category: null,
            min_attempts: Number(sk.min_attempts) || 1,
            platinum_skill: !!sk.platinum_skill,
            template_number: templateNumber,
            match_method: match?.method ?? 'none',
          });
        }
      }
    }

    // 5. Load actual lab days + stations for this cohort+semester.
    const { data: labDays } = await supabase
      .from('lab_days')
      .select('id, date, week_number, day_number, title')
      .eq('cohort_id', cohortId)
      .eq('semester', effectiveSemester);

    const labDayIds = (labDays || []).map((ld) => ld.id);
    const labDayById = new Map<string, any>();
    for (const ld of labDays || []) labDayById.set(ld.id, ld);

    type ActualStation = {
      id: string;
      lab_day_id: string;
      date: string;
      week_number: number | null;
      custom_title: string | null;
      skill_sheet_id: string | null;
      // Resolved skills.id — either via station_skills, or via
      // skill_sheets.canonical_skill_id, or via name fuzzy match.
      resolved_skill_id: string | null;
      resolved_skill_name: string | null;
      resolved_via: 'station_skills' | 'skill_sheet' | 'fuzzy' | 'none';
    };
    let actualStations: ActualStation[] = [];

    if (labDayIds.length > 0) {
      const { data: labStations } = await supabase
        .from('lab_stations')
        .select('id, lab_day_id, custom_title, skill_name, skill_sheet_id')
        .in('lab_day_id', labDayIds);

      const stationIds = (labStations || []).map((s) => s.id);

      // station_skills → skill_id
      const stationSkillIdMap = new Map<string, string>();
      if (stationIds.length > 0) {
        const { data: stationSkills } = await supabase
          .from('station_skills')
          .select('station_id, skill_id')
          .in('station_id', stationIds);
        for (const ss of stationSkills || []) {
          if (ss.skill_id && !stationSkillIdMap.has(ss.station_id)) {
            stationSkillIdMap.set(ss.station_id, ss.skill_id);
          }
        }
      }

      // skill_sheets.canonical_skill_id — for stations that only have
      // skill_sheet_id (typed column, mostly NREMT sheets).
      const sheetIds = Array.from(
        new Set(
          (labStations || [])
            .map((s) => s.skill_sheet_id)
            .filter((x): x is string => !!x)
        )
      );
      const sheetToCanonical = new Map<string, string | null>();
      const sheetNameById = new Map<string, string | null>();
      if (sheetIds.length > 0) {
        const { data: sheets } = await supabase
          .from('skill_sheets')
          .select('id, canonical_skill_id, skill_name')
          .in('id', sheetIds);
        for (const sh of sheets || []) {
          sheetToCanonical.set(sh.id, sh.canonical_skill_id || null);
          sheetNameById.set(sh.id, sh.skill_name || null);
        }
      }

      // Catalog-name lookup for "resolved_skill_name" population
      const nameBySkillId = new Map<string, string>();
      for (const s of catalog) nameBySkillId.set(s.id, s.name);

      for (const st of labStations || []) {
        const ld = labDayById.get(st.lab_day_id);
        if (!ld) continue;

        let resolvedId: string | null = null;
        let resolvedVia: ActualStation['resolved_via'] = 'none';
        const stationSkillId = stationSkillIdMap.get(st.id);
        if (stationSkillId) {
          resolvedId = stationSkillId;
          resolvedVia = 'station_skills';
        } else if (st.skill_sheet_id) {
          const canonical = sheetToCanonical.get(st.skill_sheet_id);
          if (canonical) {
            resolvedId = canonical;
            resolvedVia = 'skill_sheet';
          }
        }

        // If still unresolved, try fuzzy match on custom_title against
        // catalog. Reserved for the long tail of free-text stations.
        if (!resolvedId) {
          const title = st.custom_title || st.skill_name || '';
          if (title) {
            const m = matchNameToSkill(title, catalog);
            if (m) {
              resolvedId = m.id;
              resolvedVia = 'fuzzy';
            }
          }
        }

        actualStations.push({
          id: st.id,
          lab_day_id: st.lab_day_id,
          date: ld.date,
          week_number: ld.week_number ?? null,
          custom_title: st.custom_title ?? null,
          skill_sheet_id: st.skill_sheet_id ?? null,
          resolved_skill_id: resolvedId,
          resolved_skill_name:
            (resolvedId && nameBySkillId.get(resolvedId)) ||
            (st.skill_sheet_id && sheetNameById.get(st.skill_sheet_id)) ||
            st.custom_title ||
            st.skill_name ||
            null,
          resolved_via: resolvedVia,
        });
      }
    }
    // Discard any stations we couldn't key
    actualStations = actualStations.filter(Boolean);

    // 6. Build the four buckets.
    type Bucket = {
      name: string;
      skill_id: string | null;
      min_attempts?: number;
      platinum_skill?: boolean;
      template_number?: number | null;
      match_method?: TemplateItem['match_method'];
      runs: Array<{
        station_id: string;
        lab_day_id: string;
        date: string;
        week_number: number | null;
        custom_title: string | null;
        resolved_via: string;
      }>;
    };
    const covered: Bucket[] = [];
    const notYet: Bucket[] = [];
    const repeated: Bucket[] = [];

    // Map actuals by skill_id for fast lookup
    const actualsBySkillId = new Map<string, ActualStation[]>();
    for (const a of actualStations) {
      if (!a.resolved_skill_id) continue;
      const arr = actualsBySkillId.get(a.resolved_skill_id) || [];
      arr.push(a);
      actualsBySkillId.set(a.resolved_skill_id, arr);
    }

    // Track which actuals matched a template item — anything left
    // becomes an "addition".
    const matchedActualIds = new Set<string>();

    for (const item of templateItemByKey.values()) {
      let runs: ActualStation[] = [];
      if (item.skill_id) {
        runs = actualsBySkillId.get(item.skill_id) || [];
      } else {
        // Name-only item — match actuals by name fuzzy
        const want = item.name.toLowerCase();
        for (const a of actualStations) {
          const title = (a.custom_title || '').toLowerCase();
          if (!title) continue;
          if (title === want || title.includes(want) || want.includes(title)) {
            runs.push(a);
            continue;
          }
          if (title.length >= 6 && want.length >= 6) {
            if (levenshtein(title, want) <= 3) runs.push(a);
          }
        }
      }

      for (const r of runs) matchedActualIds.add(r.id);

      const bucket: Bucket = {
        name: item.name,
        skill_id: item.skill_id,
        min_attempts: item.min_attempts,
        platinum_skill: item.platinum_skill,
        template_number: item.template_number,
        match_method: item.match_method,
        runs: runs.map((r) => ({
          station_id: r.id,
          lab_day_id: r.lab_day_id,
          date: r.date,
          week_number: r.week_number,
          custom_title: r.custom_title,
          resolved_via: r.resolved_via,
        })),
      };

      if (runs.length === 0) {
        notYet.push(bucket);
      } else if (runs.length >= 2) {
        repeated.push(bucket);
      } else {
        covered.push(bucket);
      }
    }

    // 7. Additions — actuals that didn't match any template item.
    const additions = actualStations
      .filter((a) => !matchedActualIds.has(a.id))
      .map((a) => ({
        station_id: a.id,
        lab_day_id: a.lab_day_id,
        date: a.date,
        week_number: a.week_number,
        name: a.resolved_skill_name || a.custom_title || '(untitled station)',
        custom_title: a.custom_title,
        resolved_skill_id: a.resolved_skill_id,
        resolved_via: a.resolved_via,
      }));

    // Sort buckets for display consistency:
    //   not_yet: scheduled week asc (most overdue first), then name
    //   covered / repeated: by name
    //   additions: by date desc (newest first)
    notYet.sort((a, b) => {
      const aw = a.template_number ?? 999;
      const bw = b.template_number ?? 999;
      if (aw !== bw) return aw - bw;
      return a.name.localeCompare(b.name);
    });
    covered.sort((a, b) => a.name.localeCompare(b.name));
    repeated.sort((a, b) => a.name.localeCompare(b.name));
    additions.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    return NextResponse.json({
      success: true,
      cohort: {
        id: cohort.id,
        cohort_number: cohort.cohort_number,
        current_semester: cohort.current_semester,
        program_abbr: abbr,
      },
      semester: effectiveSemester,
      template_count: (templates || []).length,
      template_station_count: templateStations.length,
      actual_lab_day_count: labDayIds.length,
      actual_station_count: actualStations.length,
      buckets: { covered, not_yet: notYet, repeated, additions },
    });
  } catch (error) {
    console.error('[semester-review] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load semester review' },
      { status: 500 }
    );
  }
}
