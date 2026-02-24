import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

const ASSIGNMENT_SELECT = `
  id,
  internship_id,
  preceptor_id,
  role,
  start_date,
  end_date,
  notes,
  is_active,
  created_at,
  updated_at,
  preceptor:field_preceptors(
    id,
    first_name,
    last_name,
    email,
    phone,
    agency_name,
    station,
    credentials
  )
`;

// PUT - Update assignment (change role, dates, notes)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assignmentId } = await params;
    const body = await request.json();
    const { role, start_date, end_date, notes, is_active } = body;

    const updateData: Record<string, unknown> = {};
    if (role !== undefined) updateData.role = role;
    if (start_date !== undefined) updateData.start_date = start_date;
    if (end_date !== undefined) updateData.end_date = end_date;
    if (notes !== undefined) updateData.notes = notes;
    if (is_active !== undefined) updateData.is_active = is_active;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('student_preceptor_assignments')
      .update(updateData)
      .eq('id', assignmentId)
      .select(ASSIGNMENT_SELECT)
      .single();

    if (error) {
      console.error('Error updating preceptor assignment:', error);
      throw error;
    }

    return NextResponse.json({ success: true, assignment: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update preceptor assignment';
    console.error('Error in PUT /api/clinical/internships/[id]/preceptors/[assignmentId]:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE - Soft delete: set end_date to today and is_active = false
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assignmentId } = await params;
    const today = new Date().toISOString().split('T')[0];

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('student_preceptor_assignments')
      .update({
        is_active: false,
        end_date: today,
      })
      .eq('id', assignmentId)
      .select(ASSIGNMENT_SELECT)
      .single();

    if (error) {
      console.error('Error ending preceptor assignment:', error);
      throw error;
    }

    return NextResponse.json({ success: true, assignment: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to end preceptor assignment';
    console.error('Error in DELETE /api/clinical/internships/[id]/preceptors/[assignmentId]:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
