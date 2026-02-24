import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('lab_days')
      .select(`
        *,
        cohort:cohorts(
          id,
          cohort_number,
          program:programs(name, abbreviation)
        ),
        stations:lab_stations(
          id,
          station_number,
          station_type,
          scenario_id,
          skill_name,
          custom_title,
          instructor_name,
          instructor_email,
          room,
          notes,
          rotation_minutes,
          num_rotations,
          documentation_required,
          platinum_required,
          skill_sheet_url,
          instructions_url,
          station_notes,
          scenario:scenarios(id, title, category, difficulty)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    if (data.stations) {
      data.stations.sort((a: any, b: any) => a.station_number - b.station_number);
    }

    return NextResponse.json({ success: true, labDay: data });
  } catch (error) {
    console.error('Error fetching lab day:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch lab day' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !hasMinRole(callerUser.role, 'instructor')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    const allowedFields: Record<string, unknown> = {};
    if (body.date !== undefined) allowedFields.date = body.date;
    if (body.title !== undefined) allowedFields.title = body.title;
    if (body.notes !== undefined) allowedFields.notes = body.notes;
    if (body.cohort_id !== undefined) allowedFields.cohort_id = body.cohort_id;
    if (body.location_id !== undefined) allowedFields.location_id = body.location_id;
    if (body.status !== undefined) allowedFields.status = body.status;
    if (body.start_time !== undefined) allowedFields.start_time = body.start_time;
    if (body.end_time !== undefined) allowedFields.end_time = body.end_time;

    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('lab_days')
      .update(allowedFields)
      .eq('id', id)
      .select(`
        *,
        cohort:cohorts(
          id,
          cohort_number,
          program:programs(name, abbreviation)
        )
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, labDay: data });
  } catch (error) {
    console.error('Error updating lab day:', error);
    return NextResponse.json({ success: false, error: 'Failed to update lab day' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !hasMinRole(callerUser.role, 'instructor')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await supabase
      .from('lab_days')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting lab day:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete lab day' }, { status: 500 });
  }
}
