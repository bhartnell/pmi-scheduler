import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuthOrVolunteerToken } from '@/lib/api-auth';
import type { VolunteerTokenResult } from '@/lib/api-auth';
import { proctorAuthFallback } from '@/lib/nremt-proctor';
import { choosePartnerStation } from '@/lib/nremt-station-partner';

/**
 * GET /api/lab-management/lab-days/[id]/station-by-nremt-code?code=E203
 *
 * Finds a lab station on the given lab day whose assigned skill sheet has the
 * requested NREMT skill code. Used by the grading UI to discover dual-station
 * pairings (e.g. O2/NRB [E204] -> BVM [E203]) so the examiner can hand the
 * same student off to the paired station.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let auth = await requireAuthOrVolunteerToken(request, 'instructor');
  if (auth instanceof NextResponse) {
    // Second step, only after the instructor check refused: live NREMT-day proctors.
    const proctor = await proctorAuthFallback(auth, { labDayId: (await params).id });
    if (!proctor) return auth;
    auth = proctor;
  }

  const { id: labDayId } = await params;
  const code = request.nextUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.json(
      { success: false, error: 'Missing required query param: code' },
      { status: 400 }
    );
  }

  // Volunteer tokens: scope check
  if ((auth as VolunteerTokenResult).isVolunteerToken) {
    if ((auth as VolunteerTokenResult).labDayId !== labDayId) {
      return NextResponse.json(
        { success: false, error: 'Access denied: lab day not in token scope' },
        { status: 403 }
      );
    }
  }

  try {
    const supabase = getSupabaseAdmin();

    const from = request.nextUrl.searchParams.get('from');

    // No .maybeSingle(): a day can carry two stations for the same skill (extra or retake stations).
    const { data: rows, error } = await supabase
      .from('lab_stations')
      .select('id, station_number, skill_name, custom_title, instructor_name, room, metadata, skill_sheet:skill_sheets!inner(id, nremt_code, skill_name)')
      .eq('lab_day_id', labDayId)
      .eq('skill_sheet.nremt_code', code);

    if (error) {
      // maybeSingle returns null without error when zero rows, so a real error here is a fault
      console.error('station-by-nremt-code query error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const list = rows || [];
    const ids = list.map((r) => r.id);
    if (from && !ids.includes(from)) ids.push(from);
    const nameByStation: Record<string, string> = {};
    if (ids.length > 0) {
      const { data: si } = await supabase
        .from('station_instructors')
        .select('station_id, user_name')
        .in('station_id', ids);
      for (const r of (si || []) as Array<{ station_id: string; user_name: string | null }>) {
        if (r.user_name && !nameByStation[r.station_id]) nameByStation[r.station_id] = r.user_name;
      }
    }
    type Row = (typeof list)[number];
    const describe = (r: { id: string; instructor_name?: string | null; room?: string | null; metadata?: unknown }) => ({
      id: r.id,
      proctor: nameByStation[r.id] || (r.instructor_name || '').trim() || null,
      room: (r.room || '').trim() || null,
      coordinatorStatus: ((r.metadata as Record<string, unknown> | null)?.coordinator_status as string | undefined) || 'open',
    });

    let asking: ReturnType<typeof describe> | null = null;
    if (from) {
      const { data: self } = await supabase
        .from('lab_stations')
        .select('id, instructor_name, room')
        .eq('id', from)
        .eq('lab_day_id', labDayId)
        .maybeSingle();
      if (self) asking = describe(self);
    }

    const candidates = list.map((r: Row) => ({ row: r, station_number: r.station_number, ...describe(r) }));
    const chosen = choosePartnerStation(candidates, asking);
    // Response shape is unchanged: the same station fields as before.
    const station = chosen
      ? (({ id, station_number, skill_name, custom_title, skill_sheet }) => ({ id, station_number, skill_name, custom_title, skill_sheet }))(chosen.row)
      : null;

    return NextResponse.json({ success: true, station });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to query station';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
