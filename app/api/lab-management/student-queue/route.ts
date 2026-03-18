import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// ---------------------------------------------------------------------------
// GET /api/lab-management/student-queue?lab_day_id=UUID
//
// Returns the student x station grid data for individual testing mode.
// Combines lab_day_student_queue entries with student_skill_evaluations.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const labDayId = request.nextUrl.searchParams.get('lab_day_id');
  if (!labDayId) {
    return NextResponse.json(
      { success: false, error: 'lab_day_id is required' },
      { status: 400 }
    );
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

    // 3. Get active students from the cohort
    const { data: students } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('cohort_id', labDay.cohort_id)
      .eq('status', 'active')
      .order('last_name');

    // 4. Get queue entries for this lab day
    const { data: queueEntries } = await supabase
      .from('lab_day_student_queue')
      .select('id, student_id, station_id, status, result, evaluation_id, started_at, completed_at')
      .eq('lab_day_id', labDayId);

    // 5. Get evaluations for this lab day
    const { data: evaluations } = await supabase
      .from('student_skill_evaluations')
      .select('id, student_id, skill_sheet_id, result, created_at')
      .eq('lab_day_id', labDayId);

    // 6. Get station-to-skill-sheet mapping (via station_skills table)
    const stationIds = (stations || []).map((s: { id: string }) => s.id);
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

    // Build cells map: key = `${studentId}_${stationId}`
    const cells: Record<string, {
      queueId: string | null;
      status: string;
      result: string | null;
      evaluationId: string | null;
    }> = {};

    // First populate from queue entries
    for (const entry of (queueEntries || [])) {
      const key = `${entry.student_id}_${entry.station_id}`;
      cells[key] = {
        queueId: entry.id,
        status: entry.status,
        result: entry.result,
        evaluationId: entry.evaluation_id,
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
// Body: { lab_day_id, student_id, station_id }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { lab_day_id, student_id, station_id } = body;

    if (!lab_day_id || !student_id || !station_id) {
      return NextResponse.json(
        { success: false, error: 'lab_day_id, student_id, and station_id are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Check if an entry already exists
    const { data: existing } = await supabase
      .from('lab_day_student_queue')
      .select('id, status')
      .eq('lab_day_id', lab_day_id)
      .eq('student_id', student_id)
      .eq('station_id', station_id)
      .maybeSingle();

    if (existing) {
      // If already in_progress or completed, don't create a new one
      if (existing.status === 'in_progress') {
        return NextResponse.json({ success: true, entry: existing, message: 'Already in progress' });
      }
      // If completed, create a new attempt
    }

    const { data: entry, error } = await supabase
      .from('lab_day_student_queue')
      .insert({
        lab_day_id,
        student_id,
        station_id,
        status: 'in_progress',
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
// ---------------------------------------------------------------------------
export async function PUT(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { id, status, result, evaluation_id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Queue entry id is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (result !== undefined) updates.result = result;
    if (evaluation_id !== undefined) updates.evaluation_id = evaluation_id;
    if (status === 'completed') updates.completed_at = new Date().toISOString();

    const { data: entry, error } = await supabase
      .from('lab_day_student_queue')
      .update(updates)
      .eq('id', id)
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
