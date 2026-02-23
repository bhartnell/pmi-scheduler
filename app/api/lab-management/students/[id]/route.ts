import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

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
      .from('students')
      .select(`
        *,
        cohort:cohorts(
          id,
          cohort_number,
          program:programs(name, abbreviation)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    const { count: teamLeadCount } = await supabase
      .from('team_lead_log')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', id);

    const { data: lastTL } = await supabase
      .from('team_lead_log')
      .select('date')
      .eq('student_id', id)
      .order('date', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({ 
      success: true, 
      student: {
        ...data,
        team_lead_count: teamLeadCount || 0,
        last_team_lead_date: lastTL?.date || null
      }
    });
  } catch (error) {
    console.error('Error fetching student:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch student' }, { status: 500 });
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

    const body = await request.json();

    const allowedFields: Record<string, unknown> = {};
    if (body.first_name !== undefined) allowedFields.first_name = body.first_name;
    if (body.last_name !== undefined) allowedFields.last_name = body.last_name;
    if (body.email !== undefined) allowedFields.email = body.email;
    if (body.phone !== undefined) allowedFields.phone = body.phone;
    if (body.cohort_id !== undefined) allowedFields.cohort_id = body.cohort_id;
    if (body.status !== undefined) allowedFields.status = body.status;
    if (body.notes !== undefined) allowedFields.notes = body.notes;
    if (body.photo_url !== undefined) allowedFields.photo_url = body.photo_url;
    if (body.removed_from_cohort !== undefined) allowedFields.removed_from_cohort = body.removed_from_cohort;
    if (body.removed_at !== undefined) allowedFields.removed_at = body.removed_at;
    if (body.removed_reason !== undefined) allowedFields.removed_reason = body.removed_reason;

    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('students')
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

    return NextResponse.json({ success: true, student: data });
  } catch (error) {
    console.error('Error updating student:', error);
    return NextResponse.json({ success: false, error: 'Failed to update student' }, { status: 500 });
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

    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting student:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete student' }, { status: 500 });
  }
}
