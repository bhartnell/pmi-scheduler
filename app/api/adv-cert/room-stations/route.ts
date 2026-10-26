import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

/**
 * GET /api/adv-cert/room-stations?labDayId=
 *
 * READ-ONLY. Feeds the coordinator "Rooms" panel (PALS P2c/4). Rooms is not a
 * second store: this returns the same lab_stations rows the hub renders
 * (scenario stations only), each flagged with whether a graded attempt already
 * exists for it (pals_test_attempts for PALS, adv_cert_test_attempts for ACLS)
 * and who graded it. The panel's instructor picker writes through the existing
 * PATCH /api/lab-management/stations/[id] and skips graded stations, so a
 * grader is never overwritten.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const labDayId = request.nextUrl.searchParams.get('labDayId');
  if (!labDayId) {
    return NextResponse.json({ success: false, error: 'labDayId is required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: stations, error } = await supabase
      .from('lab_stations')
      .select(`
        id, lab_day_id, station_number, room, custom_title, station_type,
        instructor_name, instructor_email, rotation_minutes, debrief_minutes,
        scenario:scenarios(id, title, case_code)
      `)
      .eq('lab_day_id', labDayId)
      .eq('station_type', 'scenario')
      .order('station_number', { ascending: true });
    if (error) throw error;

    const ids = (stations || []).map((s) => s.id);
    const gradedBy = new Map<string, string | null>();
    if (ids.length) {
      const [pals, acls] = await Promise.all([
        supabase.from('pals_test_attempts').select('lab_station_id, instructor_id').in('lab_station_id', ids),
        supabase.from('adv_cert_test_attempts').select('lab_station_id, grader_id').in('lab_station_id', ids),
      ]);
      if (pals.error) throw pals.error;
      if (acls.error) throw acls.error;

      const graderIds = new Set<string>();
      const rows: { station: string; grader: string | null }[] = [];
      for (const a of pals.data || []) rows.push({ station: a.lab_station_id as string, grader: (a.instructor_id as string | null) ?? null });
      for (const a of acls.data || []) rows.push({ station: a.lab_station_id as string, grader: (a.grader_id as string | null) ?? null });
      for (const r of rows) if (r.grader) graderIds.add(r.grader);

      const names = new Map<string, string>();
      if (graderIds.size) {
        const { data: users } = await supabase.from('lab_users').select('id, name').in('id', [...graderIds]);
        for (const u of users || []) names.set(u.id as string, (u.name as string) || '');
      }
      for (const r of rows) {
        const label = r.grader ? names.get(r.grader) || null : null;
        // keep a real name if any attempt for the station has one
        if (!gradedBy.has(r.station) || (!gradedBy.get(r.station) && label)) gradedBy.set(r.station, label);
      }
    }

    return NextResponse.json({
      success: true,
      stations: (stations || []).map((s) => ({
        ...s,
        graded: gradedBy.has(s.id),
        graded_by: gradedBy.get(s.id) ?? null,
      })),
    });
  } catch (err) {
    console.error('Error loading room stations:', err);
    return NextResponse.json({ success: false, error: 'Failed to load room stations' }, { status: 500 });
  }
}
