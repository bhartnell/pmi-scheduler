import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

// Create Supabase client lazily to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// GET - Get instructors for a station
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const stationId = searchParams.get('stationId');

    if (!stationId) {
      return NextResponse.json({ success: false, error: 'stationId is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('station_instructors')
      .select('*')
      .eq('station_id', stationId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, instructors: data || [] });
  } catch (error: any) {
    console.error('Error fetching station instructors:', error);
    // Handle table not existing
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return NextResponse.json({ success: true, instructors: [], tableExists: false });
    }
    return NextResponse.json({ success: false, error: 'Failed to fetch station instructors' }, { status: 500 });
  }
}

// POST - Add instructor to station
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { stationId, userId, userEmail, userName, isPrimary } = body;

    if (!stationId || !userEmail) {
      return NextResponse.json({
        success: false,
        error: 'stationId and userEmail are required'
      }, { status: 400 });
    }

    // If setting as primary, unset any existing primary
    if (isPrimary) {
      await supabase
        .from('station_instructors')
        .update({ is_primary: false })
        .eq('station_id', stationId);
    }

    // Upsert the instructor
    const { data, error } = await supabase
      .from('station_instructors')
      .upsert({
        station_id: stationId,
        user_id: userId || null,
        user_email: userEmail,
        user_name: userName || userEmail.split('@')[0],
        is_primary: isPrimary || false
      }, {
        onConflict: 'station_id,user_email'
      })
      .select()
      .single();

    if (error) throw error;

    // Also update the main station's instructor fields for backwards compatibility
    if (isPrimary) {
      await supabase
        .from('lab_stations')
        .update({
          instructor_name: userName || userEmail.split('@')[0],
          instructor_email: userEmail
        })
        .eq('id', stationId);
    }

    return NextResponse.json({ success: true, instructor: data });
  } catch (error) {
    console.error('Error adding station instructor:', error);
    return NextResponse.json({ success: false, error: 'Failed to add instructor' }, { status: 500 });
  }
}

// DELETE - Remove instructor from station
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabase();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const stationId = searchParams.get('stationId');
    const userEmail = searchParams.get('userEmail');

    if (!stationId || !userEmail) {
      return NextResponse.json({
        success: false,
        error: 'stationId and userEmail are required'
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('station_instructors')
      .delete()
      .eq('station_id', stationId)
      .eq('user_email', userEmail);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing station instructor:', error);
    return NextResponse.json({ success: false, error: 'Failed to remove instructor' }, { status: 500 });
  }
}
