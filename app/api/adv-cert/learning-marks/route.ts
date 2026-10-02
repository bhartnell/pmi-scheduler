import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

/**
 * ACLS learning-station tracker. UNOFFICIAL and UNSCORED: Pass or Watch, one
 * mark per student per station, optional note. Own table (acls_learning_marks);
 * never written to any certification table.
 *
 * GET  ?labDayId=  -> { marks[] } for the whole day (hub "Watch" visibility)
 * PUT  { labDayId, stationId, studentId, mark: 'pass'|'watch', note? }
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;
  const labDayId = request.nextUrl.searchParams.get('labDayId');
  if (!labDayId) return NextResponse.json({ success: false, error: 'labDayId required' }, { status: 400 });

  const { data, error } = await getSupabaseAdmin()
    .from('acls_learning_marks')
    .select('id, lab_day_id, station_id, student_id, mark, note, marked_by, updated_at')
    .eq('lab_day_id', labDayId);
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
  const { labDayId, stationId, studentId, mark } = body;
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null;
  if (!labDayId || !stationId || !studentId || !['pass', 'watch'].includes(mark)) {
    return NextResponse.json({ success: false, error: 'labDayId, stationId, studentId and mark (pass|watch) required' }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from('acls_learning_marks')
    .upsert(
      {
        lab_day_id: labDayId,
        station_id: stationId,
        student_id: studentId,
        mark,
        note,
        marked_by: auth.user.email,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'station_id,student_id' }
    )
    .select('id, lab_day_id, station_id, student_id, mark, note, marked_by, updated_at')
    .single();
  if (error) {
    console.error('learning-marks PUT failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to save mark' }, { status: 500 });
  }
  return NextResponse.json({ success: true, mark: data });
}
