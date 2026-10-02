import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// Unofficial ACLS learning-station marks (Pass / Watch). Stored in its own
// table, never a certification table. See migration 20260902_acls_learning_marks.sql.

// GET /api/acls-learning-marks?stationId=... | ?labDayIds=a,b,c
export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const sp = request.nextUrl.searchParams;
  const stationId = sp.get('stationId');
  const labDayIds = (sp.get('labDayIds') || '').split(',').filter(Boolean);
  if (!stationId && labDayIds.length === 0) {
    return NextResponse.json({ success: false, error: 'stationId or labDayIds is required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    let q = supabase
      .from('acls_learning_marks')
      .select(
        `id, lab_day_id, station_id, student_id, mark, note, updated_at,
         student:students(id, first_name, last_name),
         station:lab_stations(id, station_number, custom_title)`
      )
      .order('updated_at', { ascending: false });
    q = stationId ? q.eq('station_id', stationId) : q.in('lab_day_id', labDayIds);
    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json({ success: true, marks: data || [] });
  } catch (error) {
    console.error('Error loading ACLS learning marks:', error);
    return NextResponse.json({ success: false, error: 'Failed to load marks' }, { status: 500 });
  }
}

// PUT /api/acls-learning-marks  { stationId, studentId, mark: 'pass'|'watch', note? }
// One mark per student per station (upsert).
export async function PUT(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { stationId, studentId, mark } = body as { stationId?: string; studentId?: string; mark?: string };
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;
    if (!stationId || !studentId) {
      return NextResponse.json({ success: false, error: 'stationId and studentId are required' }, { status: 400 });
    }
    if (mark !== 'pass' && mark !== 'watch') {
      return NextResponse.json({ success: false, error: "mark must be 'pass' or 'watch'" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: station, error: stErr } = await supabase
      .from('lab_stations')
      .select('id, lab_day_id')
      .eq('id', stationId)
      .single();
    if (stErr || !station) {
      return NextResponse.json({ success: false, error: 'Station not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('acls_learning_marks')
      .upsert(
        {
          lab_day_id: station.lab_day_id,
          station_id: stationId,
          student_id: studentId,
          mark,
          note,
          marked_by: auth.user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'station_id,student_id' }
      )
      .select('id, station_id, student_id, mark, note, updated_at')
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, mark: data });
  } catch (error) {
    console.error('Error saving ACLS learning mark:', error);
    return NextResponse.json({ success: false, error: 'Failed to save mark' }, { status: 500 });
  }
}
