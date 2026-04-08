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
    const { data: stations } = await supabase
      .from('lab_stations')
      .select('id, station_number, station_type, custom_title, skill_name, scenario:scenarios(id, title)')
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

    // 6. Get evaluations for this lab day (with step counts)
    const { data: evaluations } = await supabase
      .from('student_skill_evaluations')
      .select('id, student_id, skill_sheet_id, result, step_marks, created_at, team_role, evaluator:lab_users!student_skill_evaluations_evaluator_id_fkey(name)')
      .eq('lab_day_id', labDayId);

    // 7. Get station-to-skill-sheet mapping (via station_skills table)
    let stationSkillMap: Record<string, string> = {};
    if (stationIds.length > 0) {
      const { data: stationSkills } = await supabase
        .from('station_skills')
        .select('station_id, skill:skills!station_skills_skill_id_fkey(id, skill_sheet_ids)')
        .in('station_id', stationIds);

      // Also check lab_station metadata for skill_sheet_id
      const { data: stationsWithMeta } = await supabase
        .from('lab_stations')
        .select('id, metadata')
        .in('id', stationIds);

      if (stationsWithMeta) {
        for (const s of stationsWithMeta) {
          const meta = s.metadata as Record<string, unknown> | null;
          if (meta?.skill_sheet_id) {
            stationSkillMap[s.id] = meta.skill_sheet_id as string;
          }
        }
      }

      // station_skills mapping as fallback
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
    let skillSheetStepCounts: Record<string, { total: number; critical: number }> = {};
    if (skillSheetIdsSet.size > 0) {
      const { data: steps } = await supabase
        .from('skill_sheet_steps')
        .select('skill_sheet_id, is_critical')
        .in('skill_sheet_id', Array.from(skillSheetIdsSet));

      if (steps) {
        for (const step of steps) {
          if (!skillSheetStepCounts[step.skill_sheet_id]) {
            skillSheetStepCounts[step.skill_sheet_id] = { total: 0, critical: 0 };
          }
          skillSheetStepCounts[step.skill_sheet_id].total++;
          if (step.is_critical) skillSheetStepCounts[step.skill_sheet_id].critical++;
        }
      }
    }

    // Build evaluation summary map: evalId -> summary data
    const evalSummaryMap: Record<string, {
      stepsCompleted: number;
      stepsTotal: number;
      criticalCompleted: number;
      criticalTotal: number;
      evaluatorName: string | null;
    }> = {};
    for (const evalItem of (evaluations || [])) {
      const stepCounts = skillSheetStepCounts[evalItem.skill_sheet_id] || { total: 0, critical: 0 };
      const stepMarks = (evalItem.step_marks || {}) as Record<string, string>;
      const passedSteps = Object.values(stepMarks).filter(v => v === 'pass').length;

      // For critical steps, we'd need the step data; approximate from step_marks
      const rawEvaluator = evalItem.evaluator as unknown;
      const evaluator = (Array.isArray(rawEvaluator) ? rawEvaluator[0] : rawEvaluator) as { name: string } | null;
      evalSummaryMap[evalItem.id] = {
        stepsCompleted: passedSteps,
        stepsTotal: stepCounts.total,
        criticalCompleted: 0, // Will be refined below
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
      };
    }

    // Overlay evaluation results (evaluations take precedence for completed status)
    for (const evalItem of (evaluations || [])) {
      // Find station for this evaluation's skill_sheet_id
      for (const [stationId, skillSheetId] of Object.entries(stationSkillMap)) {
        if (skillSheetId === evalItem.skill_sheet_id) {
          const key = `${evalItem.student_id}_${stationId}`;
          const existing = cells[key];
          cells[key] = {
            queueId: existing?.queueId || null,
            status: 'completed',
            result: evalItem.result === 'pass' ? 'pass' : 'fail',
            evaluationId: evalItem.id,
            evalSummary: evalSummaryMap[evalItem.id] || null,
            teamRole: (evalItem as Record<string, unknown>).team_role as string | null || null,
          };
        }
      }
    }

    return NextResponse.json({
      success: true,
      labMode: labDay.lab_mode || 'group_rotations',
      students: students || [],
      stations: (stations || []).map((s: Record<string, unknown>) => ({
        ...s,
        skillSheetId: stationSkillMap[s.id as string] || null,
        instructorName: stationInstructorMap[s.id as string]?.name || null,
      })),
      cells,
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
