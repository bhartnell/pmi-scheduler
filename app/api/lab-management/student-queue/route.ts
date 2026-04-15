import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth, requireAuthOrVolunteerToken } from '@/lib/api-auth';
import type { VolunteerTokenResult } from '@/lib/api-auth';

// ---------------------------------------------------------------------------
// GET /api/lab-management/student-queue?lab_day_id=UUID
//
// Returns the student x station grid data for individual testing mode.
// Includes station instructor names and evaluation summary data.
// Supports volunteer lab tokens (scoped to their lab day).
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const auth = await requireAuthOrVolunteerToken(request, 'instructor');
  if (auth instanceof NextResponse) return auth;

  const labDayId = request.nextUrl.searchParams.get('lab_day_id');
  if (!labDayId) {
    return NextResponse.json(
      { success: false, error: 'lab_day_id is required' },
      { status: 400 }
    );
  }

  // Volunteer tokens: ensure they can only access their scoped lab day
  if ((auth as VolunteerTokenResult).isVolunteerToken) {
    if (labDayId !== (auth as VolunteerTokenResult).labDayId) {
      return NextResponse.json(
        { success: false, error: 'Access denied: not your lab day' },
        { status: 403 }
      );
    }
  }

  try {
    const supabase = getSupabaseAdmin();

    // 1. Fetch the lab day to get cohort_id
    const { data: labDay, error: labDayErr } = await supabase
      .from('lab_days')
      .select('id, cohort_id, lab_mode')
      .eq('id', labDayId)
      .single();

    if (labDayErr || !labDay) {
      return NextResponse.json(
        { success: false, error: 'Lab day not found' },
        { status: 404 }
      );
    }

    // 2. Get stations for this lab day
    //
    // IMPORTANT: include `skill_sheet_id` (the typed FK column on
    // lab_stations). NREMT assessment stations are linked to their
    // skill sheet via this column, NOT via metadata.skill_sheet_id or
    // station_skills. Leaving it off the select caused the tracker to
    // render 13 columns (7 stations + 6 evaluation-derived) because
    // stationSkillMap ended up empty for every NREMT station, so the
    // Pass-2 evaluation-column builder below failed to match any
    // evaluation back to an existing station column.
    const { data: stations } = await supabase
      .from('lab_stations')
      .select('id, station_number, station_type, custom_title, skill_name, skill_sheet_id, metadata, scenario:scenarios(id, title)')
      .eq('lab_day_id', labDayId)
      .order('station_number');

    // 3. Get station instructors (primary instructor per station)
    const stationIds = (stations || []).map((s: { id: string }) => s.id);
    let stationInstructorMap: Record<string, { name: string; email: string }> = {};
    if (stationIds.length > 0) {
      const { data: stationInstructors } = await supabase
        .from('station_instructors')
        .select('station_id, user_name, user_email, is_primary')
        .in('station_id', stationIds);

      if (stationInstructors) {
        // Prefer primary instructor; fall back to first found
        for (const si of stationInstructors) {
          if (!stationInstructorMap[si.station_id] || si.is_primary) {
            stationInstructorMap[si.station_id] = {
              name: si.user_name || si.user_email.split('@')[0],
              email: si.user_email,
            };
          }
        }
      }
    }

    // 4. Get active students from the cohort
    const { data: students } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('cohort_id', labDay.cohort_id)
      .eq('status', 'active')
      .order('last_name');

    // 5. Get queue entries for this lab day
    const { data: queueEntries } = await supabase
      .from('lab_day_student_queue')
      .select('id, student_id, station_id, status, result, evaluation_id, started_at, completed_at')
      .eq('lab_day_id', labDayId);

    // 6. Get evaluations for this lab day (with step counts + retake info)
    const { data: evaluations } = await supabase
      .from('student_skill_evaluations')
      .select('id, student_id, skill_sheet_id, result, step_marks, created_at, team_role, is_retake, attempt_number, evaluator:lab_users!student_skill_evaluations_evaluator_id_fkey(name)')
      .eq('lab_day_id', labDayId);

    // 7. Build station-to-skill-sheet mapping.
    //
    // Resolution order (first wins):
    //   1. lab_stations.skill_sheet_id (typed FK column) — NREMT stations
    //   2. lab_stations.metadata.skill_sheet_id (legacy metadata path)
    //   3. station_skills → skills.skill_sheet_ids[0] (station-pick path)
    //
    // Historically only (2) and (3) were checked, so NREMT stations
    // (which only populate the typed column) produced an empty
    // stationSkillMap and the tracker duplicated every skill column.
    let stationSkillMap: Record<string, string> = {};
    const stationAddedDuringExamMap: Record<string, boolean> = {};
    const stationSuffixMap: Record<string, string> = {};

    // (1) Typed column — already available on `stations` from step 2.
    for (const s of (stations || [])) {
      const sheetId = (s as { skill_sheet_id?: string | null }).skill_sheet_id;
      if (sheetId) stationSkillMap[(s as { id: string }).id] = sheetId;
    }

    if (stationIds.length > 0) {
      const { data: stationSkills } = await supabase
        .from('station_skills')
        .select('station_id, skill:skills!station_skills_skill_id_fkey(id, skill_sheet_ids)')
        .in('station_id', stationIds);

      // (2) Metadata fallback + collect added_during_exam / suffix flags.
      for (const s of (stations || [])) {
        const meta = (s as { metadata?: Record<string, unknown> | null }).metadata || null;
        const sid = (s as { id: string }).id;
        if (!stationSkillMap[sid] && meta?.skill_sheet_id) {
          stationSkillMap[sid] = meta.skill_sheet_id as string;
        }
        if (meta?.added_during_exam) {
          stationAddedDuringExamMap[sid] = true;
        }
        if (meta?.station_suffix) {
          stationSuffixMap[sid] = meta.station_suffix as string;
        }
      }

      // (3) station_skills mapping as final fallback.
      if (stationSkills) {
        for (const ss of stationSkills) {
          const skill = ss.skill as unknown as { id: string; skill_sheet_ids?: string[] } | null;
          if (skill?.skill_sheet_ids?.length && !stationSkillMap[ss.station_id]) {
            stationSkillMap[ss.station_id] = skill.skill_sheet_ids[0];
          }
        }
      }
    }

    // 8. Get skill sheet step counts for completed evals
    const evalIds = (evaluations || []).map((e: { id: string }) => e.id);
    const skillSheetIdsSet = new Set<string>();
    for (const e of (evaluations || [])) {
      if (e.skill_sheet_id) skillSheetIdsSet.add(e.skill_sheet_id);
    }
    // sheetId -> { total, critical, criticalByStepNum: Set<step_number> }
    let skillSheetStepCounts: Record<string, {
      total: number;
      critical: number;
      criticalStepNums: Set<number>;
    }> = {};
    if (skillSheetIdsSet.size > 0) {
      const { data: steps } = await supabase
        .from('skill_sheet_steps')
        .select('skill_sheet_id, step_number, is_critical')
        .in('skill_sheet_id', Array.from(skillSheetIdsSet));

      if (steps) {
        for (const step of steps) {
          if (!skillSheetStepCounts[step.skill_sheet_id]) {
            skillSheetStepCounts[step.skill_sheet_id] = {
              total: 0,
              critical: 0,
              criticalStepNums: new Set<number>(),
            };
          }
          skillSheetStepCounts[step.skill_sheet_id].total++;
          if (step.is_critical) {
            skillSheetStepCounts[step.skill_sheet_id].critical++;
            if (typeof step.step_number === 'number') {
              skillSheetStepCounts[step.skill_sheet_id].criticalStepNums.add(step.step_number);
            }
          }
        }
      }
    }

    // Build evaluation summary map: evalId -> summary data
    // Handles BOTH step_marks formats:
    //   Old: { "1": "pass", "2": "fail" }
    //   New: { "1": { completed: true, points: 1, sub_items?: [...] } }
    const evalSummaryMap: Record<string, {
      stepsCompleted: number;
      stepsTotal: number;
      criticalCompleted: number;
      criticalTotal: number;
      evaluatorName: string | null;
    }> = {};
    for (const evalItem of (evaluations || [])) {
      const stepCounts = skillSheetStepCounts[evalItem.skill_sheet_id] || {
        total: 0,
        critical: 0,
        criticalStepNums: new Set<number>(),
      };
      const stepMarks = (evalItem.step_marks || {}) as Record<string, unknown>;

      let passedSteps = 0;
      let criticalPassed = 0;
      for (const [key, val] of Object.entries(stepMarks)) {
        const stepNum = parseInt(key, 10);
        let stepPassed = false;
        if (typeof val === 'string') {
          // Old format: "pass" | "fail" | "caution"
          stepPassed = val === 'pass';
        } else if (val && typeof val === 'object') {
          // New format: { completed: boolean, points?: number, sub_items?: boolean[] }
          const obj = val as { completed?: boolean };
          stepPassed = obj.completed === true;
        }
        if (stepPassed) {
          passedSteps++;
          if (!Number.isNaN(stepNum) && stepCounts.criticalStepNums.has(stepNum)) {
            criticalPassed++;
          }
        }
      }

      const rawEvaluator = evalItem.evaluator as unknown;
      const evaluator = (Array.isArray(rawEvaluator) ? rawEvaluator[0] : rawEvaluator) as { name: string } | null;
      evalSummaryMap[evalItem.id] = {
        stepsCompleted: passedSteps,
        stepsTotal: stepCounts.total,
        criticalCompleted: criticalPassed,
        criticalTotal: stepCounts.critical,
        evaluatorName: evaluator?.name || null,
      };
    }

    // Build cells map: key = `${studentId}_${stationId}`
    const cells: Record<string, {
      queueId: string | null;
      status: string;
      result: string | null;
      evaluationId: string | null;
      evalSummary: {
        stepsCompleted: number;
        stepsTotal: number;
        criticalCompleted: number;
        criticalTotal: number;
        evaluatorName: string | null;
      } | null;
      teamRole: string | null;
      hasRetake: boolean;
      bestResult: string | null;
    }> = {};

    // First populate from queue entries
    for (const entry of (queueEntries || [])) {
      const key = `${entry.student_id}_${entry.station_id}`;
      cells[key] = {
        queueId: entry.id,
        status: entry.status,
        result: entry.result,
        evaluationId: entry.evaluation_id,
        evalSummary: entry.evaluation_id ? (evalSummaryMap[entry.evaluation_id] || null) : null,
        teamRole: null,
        hasRetake: false,
        bestResult: entry.result,
      };
    }

    // Track all results per student+station for best-result logic
    const allResults: Record<string, { results: string[]; hasRetake: boolean }> = {};

    // Overlay evaluation results (evaluations take precedence for completed status)
    for (const evalItem of (evaluations || [])) {
      // Find station for this evaluation's skill_sheet_id
      for (const [stationId, skillSheetId] of Object.entries(stationSkillMap)) {
        if (skillSheetId === evalItem.skill_sheet_id) {
          const key = `${evalItem.student_id}_${stationId}`;
          const existing = cells[key];

          // Track results for best-result logic
          if (!allResults[key]) {
            allResults[key] = { results: [], hasRetake: false };
          }
          allResults[key].results.push(evalItem.result === 'pass' ? 'pass' : 'fail');
          if ((evalItem as Record<string, unknown>).is_retake) {
            allResults[key].hasRetake = true;
          }

          // Best result: pass wins over fail
          const bestResult = allResults[key].results.includes('pass') ? 'pass' : 'fail';

          cells[key] = {
            queueId: existing?.queueId || null,
            status: 'completed',
            result: bestResult,
            evaluationId: evalItem.id,
            evalSummary: evalSummaryMap[evalItem.id] || null,
            teamRole: (evalItem as Record<string, unknown>).team_role as string | null || null,
            hasRetake: allResults[key].hasRetake,
            bestResult,
          };
        }
      }
    }

    // ─── Build skill-based columns and cells ───────────────────────────
    // Dynamic skill-based grouping: columns are derived from the UNION of
    // (stations on this lab day) ∪ (any evaluations recorded for this lab day
    // that reference a skill_sheet_id). This ensures evaluations performed at
    // stations added mid-day — or at any station that's since been removed —
    // still appear in the correct skill column on the next poll cycle.

    const stationList = ((stations || []) as Array<Record<string, unknown>>).map(s => ({
      id: s.id as string,
      station_number: s.station_number as number,
      station_type: s.station_type as string,
      custom_title: s.custom_title as string | null,
      skill_name: s.skill_name as string | null,
      skill_sheet_id: (s.skill_sheet_id as string | null) || null,
      metadata: (s.metadata as Record<string, unknown> | null) || null,
      scenario: Array.isArray(s.scenario) ? (s.scenario[0] as { id: string; title: string } | undefined) || null : s.scenario as { id: string; title: string } | null,
    }));

    // Gather all skill_sheet_ids referenced anywhere: stations' metadata mapping
    // AND any evaluation for this lab day.
    const allSkillSheetIds = new Set<string>();
    for (const sid of Object.values(stationSkillMap)) {
      if (sid) allSkillSheetIds.add(sid);
    }
    for (const evalItem of (evaluations || [])) {
      if (evalItem.skill_sheet_id) allSkillSheetIds.add(evalItem.skill_sheet_id);
    }

    // Fetch skill_sheet display names for every referenced sheet (so evaluations
    // whose skill_sheet_id is not represented by any current station still get a
    // human-readable column header).
    const skillSheetIdToName: Record<string, string> = {};
    if (allSkillSheetIds.size > 0) {
      const { data: sheetRows } = await supabase
        .from('skill_sheets')
        .select('id, skill_name')
        .in('id', Array.from(allSkillSheetIds));
      if (sheetRows) {
        for (const row of sheetRows as Array<{ id: string; skill_name: string | null }>) {
          if (row.skill_name) skillSheetIdToName[row.id] = row.skill_name;
        }
      }
    }

    // Column identity resolver: given a skill_sheet_id (may be null), produce the
    // skillName used as the column key. Prefer station skill_name when a station
    // backs this sheet (matches existing conventions); otherwise fall back to the
    // skill sheet's own name.
    const skillSheetIdToStationSkillName: Record<string, string> = {};
    for (const s of stationList) {
      const sheetId = stationSkillMap[s.id];
      if (sheetId && s.skill_name && !skillSheetIdToStationSkillName[sheetId]) {
        skillSheetIdToStationSkillName[sheetId] = s.skill_name;
      }
    }
    const resolveSkillName = (skillSheetId: string | null, fallbackStation?: typeof stationList[number]): string => {
      if (skillSheetId) {
        return (
          skillSheetIdToStationSkillName[skillSheetId] ||
          skillSheetIdToName[skillSheetId] ||
          (fallbackStation?.skill_name || fallbackStation?.custom_title || fallbackStation?.scenario?.title) ||
          `Skill ${skillSheetId.slice(0, 8)}`
        );
      }
      if (fallbackStation) {
        return fallbackStation.skill_name || fallbackStation.custom_title || fallbackStation.scenario?.title || `Station ${fallbackStation.station_number}`;
      }
      return 'Unknown skill';
    };

    // Build mapping: skillName -> list of station ids that run it.
    //
    // Station-backed columns are the canonical source for this lab day.
    // Evaluations are matched back to an existing station column by
    // skill_sheet_id. An evaluation only produces a new column if its
    // skill_sheet_id is NOT backed by any station on this lab day
    // (e.g. a station was removed mid-day after evals were recorded).
    //
    // Dedup is keyed on a reverse index (sheetId -> skillName) so a
    // resolveSkillName variance between passes can never create a
    // duplicate column for the same skill_sheet_id. This closes the
    // NREMT-day bug where 7 stations rendered as 13 columns because
    // Pass 1 stored `null` sheetIds and Pass 2 then re-added columns
    // for every evaluation.
    const skillToStationIds: Record<string, string[]> = {};
    const skillNameToSheetId: Record<string, string | null> = {};
    const sheetIdToSkillName: Record<string, string> = {};
    const skillColumnOrder: string[] = [];

    // Pass 1: stations define initial columns.
    for (const s of stationList) {
      const sheetId = stationSkillMap[s.id] || s.skill_sheet_id || null;
      const skillName = resolveSkillName(sheetId, s);
      if (!skillToStationIds[skillName]) {
        skillToStationIds[skillName] = [];
        skillColumnOrder.push(skillName);
        skillNameToSheetId[skillName] = sheetId;
      } else if (!skillNameToSheetId[skillName] && sheetId) {
        skillNameToSheetId[skillName] = sheetId;
      }
      if (sheetId && !sheetIdToSkillName[sheetId]) {
        sheetIdToSkillName[sheetId] = skillName;
      }
      skillToStationIds[skillName].push(s.id);
    }

    // Pass 2: evaluations whose skill_sheet_id is NOT already represented
    // by a station column on this lab day. Matched by sheet_id via the
    // reverse index — no string comparison on resolved names.
    for (const evalItem of (evaluations || [])) {
      if (!evalItem.skill_sheet_id) continue;
      if (sheetIdToSkillName[evalItem.skill_sheet_id]) continue; // already has a column
      const skillName = resolveSkillName(evalItem.skill_sheet_id);
      if (!skillToStationIds[skillName]) {
        skillToStationIds[skillName] = [];
        skillColumnOrder.push(skillName);
        skillNameToSheetId[skillName] = evalItem.skill_sheet_id;
        sheetIdToSkillName[evalItem.skill_sheet_id] = skillName;
      }
    }

    // Build skillColumns array for the UI
    const skillColumns = skillColumnOrder.map(skillName => ({
      skillName,
      stationIds: skillToStationIds[skillName] || [],
      skillSheetId: skillNameToSheetId[skillName] || null,
    }));

    // Build skillCells: key = `${studentId}_${skillName}`
    // For each student x skill, merge results from all stations running that skill.
    // Priority: pass > in_progress > fail > not_started
    // If multiple completed evals exist, pass wins over fail.
    const skillCells: Record<string, {
      queueId: string | null;
      status: string;
      result: string | null;
      evaluationId: string | null;
      evalSummary: {
        stepsCompleted: number;
        stepsTotal: number;
        criticalCompleted: number;
        criticalTotal: number;
        evaluatorName: string | null;
      } | null;
      teamRole: string | null;
      hasRetake: boolean;
      bestResult: string | null;
    }> = {};

    // Group evaluations by student + skill_sheet_id → best evaluation cell.
    // This is the authoritative source for "completed" state: any evaluation
    // linked to skill_sheet_id X becomes part of the column for X regardless
    // of which station (if any) it was graded at, or when that station was
    // created.
    type SkillCellValue = typeof skillCells[string];
    const evalCellByStudentSheet: Record<string, SkillCellValue & { _hasPass?: boolean; _anyRetake?: boolean }> = {};
    for (const evalItem of (evaluations || [])) {
      if (!evalItem.skill_sheet_id) continue;
      const key = `${evalItem.student_id}__${evalItem.skill_sheet_id}`;
      const summary = evalSummaryMap[evalItem.id] || null;
      const isRetake = Boolean((evalItem as Record<string, unknown>).is_retake);
      const teamRole = ((evalItem as Record<string, unknown>).team_role as string | null) || null;
      const thisResult = evalItem.result === 'pass' ? 'pass' : 'fail';

      const existing = evalCellByStudentSheet[key];
      if (!existing) {
        evalCellByStudentSheet[key] = {
          queueId: null,
          status: 'completed',
          result: thisResult,
          evaluationId: evalItem.id,
          evalSummary: summary,
          teamRole,
          hasRetake: isRetake,
          bestResult: thisResult,
          _hasPass: thisResult === 'pass',
          _anyRetake: isRetake,
        };
      } else {
        existing._anyRetake = existing._anyRetake || isRetake;
        existing.hasRetake = existing._anyRetake || false;
        // Pass wins over fail. Prefer the most-informative eval (pass) as the
        // canonical evaluationId so the UI can open the correct sheet.
        if (thisResult === 'pass' && !existing._hasPass) {
          existing.evaluationId = evalItem.id;
          existing.evalSummary = summary;
          existing.teamRole = teamRole;
          existing._hasPass = true;
          existing.result = 'pass';
          existing.bestResult = 'pass';
        } else if (thisResult === 'fail' && !existing._hasPass) {
          // Keep latest fail summary so the UI shows the most recent attempt.
          existing.evaluationId = evalItem.id;
          existing.evalSummary = summary;
          existing.teamRole = teamRole;
        }
      }
    }

    for (const student of (students || [])) {
      for (const skillName of skillColumnOrder) {
        const skillKey = `${student.id}_${skillName}`;
        const sheetId = skillNameToSheetId[skillName];
        const sids = skillToStationIds[skillName] || [];

        // 1. Prefer evaluation-derived cell (grouped by skill_sheet_id directly).
        let bestCell: SkillCellValue | null = null;
        if (sheetId) {
          const evalCell = evalCellByStudentSheet[`${student.id}__${sheetId}`];
          if (evalCell) {
            // Strip internal bookkeeping fields before returning.
            const { _hasPass: _hp, _anyRetake: _ar, ...clean } = evalCell;
            void _hp; void _ar;
            bestCell = clean;
          }
        }

        // 2. Overlay per-station queue state (in_progress / not_started) from
        //    station-based cells only if we don't already have a completed
        //    evaluation. This preserves "student is currently at station X"
        //    badges for stations that back this skill.
        let anyRetake = bestCell?.hasRetake || false;
        for (const sid of sids) {
          const cell = cells[`${student.id}_${sid}`];
          if (!cell) continue;
          if (cell.hasRetake) anyRetake = true;

          if (bestCell && bestCell.status === 'completed' && bestCell.result === 'pass') {
            // Already passed — nothing a station cell can improve.
            continue;
          }

          if (!bestCell) {
            bestCell = { ...cell };
            continue;
          }

          // Merge precedence: pass > completed(fail) > in_progress > other
          if (cell.status === 'completed' && cell.result === 'pass') {
            bestCell = { ...cell };
          } else if (cell.status === 'in_progress' && bestCell.status !== 'completed') {
            bestCell = { ...cell };
          } else if (cell.status === 'completed' && bestCell.status !== 'completed') {
            bestCell = { ...cell };
          }
        }

        if (bestCell) {
          if (anyRetake) bestCell.hasRetake = true;
          skillCells[skillKey] = bestCell;
        }
      }
    }

    // Build per-student "needs" list: skill names student hasn't passed yet
    const studentNeeds: Record<string, string[]> = {};
    for (const student of (students || [])) {
      const needs: string[] = [];
      for (const skillName of skillColumnOrder) {
        const skillKey = `${student.id}_${skillName}`;
        const cell = skillCells[skillKey];
        if (!cell || cell.status !== 'completed' || cell.result !== 'pass') {
          needs.push(skillName);
        }
      }
      studentNeeds[student.id] = needs;
    }

    return NextResponse.json({
      success: true,
      labMode: labDay.lab_mode || 'group_rotations',
      students: students || [],
      stations: stationList.map((s) => {
        const meta = (s as { metadata?: Record<string, unknown> }).metadata || {};
        const coordinatorStatus = (meta.coordinator_status as string | undefined) || 'open';
        return {
          ...s,
          skillSheetId: stationSkillMap[s.id] || null,
          instructorName: stationInstructorMap[s.id]?.name || null,
          addedDuringExam: stationAddedDuringExamMap[s.id] || false,
          stationSuffix: stationSuffixMap[s.id] || null,
          coordinatorStatus,
        };
      }),
      cells,
      // New skill-based data
      skillColumns,
      skillCells,
      studentNeeds,
    });
  } catch (err) {
    console.error('Error fetching student queue:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/lab-management/student-queue
//
// Send a student to a station (create queue entry with status='in_progress')
// Body: { lab_day_id, student_id, station_id, status? }
// Handles "already in progress" gracefully — returns existing entry.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { lab_day_id, student_id, station_id, status: requestedStatus } = body;
    const targetStatus = requestedStatus || 'in_progress';

    if (!lab_day_id || !student_id || !station_id) {
      return NextResponse.json(
        { success: false, error: 'lab_day_id, student_id, and station_id are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Check if an entry already exists and is in_progress
    const { data: existing } = await supabase
      .from('lab_day_student_queue')
      .select('id, status')
      .eq('lab_day_id', lab_day_id)
      .eq('student_id', student_id)
      .eq('station_id', station_id)
      .eq('status', 'in_progress')
      .maybeSingle();

    if (existing) {
      // Already in_progress — return existing entry
      return NextResponse.json({ success: true, entry: existing, message: 'Already in progress' });
    }

    const { data: entry, error } = await supabase
      .from('lab_day_student_queue')
      .insert({
        lab_day_id,
        student_id,
        station_id,
        status: targetStatus,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, entry });
  } catch (err) {
    console.error('Error creating queue entry:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/lab-management/student-queue
//
// Update a queue entry (complete, override result)
// Body: { id, status?, result?, evaluation_id? }
// Also supports lookup by { lab_day_id, student_id, station_id } if id is not known.
// ---------------------------------------------------------------------------
export async function PUT(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { id, lab_day_id, student_id, station_id, status, result, evaluation_id } = body;

    const supabase = getSupabaseAdmin();

    // If no id provided, look up by lab_day_id + student_id + station_id
    let entryId = id;
    if (!entryId && lab_day_id && student_id && station_id) {
      // Find most recent entry for this student+station (any status, not just in_progress)
      const { data: found } = await supabase
        .from('lab_day_student_queue')
        .select('id')
        .eq('lab_day_id', lab_day_id)
        .eq('student_id', student_id)
        .eq('station_id', station_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (found) {
        entryId = found.id;
      } else {
        // No in-progress entry found — create one and complete it immediately
        const { data: newEntry, error: insertErr } = await supabase
          .from('lab_day_student_queue')
          .insert({
            lab_day_id,
            student_id,
            station_id,
            status: status || 'completed',
            result: result || null,
            evaluation_id: evaluation_id || null,
            started_at: new Date().toISOString(),
            completed_at: status === 'completed' ? new Date().toISOString() : null,
          })
          .select()
          .single();

        if (insertErr) throw insertErr;
        return NextResponse.json({ success: true, entry: newEntry });
      }
    }

    if (!entryId) {
      return NextResponse.json(
        { success: false, error: 'Queue entry id (or lab_day_id+student_id+station_id) is required' },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (result !== undefined) updates.result = result;
    if (evaluation_id !== undefined) updates.evaluation_id = evaluation_id;
    if (status === 'completed') updates.completed_at = new Date().toISOString();

    const { data: entry, error } = await supabase
      .from('lab_day_student_queue')
      .update(updates)
      .eq('id', entryId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, entry });
  } catch (err) {
    console.error('Error updating queue entry:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/lab-management/student-queue
//
// Reset a cell back to "Not Started" by deleting the queue entry.
// Body: { id } or { lab_day_id, student_id, station_id }
// Keeps evaluation records — only removes the queue entry.
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { id, lab_day_id, student_id, station_id } = body;

    const supabase = getSupabaseAdmin();

    if (id) {
      const { error } = await supabase
        .from('lab_day_student_queue')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } else if (lab_day_id && student_id && station_id) {
      const { error } = await supabase
        .from('lab_day_student_queue')
        .delete()
        .eq('lab_day_id', lab_day_id)
        .eq('student_id', student_id)
        .eq('station_id', station_id);
      if (error) throw error;
    } else {
      return NextResponse.json(
        { success: false, error: 'id or lab_day_id+student_id+station_id required' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting queue entry:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
