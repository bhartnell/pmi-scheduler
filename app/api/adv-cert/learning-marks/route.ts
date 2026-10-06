import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

/**
 * ACLS learning-station tracker. UNOFFICIAL and UNSCORED: Pass or Watch, optional
 * note. Own table (acls_learning_marks); never written to any certification table.
 *
 * Two grains coexist:
 *  - group row: one per (station, lab_group), carries optional team_lead_id
 *  - legacy student row: one per (station, student), student_id set, lab_group_id null
 *
 * GET  ?labDayId=  -> { marks[] } for the whole day
 * GET  ?cohortId=[&certCourse=acls] -> { marks[] } cohort-and-course scoped, newest first (watch list)
 * PUT  { labDayId, stationId, labGroupId | studentId, mark: 'pass'|'watch', note?, teamLeadId? }
 */
const COLS = 'id, lab_day_id, station_id, student_id, lab_group_id, team_lead_id, cert_course, mark, note, marked_by, created_at, updated_at';

export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;
  const labDayId = request.nextUrl.searchParams.get('labDayId');
  const cohortId = request.nextUrl.searchParams.get('cohortId');
  const certCourse = request.nextUrl.searchParams.get('certCourse') || 'acls';
  if (!labDayId && !cohortId) {
    return NextResponse.json({ success: false, error: 'labDayId or cohortId required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  let query;
  if (labDayId) {
    query = supabase.from('acls_learning_marks').select(COLS).eq('lab_day_id', labDayId);
  } else {
    const { data: days, error: dayErr } = await supabase.from('lab_days').select('id').eq('cohort_id', cohortId!);
    if (dayErr) {
      console.error('learning-marks GET lab_days failed:', dayErr);
      return NextResponse.json({ success: false, error: 'Failed to load marks' }, { status: 500 });
    }
    const ids = (days || []).map((d: { id: string }) => d.id);
    if (ids.length === 0) return NextResponse.json({ success: true, marks: [] });
    query = supabase
      .from('acls_learning_marks')
      .select(COLS)
      .in('lab_day_id', ids)
      .eq('cert_course', certCourse)
      .order('updated_at', { ascending: false });
  }
  const { data, error } = await query;
  if (error) {
    console.error('learning-marks GET failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to load marks' }, { status: 500 });
  }
  return NextResponse.json({ success: true, marks: data || [] });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid body' }, { status: 400 });
  }
  const { labDayId, stationId, studentId, labGroupId, mark } = body;
  const teamLeadId = typeof body.teamLeadId === 'string' && body.teamLeadId ? body.teamLeadId : null;
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null;
  if (!labDayId || !stationId || !(labGroupId || studentId) || !['pass', 'watch'].includes(mark)) {
    return NextResponse.json({ success: false, error: 'labDayId, stationId, labGroupId or studentId, and mark (pass|watch) required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Lab day must exist; course defaults to acls, PALS callers pass certCourse.
  const { data: day } = await supabase.from('lab_days').select('id').eq('id', labDayId).maybeSingle();
  if (!day) return NextResponse.json({ success: false, error: 'lab day not found' }, { status: 404 });
  const certCourse = body.certCourse === 'pals' ? 'pals' : 'acls';

  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    lab_day_id: labDayId,
    station_id: stationId,
    mark,
    note,
    marked_by: auth.user.email,
    updated_at: now,
  };
  let match: Record<string, string>;
  if (labGroupId) {
    row.lab_group_id = labGroupId;
    row.team_lead_id = teamLeadId;
    row.cert_course = certCourse;
    match = { station_id: stationId, lab_group_id: labGroupId };
  } else {
    row.student_id = studentId;
    match = { station_id: stationId, student_id: studentId };
  }

  // The unique keys are partial indexes, which PostgREST upsert cannot target:
  // update the existing row if there is one, otherwise insert.
  const { data: existing, error: findErr } = await supabase
    .from('acls_learning_marks')
    .select('id')
    .match(match)
    .maybeSingle();
  if (findErr) {
    console.error('learning-marks PUT lookup failed:', findErr);
    return NextResponse.json({ success: false, error: 'Failed to save mark' }, { status: 500 });
  }

  const { data, error } = existing
    ? await supabase.from('acls_learning_marks').update(row).eq('id', existing.id).select(COLS).single()
    : await supabase.from('acls_learning_marks').insert(row).select(COLS).single();
  if (error) {
    console.error('learning-marks PUT failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to save mark' }, { status: 500 });
  }
  return NextResponse.json({ success: true, mark: data });
}
