import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';

/**
 * PUT /api/admin/document-requests/[id]
 * Review a student document: approve or reject with optional notes.
 * Body: { action: 'approve' | 'reject', review_notes?: string }
 *
 * This updates the matching student_documents row.
 * The [id] here refers to a student_documents.id (the document being reviewed).
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action, review_notes } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'action must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Fetch the document to verify it exists
    const { data: document, error: fetchError } = await supabase
      .from('student_documents')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    if (document.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'This document has already been reviewed' },
        { status: 409 }
      );
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const { error: updateError } = await supabase
      .from('student_documents')
      .update({
        status: newStatus,
        reviewed_by: currentUser.email,
        reviewed_at: new Date().toISOString(),
        review_notes: review_notes?.trim() || null,
      })
      .eq('id', id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: `Document ${newStatus}.`,
      status: newStatus,
    });
  } catch (error) {
    console.error('Error reviewing document:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to review document' },
      { status: 500 }
    );
  }
}
