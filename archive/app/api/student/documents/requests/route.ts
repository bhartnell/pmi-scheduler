import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/student/documents/requests
 * Returns document requests for the authenticated student.
 *
 * POST /api/student/documents/requests
 * Mark a document request as submitted by linking it to an uploaded document.
 * Body: { request_id, document_id }
 */

async function getStudentRecord(supabase: ReturnType<typeof getSupabaseAdmin>, email: string) {
  const { data: labUser } = await supabase
    .from('lab_users')
    .select('id, role')
    .ilike('email', email)
    .single();

  if (!labUser || labUser.role !== 'student') return null;

  const { data: student } = await supabase
    .from('students')
    .select('id, first_name, last_name, email')
    .ilike('email', email)
    .single();

  return student;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const student = await getStudentRecord(supabase, session.user.email);

    if (!student) {
      return NextResponse.json(
        { success: false, error: 'Student record not found' },
        { status: 404 }
      );
    }

    const { data: requests, error } = await supabase
      .from('document_requests')
      .select(`
        id,
        document_type,
        description,
        due_date,
        status,
        requested_by,
        created_at
      `)
      .eq('student_id', student.id)
      .order('created_at', { ascending: false });

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
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const student = await getStudentRecord(supabase, session.user.email);

    if (!student) {
      return NextResponse.json(
        { success: false, error: 'Student record not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { request_id } = body;

    if (!request_id) {
      return NextResponse.json(
        { success: false, error: 'request_id is required' },
        { status: 400 }
      );
    }

    // Verify the request belongs to this student and is still pending
    const { data: docRequest, error: fetchError } = await supabase
      .from('document_requests')
      .select('id, status')
      .eq('id', request_id)
      .eq('student_id', student.id)
      .single();

    if (fetchError || !docRequest) {
      return NextResponse.json(
        { success: false, error: 'Document request not found' },
        { status: 404 }
      );
    }

    if (docRequest.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'This request has already been submitted or completed' },
        { status: 409 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from('document_requests')
      .update({ status: 'submitted' })
      .eq('id', request_id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, request: updated });
  } catch (error) {
    console.error('Error updating document request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update document request' },
      { status: 500 }
    );
  }
}
