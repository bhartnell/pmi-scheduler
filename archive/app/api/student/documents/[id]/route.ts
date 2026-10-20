import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/student/documents/[id]
 * Returns a single document detail for the authenticated student.
 *
 * DELETE /api/student/documents/[id]
 * Removes a pending document uploaded by the authenticated student.
 * Only allowed if the document status is 'pending' and it was uploaded by this student.
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    const { data: document, error } = await supabase
      .from('student_documents')
      .select(`
        id,
        document_type,
        name,
        file_url,
        status,
        uploaded_by,
        reviewed_by,
        reviewed_at,
        review_notes,
        expires_at,
        created_at
      `)
      .eq('id', id)
      .eq('student_id', student.id)
      .single();

    if (error || !document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, document });
  } catch (error) {
    console.error('Error fetching document:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch document' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    // Verify the document belongs to this student and is pending
    const { data: document, error: fetchError } = await supabase
      .from('student_documents')
      .select('id, status, uploaded_by')
      .eq('id', id)
      .eq('student_id', student.id)
      .single();

    if (fetchError || !document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    if (document.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Only pending documents can be deleted' },
        { status: 409 }
      );
    }

    if (document.uploaded_by !== session.user.email) {
      return NextResponse.json(
        { success: false, error: 'You can only delete documents you uploaded' },
        { status: 403 }
      );
    }

    const { error: deleteError } = await supabase
      .from('student_documents')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true, message: 'Document deleted' });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
