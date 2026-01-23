import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - Get all ready statuses for a lab day
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const labDayId = searchParams.get('labDayId');

  if (!labDayId) {
    return NextResponse.json({ success: false, error: 'labDayId is required' }, { status: 400 });
  }

  try {
    // Get ready statuses with station info
    const { data, error } = await supabase
      .from('lab_timer_ready_status')
      .select(`
        *,
        station:lab_stations(id, station_number, station_type, room_assignment)
      `)
      .eq('lab_day_id', labDayId);

    if (error) throw error;

    // Also get all stations for this lab day to show unregistered ones
    const { data: allStations, error: stationsError } = await supabase
      .from('lab_stations')
      .select('id, station_number, station_type, room_assignment')
      .eq('lab_day_id', labDayId)
      .order('station_number');

    if (stationsError) throw stationsError;

    return NextResponse.json({
      success: true,
      readyStatuses: data || [],
      allStations: allStations || []
    });
  } catch (error) {
    console.error('Error fetching ready statuses:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch ready statuses' }, { status: 500 });
  }
}

// POST - Set ready status for a station
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { labDayId, stationId, userEmail, userName, isReady } = body;

    if (!labDayId || !stationId || !userEmail) {
      return NextResponse.json({
        success: false,
        error: 'labDayId, stationId, and userEmail are required'
      }, { status: 400 });
    }

    // Upsert ready status
    const { data, error } = await supabase
      .from('lab_timer_ready_status')
      .upsert({
        lab_day_id: labDayId,
        station_id: stationId,
        user_email: userEmail,
        user_name: userName || userEmail.split('@')[0],
        is_ready: isReady ?? false
      }, {
        onConflict: 'lab_day_id,station_id'
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, status: data });
  } catch (error) {
    console.error('Error setting ready status:', error);
    return NextResponse.json({ success: false, error: 'Failed to set ready status' }, { status: 500 });
  }
}

// DELETE - Clear all ready statuses for a lab day (called when timer resets)
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const labDayId = searchParams.get('labDayId');

  if (!labDayId) {
    return NextResponse.json({ success: false, error: 'labDayId is required' }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from('lab_timer_ready_status')
      .delete()
      .eq('lab_day_id', labDayId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing ready statuses:', error);
    return NextResponse.json({ success: false, error: 'Failed to clear ready statuses' }, { status: 500 });
  }
}
