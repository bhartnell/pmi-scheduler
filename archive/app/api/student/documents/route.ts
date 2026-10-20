import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/student/documents
 * Returns documents for the authenticated student.
 * Query params: ?type=certificate|transcript|... &status=pending|approved|...
 *
 * POST /api/student/documents
 * Upload a new document for the authenticated student.
 * Body: { document_type, name, file_url? }
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

    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get('type');
    const statusFilter = searchParams.get('status');

    let query = supabase
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
      .eq('student_id', student.id)
      .order('created_at', { ascending: false });

    if (typeFilter) {
      query = query.eq('document_type', typeFilter);
    }
    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data: documents, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, documents: documents || [] });
  } catch (error) {
    console.error('Error fetching student documents:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch documents' },
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
    const { document_type, name, file_url } = body;

    const validTypes = ['certificate', 'transcript', 'compliance', 'identification', 'medical', 'other'];
    if (!document_type || !validTypes.includes(document_type)) {
      return NextResponse.json(
        { success: false, error: 'Valid document_type is required' },
        { status: 400 }
      );
    }
    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Document name is required' },
        { status: 400 }
      );
    }

    const { data: document, error } = await supabase
      .from('student_documents')
      .insert({
        student_id: student.id,
        document_type,
        name: name.trim(),
        file_url: file_url?.trim() || null,
        status: 'pending',
        uploaded_by: session.user.email,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, document }, { status: 201 });
  } catch (error) {
    console.error('Error uploading student document:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}
