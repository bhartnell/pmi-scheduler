import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - Get attendance for a field trip
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const fieldTripId = searchParams.get('fieldTripId');

    if (!fieldTripId) {
      return NextResponse.json({ error: 'fieldTripId is required' }, { status: 400 });
    }

    const { data: attendance, error } = await supabase
      .from('field_trip_attendance')
      .select('*')
      .eq('field_trip_id', fieldTripId);

    if (error) {
      // Table might not exist yet
      if (error.code === '42P01') {
        return NextResponse.json({ success: true, attendance: [] });
      }
      throw error;
    }

    return NextResponse.json({ success: true, attendance: attendance || [] });
  } catch (error: any) {
    console.error('Error fetching attendance:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch attendance' },
      { status: 500 }
    );
  }
}

// POST - Upsert attendance record (toggle or update)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { field_trip_id, student_id, attended, notes } = body;

    if (!field_trip_id || !student_id || attended === undefined) {
      return NextResponse.json(
        { success: false, error: 'field_trip_id, student_id, and attended are required' },
        { status: 400 }
      );
    }

    const { data: record, error } = await supabase
      .from('field_trip_attendance')
      .upsert(
        {
          field_trip_id,
          student_id,
          attended,
          notes: notes || null,
          marked_by: session.user.email,
          marked_at: new Date().toISOString(),
        },
        { onConflict: 'field_trip_id,student_id' }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, record });
  } catch (error: any) {
    console.error('Error updating attendance:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to update attendance' },
      { status: 500 }
    );
  }
}

// PATCH - Bulk update attendance for a field trip
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { field_trip_id, attendance } = body;
    // attendance is an array of { student_id: string, attended: boolean }

    if (!field_trip_id || !Array.isArray(attendance)) {
      return NextResponse.json(
        { success: false, error: 'field_trip_id and attendance array are required' },
        { status: 400 }
      );
    }

    // Upsert all attendance records
    const records = attendance.map((a: { student_id: string; attended: boolean }) => ({
      field_trip_id,
      student_id: a.student_id,
      attended: a.attended,
      marked_by: session.user?.email || null,
      marked_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('field_trip_attendance')
      .upsert(records, { onConflict: 'field_trip_id,student_id' });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error bulk updating attendance:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to update attendance' },
      { status: 500 }
    );
  }
}
