// app/api/lab-management/cohorts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabase
      .from('cohorts')
      .select(`
        *,
        program:programs(*)
      `)
      .eq('id', params.id)
      .single();

    if (error) throw error;

    // Get student count
    const { count } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('cohort_id', params.id)
      .eq('status', 'active');

    return NextResponse.json({ 
      success: true, 
      cohort: { ...data, student_count: count || 0 } 
    });
  } catch (error) {
    console.error('Error fetching cohort:', error);
    return NextResponse.json({ success: false, error: 'Cohort not found' }, { status: 404 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { cohort_number, start_date, expected_end_date, is_active } = body;

    const updateData: any = {};
    if (cohort_number !== undefined) updateData.cohort_number = cohort_number;
    if (start_date !== undefined) updateData.start_date = start_date;
    if (expected_end_date !== undefined) updateData.expected_end_date = expected_end_date;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await supabase
      .from('cohorts')
      .update(updateData)
      .eq('id', params.id)
      .select(`
        *,
        program:programs(*)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, cohort: data });
  } catch (error) {
    console.error('Error updating cohort:', error);
    return NextResponse.json({ success: false, error: 'Failed to update cohort' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if cohort has students
    const { count } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('cohort_id', params.id);

    if (count && count > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete cohort with students. Remove students first or mark cohort as inactive.' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('cohorts')
      .delete()
      .eq('id', params.id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Cohort deleted successfully' });
  } catch (error) {
    console.error('Error deleting cohort:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete cohort' }, { status: 500 });
  }
}
