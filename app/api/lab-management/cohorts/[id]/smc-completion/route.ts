import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GET /api/lab-management/cohorts/[id]/smc-completion?semester=N
 *
 * Returns SMC (Student Minimum Competency) completion status for a cohort.
 * For each SMC requirement defined on the cohort's program+semester:
 *   - covered: boolean — has it been run at least once?
 *   - lab_day_count: how many lab days covered this skill
 *   - first_covered_date / last_run_date
 *   - attempts_vs_required: progress toward min_attempts
 *   - match_method: how the match was found
 *       'station_skills' (strong): station_skills.skill_id matches SMC skill_id
 *       'title_exact' (strong): station custom_title exactly matches SMC name
 *       'title_contains' (medium): one contains the other (ci)
 *       'title_fuzzy' (weak): Levenshtein distance <= 3
 *       null: not yet covered
 *
 * Answers the primary question: "Which SMC skills have been covered
 * this semester and which still need to happen before semester end?"
 */

type MatchMethod =
  | 'station_skills'
  | 'title_exact'
  | 'title_contains'
  | 'title_fuzzy'
  | null;

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const { id: cohortId } = await params;
    const supabase = getSupabaseAdmin();

    const semesterParam = request.nextUrl.searchParams.get('semester');
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

    // 2. SMC requirements for this program+semester.
    // week_number + sim_permitted added 2026-04-18 for the authoritative
    // EMT/AEMT seeds — EMT SMC is week-ordered, AEMT lists sim-permitted
    // CoAEMSP skills. Both are optional/nullable on Paramedic rows.
    const { data: smcRows, error: smcError } = await supabase
      .from('smc_requirements')
      .select('id, skill_id, skill_name, category, min_attempts, is_platinum, sim_permitted, week_number, display_order')
      .eq('program_id', program?.id)
      .eq('semester', effectiveSemester)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (smcError) {
      console.error('[smc-completion] SMC query error:', smcError);
      return NextResponse.json(
        { success: false, error: 'Failed to load SMC requirements' },
        { status: 500 }
      );
    }

    // 3. Lab days + stations for this cohort in this semester
    const { data: labDays } = await supabase
      .from('lab_days')
      .select('id, date, week_number, day_number')
      .eq('cohort_id', cohortId)
      .eq('semester', effectiveSemester);

    const labDayIds = (labDays || []).map((ld) => ld.id);
    const labDayById = new Map<string, any>();
    for (const ld of labDays || []) labDayById.set(ld.id, ld);

    type StationCoverage = {
      date: string;
      lab_day_id: string;
      week_number: number | null;
      custom_title: string | null;
      station_skill_ids: Set<string>; // skill_ids linked via station_skills
    };
    const stations: StationCoverage[] = [];

    if (labDayIds.length > 0) {
      const { data: labStations } = await supabase
        .from('lab_stations')
        .select('id, lab_day_id, custom_title')
        .in('lab_day_id', labDayIds);

      const stationById = new Map<string, StationCoverage>();
      for (const st of labStations || []) {
        const ld = labDayById.get(st.lab_day_id);
        if (!ld) continue;
        const cov: StationCoverage = {
          date: ld.date,
          lab_day_id: ld.id,
          week_number: ld.week_number,
          custom_title: st.custom_title,
          station_skill_ids: new Set(),
        };
        stationById.set(st.id, cov);
        stations.push(cov);
      }

      // station_skills → skill_id
      if (stationById.size > 0) {
        const { data: stationSkills } = await supabase
          .from('station_skills')
          .select('station_id, skill_id')
          .in('station_id', Array.from(stationById.keys()));
        for (const ss of stationSkills || []) {
          const cov = stationById.get(ss.station_id);
          if (cov && ss.skill_id) cov.station_skill_ids.add(ss.skill_id);
        }
      }
    }

    // 4. For each SMC row, compute coverage
    type SmcResult = {
      id: string;
      skill_id: string | null;
      skill_name: string;
      category: string | null;
      min_attempts: number;
      is_platinum: boolean;
      sim_permitted: boolean;
      week_number: number | null;
      covered: boolean;
      lab_day_count: number;
      first_covered_date: string | null;
      last_run_date: string | null;
      match_method: MatchMethod;
      matched_stations: Array<{
        date: string;
        lab_day_id: string;
        week_number: number | null;
        custom_title: string | null;
      }>;
    };

    const results: SmcResult[] = [];

    for (const smc of smcRows || []) {
      const nameLower = smc.skill_name.toLowerCase();
      const matchedDayIds = new Set<string>();
      const matchedStations: SmcResult['matched_stations'] = [];
      let bestMethod: MatchMethod = null;
      let firstDate: string | null = null;
      let lastDate: string | null = null;

      for (const st of stations) {
        let method: MatchMethod = null;

        // Strongest: skill_id link via station_skills
        if (smc.skill_id && st.station_skill_ids.has(smc.skill_id)) {
          method = 'station_skills';
        } else if (st.custom_title) {
          const title = st.custom_title.toLowerCase();
          if (title === nameLower) {
            method = 'title_exact';
          } else if (title.includes(nameLower) || nameLower.includes(title)) {
            method = 'title_contains';
          } else {
            // Fuzzy — only for longer strings to avoid 3-char false matches
            if (title.length >= 6 && nameLower.length >= 6) {
              const d = levenshtein(title, nameLower);
              if (d <= 3) method = 'title_fuzzy';
            }
          }
        }

        if (method) {
          matchedDayIds.add(st.lab_day_id);
          matchedStations.push({
            date: st.date,
            lab_day_id: st.lab_day_id,
            week_number: st.week_number,
            custom_title: st.custom_title,
          });
          if (!firstDate || st.date < firstDate) firstDate = st.date;
          if (!lastDate || st.date > lastDate) lastDate = st.date;
          // Upgrade bestMethod using strength order
          const strength = {
            station_skills: 4,
            title_exact: 3,
            title_contains: 2,
            title_fuzzy: 1,
          } as const;
          if (
            !bestMethod ||
            strength[method] > (strength[bestMethod] || 0)
          ) {
            bestMethod = method;
          }
        }
      }

      results.push({
        id: smc.id,
        skill_id: smc.skill_id,
        skill_name: smc.skill_name,
        category: smc.category,
        min_attempts: smc.min_attempts,
        is_platinum: smc.is_platinum,
        sim_permitted: smc.sim_permitted === true,
        week_number: smc.week_number ?? null,
        covered: matchedDayIds.size > 0,
        lab_day_count: matchedDayIds.size,
        first_covered_date: firstDate,
        last_run_date: lastDate,
        match_method: bestMethod,
        matched_stations: matchedStations.slice(0, 10), // limit payload
      });
    }

    return NextResponse.json({
      success: true,
      cohort: {
        id: cohort.id,
        cohort_number: cohort.cohort_number,
        current_semester: cohort.current_semester,
        program_id: program?.id,
        program_abbr: program?.abbreviation,
      },
      semester: effectiveSemester,
      total_lab_days: labDayIds.length,
      smc_count: results.length,
      covered_count: results.filter((r) => r.covered).length,
      results,
    });
  } catch (error) {
    console.error('[smc-completion] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load SMC completion' },
      { status: 500 }
    );
  }
}
