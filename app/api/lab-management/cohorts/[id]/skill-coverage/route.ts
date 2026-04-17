import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GET /api/lab-management/cohorts/[id]/skill-coverage?semester=N
 *
 * Returns per-skill coverage for a cohort's lab planning: how many
 * lab days each skill has appeared on, when it was last run.
 *
 * This is a LAB PLANNING reference, not a student tracker. Student-side
 * competency tracking lives in Platinum. This endpoint answers:
 *   "Has this cohort practiced this skill this semester? How many times?"
 *
 * Data path (verified against production 2026-04-15):
 *   skills (filtered by program cert_level)
 *     LEFT JOIN station_skills
 *     ON station_skills.skill_id = skills.id
 *     LEFT JOIN lab_stations ON lab_stations.id = station_skills.station_id
 *     LEFT JOIN lab_days    ON lab_days.id = lab_stations.lab_day_id
 *                            AND lab_days.cohort_id = :cohortId
 *                            AND lab_days.semester = :semester
 *   GROUP BY skills.id
 *
 * lab_stations.skill_sheet_id is only ~7% populated and cannot drive
 * coverage reporting — station_skills.skill_id is the authoritative path.
 *
 * Query params:
 *   semester — optional integer (1-4). Defaults to cohort.current_semester
 *              if set, otherwise includes all semesters for the cohort.
 */
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
    const semesterFilter = semesterParam ? parseInt(semesterParam, 10) : null;

    // 1. Load cohort + program so we can filter skills by cert_level
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
    const programAbbr = (program?.abbreviation || '').toUpperCase();

    // Effective semester: query param wins; otherwise cohort.current_semester;
    // otherwise null (means "all semesters").
    const effectiveSemester =
      semesterFilter !== null && !isNaN(semesterFilter)
        ? semesterFilter
        : cohort.current_semester ?? null;

    // 2. Load all skills relevant to this cohort's program.
    //
    // The skills table has two overlapping columns for cert level:
    //   - certification_levels: text[] like ['EMT','AEMT','Paramedic']
    //   - cert_levels:          text[] like ['PM']
    //
    // We accept either. Program abbreviation maps to levels:
    //   'PM' / 'PMD'  → 'Paramedic' (certification_levels) + 'PM' (cert_levels)
    //   'EMT'         → 'EMT'
    //   'AEMT'        → 'AEMT'
    const levelsToMatch: string[] = [];
    if (programAbbr === 'PM' || programAbbr === 'PMD') {
      levelsToMatch.push('Paramedic', 'paramedic', 'PM');
    } else if (programAbbr === 'EMT') {
      levelsToMatch.push('EMT', 'emt');
    } else if (programAbbr === 'AEMT') {
      levelsToMatch.push('AEMT', 'aemt');
    } else if (programAbbr) {
      levelsToMatch.push(programAbbr);
    }

    // Fetch all active skills then filter client-side — RPC-friendly and
    // avoids PostgREST array-contains quirks across the two array columns.
    const { data: allSkills, error: skillsError } = await supabase
      .from('skills')
      .select('id, name, category, certification_levels, cert_levels, display_order')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (skillsError) {
      console.error('[skill-coverage] skills query error:', skillsError);
      return NextResponse.json(
        { success: false, error: 'Failed to load skills' },
        { status: 500 }
      );
    }

    const relevantSkills = (allSkills || []).filter((s: any) => {
      if (levelsToMatch.length === 0) return true; // unknown program → include all
      const certA: string[] = s.certification_levels || [];
      const certB: string[] = s.cert_levels || [];
      return (
        certA.some((l) => levelsToMatch.includes(l)) ||
        certB.some((l) => levelsToMatch.includes(l))
      );
    });

    // 3. Aggregate lab day coverage per skill via station_skills.
    //    Query: station_skills joined to lab_stations + lab_days filtered
    //    by cohort + optional semester. Group in memory.
    let labDayQuery = supabase
      .from('lab_days')
      .select('id, date, semester')
      .eq('cohort_id', cohortId);
    if (effectiveSemester !== null) {
      labDayQuery = labDayQuery.eq('semester', effectiveSemester);
    }
    const { data: labDays, error: labDaysError } = await labDayQuery;

    if (labDaysError) {
      console.error('[skill-coverage] lab_days query error:', labDaysError);
      return NextResponse.json(
        { success: false, error: 'Failed to load lab days' },
        { status: 500 }
      );
    }

    const labDayIds = (labDays || []).map((ld) => ld.id);
    const labDayDateMap = new Map<string, string>();
    for (const ld of labDays || []) {
      if (ld.date) labDayDateMap.set(ld.id, ld.date);
    }

    // Skill → Set of lab_day_ids that covered it
    const skillLabDays = new Map<string, Set<string>>();
    // Skill → most recent lab day date it appeared on
    const skillLastDate = new Map<string, string>();

    // Scenario → Set of lab_day_ids that used it. Keyed by scenario_id
    // (from the scenarios table) when present. Scenarios were added
    // 2026-05 after the user requested tracking the scenario library
    // alongside skills — lab_stations.scenario_id is the canonical link.
    const scenarioLabDays = new Map<string, Set<string>>();
    const scenarioLastDate = new Map<string, string>();
    const scenarioIdsSeen = new Set<string>();

    if (labDayIds.length > 0) {
      // Fetch lab_stations with scenario_id so we can aggregate scenarios
      // in the same pass.
      const { data: stations, error: stationsError } = await supabase
        .from('lab_stations')
        .select('id, lab_day_id, scenario_id')
        .in('lab_day_id', labDayIds);

      if (stationsError) {
        console.error('[skill-coverage] stations query error:', stationsError);
      } else if (stations && stations.length > 0) {
        const stationIdToLabDay = new Map<string, string>();
        for (const st of stations) {
          stationIdToLabDay.set(st.id, st.lab_day_id);

          // Aggregate scenarios directly from lab_stations.scenario_id
          if (st.scenario_id) {
            scenarioIdsSeen.add(st.scenario_id);
            if (!scenarioLabDays.has(st.scenario_id)) {
              scenarioLabDays.set(st.scenario_id, new Set());
            }
            scenarioLabDays.get(st.scenario_id)!.add(st.lab_day_id);
            const date = labDayDateMap.get(st.lab_day_id);
            if (date) {
              const prev = scenarioLastDate.get(st.scenario_id);
              if (!prev || date > prev) scenarioLastDate.set(st.scenario_id, date);
            }
          }
        }

        // Get all station_skills entries for these stations
        const { data: stationSkills, error: ssError } = await supabase
          .from('station_skills')
          .select('station_id, skill_id')
          .in('station_id', Array.from(stationIdToLabDay.keys()));

        if (ssError) {
          console.error('[skill-coverage] station_skills error:', ssError);
        } else {
          for (const ss of stationSkills || []) {
            const labDayId = stationIdToLabDay.get(ss.station_id);
            if (!labDayId || !ss.skill_id) continue;
            if (!skillLabDays.has(ss.skill_id)) {
              skillLabDays.set(ss.skill_id, new Set());
            }
            skillLabDays.get(ss.skill_id)!.add(labDayId);
            const date = labDayDateMap.get(labDayId);
            if (date) {
              const prev = skillLastDate.get(ss.skill_id);
              if (!prev || date > prev) skillLastDate.set(ss.skill_id, date);
            }
          }
        }
      }
    }

    // Load scenario records for any scenario_ids we saw on stations.
    // Only includes scenarios actually run (no "not yet" scenarios — the
    // scenarios library is too broad to show every untouched one).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let scenariosRun: any[] = [];
    if (scenarioIdsSeen.size > 0) {
      const { data } = await supabase
        .from('scenarios')
        .select('id, title, category')
        .in('id', Array.from(scenarioIdsSeen));
      scenariosRun = data || [];
    }

    // 4. Assemble the response. Include every relevant skill (even not-yet
    //    ones) so the UI can show "not yet" chips. Also include skills that
    //    were run but aren't in the relevant list (e.g., cross-program),
    //    flagged with _not_in_program so UI can render them distinctly.
    const relevantIdSet = new Set(relevantSkills.map((s) => s.id));
    const extraSkillIds = Array.from(skillLabDays.keys()).filter(
      (id) => !relevantIdSet.has(id)
    );

    let extraSkills: any[] = [];
    if (extraSkillIds.length > 0) {
      const { data } = await supabase
        .from('skills')
        .select('id, name, category, certification_levels, cert_levels, display_order')
        .in('id', extraSkillIds);
      extraSkills = data || [];
    }

    type Row = {
      skill_id: string;
      name: string;
      category: string | null;
      lab_day_count: number;
      last_run_date: string | null;
      status: 'multiple' | 'once' | 'not_yet';
      in_program: boolean;
      kind: 'skill' | 'scenario';
    };

    const buildSkillRow = (skill: any, inProgram: boolean): Row => {
      const count = skillLabDays.get(skill.id)?.size || 0;
      const status: Row['status'] =
        count >= 2 ? 'multiple' : count === 1 ? 'once' : 'not_yet';
      return {
        skill_id: skill.id,
        name: skill.name,
        category: skill.category,
        lab_day_count: count,
        last_run_date: skillLastDate.get(skill.id) || null,
        status,
        in_program: inProgram,
        kind: 'skill',
      };
    };

    const buildScenarioRow = (scenario: any): Row => {
      const count = scenarioLabDays.get(scenario.id)?.size || 0;
      const status: Row['status'] =
        count >= 2 ? 'multiple' : count === 1 ? 'once' : 'not_yet';
      return {
        skill_id: scenario.id, // shared field name for frontend convenience
        name: scenario.title,
        category: scenario.category,
        lab_day_count: count,
        last_run_date: scenarioLastDate.get(scenario.id) || null,
        status,
        in_program: true, // scenarios always "in program"
        kind: 'scenario',
      };
    };

    const rows: Row[] = [
      ...relevantSkills.map((s) => buildSkillRow(s, true)),
      ...extraSkills.map((s) => buildSkillRow(s, false)),
      ...scenariosRun.map(buildScenarioRow),
    ];

    return NextResponse.json({
      success: true,
      cohort: {
        id: cohort.id,
        cohort_number: cohort.cohort_number,
        current_semester: cohort.current_semester,
        program_abbr: programAbbr || null,
      },
      semester: effectiveSemester,
      total_lab_days: labDayIds.length,
      skills: rows,
    });
  } catch (error) {
    console.error('[skill-coverage] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load skill coverage' },
      { status: 500 }
    );
  }
}
