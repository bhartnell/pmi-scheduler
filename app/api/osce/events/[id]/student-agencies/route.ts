import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - Admin: list student-agency mappings for this event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('osce_student_agencies')
      .select('*')
      .eq('event_id', id)
      .order('student_name', { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch student agencies' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, student_agencies: data || [] });
  } catch (error) {
    console.error('Error fetching student agencies:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Admin: add a student-agency mapping for this event
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const { student_name, agency, relationship } = body;

    if (!student_name || !agency) {
      return NextResponse.json(
        { success: false, error: 'Student name and agency are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('osce_student_agencies')
      .insert({
        event_id: id,
        student_name: student_name.trim(),
        agency: agency.trim(),
        relationship: relationship?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting student agency:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to add student agency mapping' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, student_agency: data });
  } catch (error) {
    console.error('Error adding student agency:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Admin: remove a student-agency mapping
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const { id: mappingId } = body;

    if (!mappingId) {
      return NextResponse.json(
        { success: false, error: 'ID is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Delete with event_id check for safety
    const { error } = await supabase
      .from('osce_student_agencies')
      .delete()
      .eq('id', mappingId)
      .eq('event_id', id);

    if (error) {
      console.error('Error deleting student agency:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete student agency mapping' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting student agency:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
