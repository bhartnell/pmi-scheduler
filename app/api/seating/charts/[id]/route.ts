import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();

    // Get chart with related data
    const { data: chart, error: chartError } = await supabase
      .from('seating_charts')
      .select(`
        *,
        cohort:cohorts(
          id,
          cohort_number,
          program:programs(abbreviation)
        ),
        classroom:classrooms(*)
      `)
      .eq('id', id)
      .single();

    if (chartError) throw chartError;

    // Get seat assignments with student details
    const { data: assignments, error: assignError } = await supabase
      .from('seat_assignments')
      .select(`
        *,
        student:students(
          id,
          first_name,
          last_name,
          agency,
          photo_url
        )
      `)
      .eq('seating_chart_id', id)
      .order('table_number')
      .order('seat_position');

    if (assignError) throw assignError;

    // Get students in this cohort for the unassigned list
    const { data: allStudents, error: studentsError } = await supabase
      .from('students')
      .select(`
        id,
        first_name,
        last_name,
        agency,
        photo_url
      `)
      .eq('cohort_id', chart.cohort_id)
      .eq('status', 'active')
      .order('last_name');

    if (studentsError) throw studentsError;

    // Get learning styles for all students
    const studentIds = allStudents?.map(s => s.id) || [];
    const { data: learningStyles } = await supabase
      .from('student_learning_styles')
      .select('student_id, primary_style, social_style')
      .in('student_id', studentIds);

    // Get seating preferences for conflict detection
    const { data: preferences } = await supabase
      .from('seating_preferences')
      .select('student_id, other_student_id, preference_type')
      .or(`student_id.in.(${studentIds.join(',')}),other_student_id.in.(${studentIds.join(',')})`);

    // Find unassigned students
    const assignedStudentIds = new Set(assignments?.map(a => a.student_id) || []);
    const unassignedStudents = allStudents?.filter(s => !assignedStudentIds.has(s.id)) || [];

    return NextResponse.json({
      success: true,
      chart,
      assignments: assignments || [],
      students: allStudents || [],
      unassignedStudents,
      learningStyles: learningStyles || [],
      preferences: preferences || [],
    });
  } catch (error) {
    console.error('Error fetching seating chart:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch seating chart' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // If setting this chart as active, deactivate others for same cohort
    if (body.is_active) {
      const { data: chart } = await supabase
        .from('seating_charts')
        .select('cohort_id')
        .eq('id', id)
        .single();

      if (chart) {
        await supabase
          .from('seating_charts')
          .update({ is_active: false })
          .eq('cohort_id', chart.cohort_id)
          .neq('id', id);
      }
    }

    const { data, error } = await supabase
      .from('seating_charts')
      .update({
        name: body.name,
        is_active: body.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, chart: data });
  } catch (error) {
    console.error('Error updating seating chart:', error);
    return NextResponse.json({ success: false, error: 'Failed to update seating chart' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Delete assignments first (should cascade but being explicit)
    await supabase
      .from('seat_assignments')
      .delete()
      .eq('seating_chart_id', id);

    const { error } = await supabase
      .from('seating_charts')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting seating chart:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete seating chart' }, { status: 500 });
  }
}
