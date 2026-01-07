// app/api/lab-management/students/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabase
      .from('students')
      .select(`
        *,
        cohort:cohorts(
          *,
          program:programs(*)
        )
      `)
      .eq('id', params.id)
      .single();

    if (error) throw error;

    // Get team lead count
    const { data: tlCount } = await supabase
      .from('team_lead_counts')
      .select('*')
      .eq('student_id', params.id)
      .single();

    return NextResponse.json({ 
      success: true, 
      student: {
        ...data,
        team_lead_count: tlCount?.team_lead_count || 0,
        last_team_lead_date: tlCount?.last_team_lead_date || null,
      }
    });
  } catch (error) {
    console.error('Error fetching student:', error);
    return NextResponse.json({ success: false, error: 'Student not found' }, { status: 404 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { first_name, last_name, email, cohort_id, photo_url, status, agency, notes } = body;

    const updateData: any = { updated_at: new Date().toISOString() };
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (email !== undefined) updateData.email = email;
    if (cohort_id !== undefined) updateData.cohort_id = cohort_id;
    if (photo_url !== undefined) updateData.photo_url = photo_url;
    if (status !== undefined) updateData.status = status;
    if (agency !== undefined) updateData.agency = agency;
    if (notes !== undefined) updateData.notes = notes;

    const { data, error } = await supabase
      .from('students')
      .update(updateData)
      .eq('id', params.id)
      .select(`
        *,
        cohort:cohorts(
          *,
          program:programs(*)
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
  { params }: { params: { id: string } }
) {
  try {
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', params.id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete student' }, { status: 500 });
  }
}
