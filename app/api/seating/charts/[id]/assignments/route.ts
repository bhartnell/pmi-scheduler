import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chartId } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
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
      .eq('seating_chart_id', chartId)
      .order('table_number')
      .order('seat_position');

    if (error) throw error;

    return NextResponse.json({ success: true, assignments: data });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch assignments' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chartId } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { assignments } = body;

    if (!Array.isArray(assignments)) {
      return NextResponse.json({ success: false, error: 'Assignments must be an array' }, { status: 400 });
    }

    // Delete all existing assignments for this chart
    const { error: deleteError } = await supabase
      .from('seat_assignments')
      .delete()
      .eq('seating_chart_id', chartId);

    if (deleteError) throw deleteError;

    // Insert new assignments if any
    if (assignments.length > 0) {
      const assignmentsToInsert = assignments.map((a: any) => ({
        seating_chart_id: chartId,
        student_id: a.student_id,
        table_number: a.table_number,
        seat_position: a.seat_position,
        row_number: a.row_number,
        is_overflow: a.is_overflow || false,
        is_manual_override: a.is_manual_override || true,
        notes: a.notes || null,
      }));

      const { error: insertError } = await supabase
        .from('seat_assignments')
        .insert(assignmentsToInsert);

      if (insertError) throw insertError;
    }

    // Fetch updated assignments
    const { data: updatedAssignments, error: fetchError } = await supabase
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
      .eq('seating_chart_id', chartId)
      .order('table_number')
      .order('seat_position');

    if (fetchError) throw fetchError;

    // Update chart timestamp
    await supabase
      .from('seating_charts')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chartId);

    return NextResponse.json({ success: true, assignments: updatedAssignments });
  } catch (error) {
    console.error('Error updating assignments:', error);
    return NextResponse.json({ success: false, error: 'Failed to update assignments' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chartId } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('seat_assignments')
      .delete()
      .eq('seating_chart_id', chartId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing assignments:', error);
    return NextResponse.json({ success: false, error: 'Failed to clear assignments' }, { status: 500 });
  }
}
