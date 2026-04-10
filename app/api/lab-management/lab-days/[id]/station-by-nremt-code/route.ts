import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuthOrVolunteerToken } from '@/lib/api-auth';
import type { VolunteerTokenResult } from '@/lib/api-auth';

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
  const auth = await requireAuthOrVolunteerToken(request, 'instructor');
  if (auth instanceof NextResponse) return auth;

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

    const { data, error } = await supabase
      .from('lab_stations')
      .select('id, station_number, skill_name, custom_title, skill_sheet:skill_sheets!inner(id, nremt_code, skill_name)')
      .eq('lab_day_id', labDayId)
      .eq('skill_sheet.nremt_code', code)
      .maybeSingle();

    if (error) {
      // maybeSingle returns null without error when zero rows, so a real error here is a fault
      console.error('station-by-nremt-code query error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, station: data || null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to query station';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
