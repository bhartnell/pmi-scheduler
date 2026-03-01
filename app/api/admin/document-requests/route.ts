import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';

/**
 * GET /api/admin/document-requests
 * Returns all document requests with optional ?status=pending|submitted|completed filter.
 *
 * POST /api/admin/document-requests
 * Create a new document request for a student.
 * Body: { student_id, document_type, description?, due_date? }
 */

async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    let query = supabase
      .from('document_requests')
      .select(`
        id,
        document_type,
        description,
        due_date,
        status,
        requested_by,
        created_at,
        student:students!document_requests_student_id_fkey(
          id,
          first_name,
          last_name,
          email
        )
      `)
      .order('created_at', { ascending: false });

    if (statusFilter && ['pending', 'submitted', 'completed'].includes(statusFilter)) {
      query = query.eq('status', statusFilter);
    }

    const { data: requests, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, requests: requests || [] });
  } catch (error) {
    console.error('Error fetching document requests:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch document requests' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { student_id, document_type, description, due_date } = body;

    if (!student_id) {
      return NextResponse.json(
        { success: false, error: 'student_id is required' },
        { status: 400 }
      );
    }
    if (!document_type?.trim()) {
      return NextResponse.json(
        { success: false, error: 'document_type is required' },
        { status: 400 }
      );
    }

    // Verify student exists
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('id', student_id)
      .single();

    if (studentError || !student) {
      return NextResponse.json(
        { success: false, error: 'Student not found' },
        { status: 404 }
      );
    }

    const { data: docRequest, error } = await supabase
      .from('document_requests')
      .insert({
        student_id,
        document_type: document_type.trim(),
        description: description?.trim() || null,
        due_date: due_date || null,
        status: 'pending',
        requested_by: currentUser.email,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, request: docRequest }, { status: 201 });
  } catch (error) {
    console.error('Error creating document request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create document request' },
      { status: 500 }
    );
  }
}
