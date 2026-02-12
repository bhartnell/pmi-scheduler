import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

// Create Supabase client lazily to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// GET - List preceptor assignments for an internship
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const internshipId = searchParams.get('internshipId');
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    if (!internshipId) {
      return NextResponse.json({ success: false, error: 'internshipId required' }, { status: 400 });
    }

    let query = supabase
      .from('student_preceptor_assignments')
      .select(`
        *,
        preceptor:field_preceptors(id, first_name, last_name, email, phone, agency_name, station)
      `)
      .eq('internship_id', internshipId)
      .order('role', { ascending: true })
      .order('assigned_date', { ascending: false });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, assignments: data || [] });
  } catch (error: any) {
    console.error('Error fetching preceptor assignments:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to fetch' }, { status: 500 });
  }
}

// POST - Add a preceptor assignment
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { internship_id, preceptor_id, role = 'primary', notes } = body;

    if (!internship_id || !preceptor_id) {
      return NextResponse.json({ success: false, error: 'internship_id and preceptor_id required' }, { status: 400 });
    }

    // If assigning a new primary, deactivate the existing primary
    if (role === 'primary') {
      await supabase
        .from('student_preceptor_assignments')
        .update({
          is_active: false,
          end_date: new Date().toISOString().split('T')[0],
        })
        .eq('internship_id', internship_id)
        .eq('role', 'primary')
        .eq('is_active', true);

      // Also update the legacy preceptor_id on student_internships
      await supabase
        .from('student_internships')
        .update({ preceptor_id, updated_at: new Date().toISOString() })
        .eq('id', internship_id);
    }

    // Insert the new assignment
    const { data, error } = await supabase
      .from('student_preceptor_assignments')
      .upsert({
        internship_id,
        preceptor_id,
        role,
        assigned_date: new Date().toISOString().split('T')[0],
        is_active: true,
        notes: notes || null,
        assigned_by: session.user.email,
      }, {
        onConflict: 'internship_id,preceptor_id,role'
      })
      .select(`
        *,
        preceptor:field_preceptors(id, first_name, last_name, email, phone, agency_name, station)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, assignment: data });
  } catch (error: any) {
    console.error('Error creating preceptor assignment:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to create' }, { status: 500 });
  }
}

// DELETE - Deactivate a preceptor assignment (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabase();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get('id');

    if (!assignmentId) {
      return NextResponse.json({ success: false, error: 'Assignment ID required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('student_preceptor_assignments')
      .update({
        is_active: false,
        end_date: new Date().toISOString().split('T')[0],
      })
      .eq('id', assignmentId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error removing preceptor assignment:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to remove' }, { status: 500 });
  }
}
