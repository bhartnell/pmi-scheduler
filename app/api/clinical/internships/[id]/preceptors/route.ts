import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// GET - Fetch preceptor assignments for internship
// Joins with field_preceptors for name/credentials
// Sorts: active first, then by role (primary > secondary > tertiary), then created_at desc
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('lead_instructor');

    if (auth instanceof NextResponse) return auth;

    const { user } = auth;

    const { id: internshipId } = await params;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('student_preceptor_assignments')
      .select(`
        id,
        internship_id,
        preceptor_id,
        role,
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
      .order('created_at', { ascending: false });

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
// Body: { preceptor_id, role, notes }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();
    const auth = await requireAuth('lead_instructor');

    if (auth instanceof NextResponse) return auth;

    const { user } = auth;

    const { id: internshipId } = await params;
    const body = await request.json();
    const { preceptor_id, role = 'primary', notes } = body;

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
        notes: notes || null,
        is_active: true,
      })
      .select(`
        id,
        internship_id,
        preceptor_id,
        role,
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

// PATCH - Update assignment (deactivate or change role)
// Body: { assignmentId, is_active?, role?, notes? }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();
    const auth = await requireAuth('lead_instructor');

    if (auth instanceof NextResponse) return auth;

    const { user } = auth;

    await params; // Await params even though we don't use it, for consistency
    const body = await request.json();
    const { assignmentId, is_active, role, notes } = body;

    if (!assignmentId) {
      return NextResponse.json(
        { success: false, error: 'assignmentId is required' },
        { status: 400 }
      );
    }

    const updateData: any = {};
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
