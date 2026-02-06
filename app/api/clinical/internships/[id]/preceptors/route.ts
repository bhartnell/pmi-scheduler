import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch preceptor assignments for internship
// Joins with field_preceptors for name/credentials
// Sorts: active first, then by role (primary > secondary > tertiary), then start_date desc
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: internshipId } = await params;

    const { data, error } = await supabase
      .from('student_preceptor_assignments')
      .select(`
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
      `)
      .eq('internship_id', internshipId)
      .order('is_active', { ascending: false })
      .order('role', { ascending: true })
      .order('start_date', { ascending: false });

    if (error) {
      console.error('Error fetching preceptor assignments:', error);
      throw error;
    }

    return NextResponse.json({ success: true, assignments: data || [] });
  } catch (error: any) {
    console.error('Error in GET /api/clinical/internships/[id]/preceptors:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch preceptor assignments' },
      { status: 500 }
    );
  }
}

// POST - Create new preceptor assignment
// Body: { preceptor_id, role, start_date, notes }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: internshipId } = await params;
    const body = await request.json();
    const { preceptor_id, role = 'primary', start_date, notes } = body;

    if (!preceptor_id) {
      return NextResponse.json(
        { success: false, error: 'preceptor_id is required' },
        { status: 400 }
      );
    }

    // If assigning a new primary, deactivate existing primary
    if (role === 'primary') {
      await supabase
        .from('student_preceptor_assignments')
        .update({
          is_active: false,
          end_date: new Date().toISOString().split('T')[0],
        })
        .eq('internship_id', internshipId)
        .eq('role', 'primary')
        .eq('is_active', true);

      // Also update legacy preceptor_id on student_internships for backward compatibility
      await supabase
        .from('student_internships')
        .update({ preceptor_id, updated_at: new Date().toISOString() })
        .eq('id', internshipId);
    }

    const { data, error } = await supabase
      .from('student_preceptor_assignments')
      .insert({
        internship_id: internshipId,
        preceptor_id,
        role,
        start_date: start_date || new Date().toISOString().split('T')[0],
        notes: notes || null,
        is_active: true,
      })
      .select(`
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
      `)
      .single();

    if (error) {
      console.error('Error creating preceptor assignment:', error);
      throw error;
    }

    return NextResponse.json({ success: true, assignment: data });
  } catch (error: any) {
    console.error('Error in POST /api/clinical/internships/[id]/preceptors:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to create preceptor assignment' },
      { status: 500 }
    );
  }
}

// PATCH - Update assignment (end it or change role)
// Body: { assignmentId, end_date?, is_active?, role?, notes? }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await params; // Await params even though we don't use it, for consistency
    const body = await request.json();
    const { assignmentId, end_date, is_active, role, notes } = body;

    if (!assignmentId) {
      return NextResponse.json(
        { success: false, error: 'assignmentId is required' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (end_date !== undefined) updateData.end_date = end_date;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (role !== undefined) updateData.role = role;
    if (notes !== undefined) updateData.notes = notes;

    const { data, error } = await supabase
      .from('student_preceptor_assignments')
      .update(updateData)
      .eq('id', assignmentId)
      .select(`
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
      `)
      .single();

    if (error) {
      console.error('Error updating preceptor assignment:', error);
      throw error;
    }

    return NextResponse.json({ success: true, assignment: data });
  } catch (error: any) {
    console.error('Error in PATCH /api/clinical/internships/[id]/preceptors:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to update preceptor assignment' },
      { status: 500 }
    );
  }
}
