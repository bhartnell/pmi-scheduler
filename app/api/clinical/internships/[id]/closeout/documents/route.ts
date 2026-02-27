import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

async function getCallerRole(email: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', email)
    .single();
  return data?.role ?? null;
}

const VALID_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
];

const VALID_DOC_TYPES = ['completion_form', 'preceptor_eval', 'field_docs', 'exam_results', 'other'];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// POST - Upload a closeout document
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const callerRole = await getCallerRole(session.user.email);
    if (!callerRole || !hasMinRole(callerRole, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const docType = (formData.get('doc_type') as string) || 'other';

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    if (!VALID_DOC_TYPES.includes(docType)) {
      return NextResponse.json({ success: false, error: 'Invalid document type' }, { status: 400 });
    }

    if (!VALID_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Allowed: PDF, JPG, PNG.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: 'File too large. Max 10MB.' }, { status: 400 });
    }

    // Build storage path
    const timestamp = Date.now();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `internships/${id}/${timestamp}_${docType}_${safeFileName}`;

    // Convert to buffer and upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from('closeout-documents')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      if (uploadError.message?.includes('not found') || uploadError.message?.includes('Bucket')) {
        return NextResponse.json({
          success: false,
          error: 'Storage bucket not configured. Please create "closeout-documents" bucket in Supabase.',
        }, { status: 500 });
      }
      return NextResponse.json({ success: false, error: 'Failed to upload file' }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('closeout-documents')
      .getPublicUrl(storagePath);

    const fileUrl = urlData.publicUrl;

    // Insert database record
    const { data: doc, error: dbError } = await supabase
      .from('closeout_documents')
      .insert({
        internship_id: id,
        doc_type: docType,
        file_url: fileUrl,
        uploaded_by: session.user.email,
        uploaded_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error saving document:', dbError.message);
      // Attempt storage cleanup
      try {
        await supabase.storage.from('closeout-documents').remove([storagePath]);
      } catch {
        // Non-fatal
      }
      return NextResponse.json({ success: false, error: 'Failed to save document record' }, { status: 500 });
    }

    return NextResponse.json({ success: true, document: doc });
  } catch (error) {
    console.error('Error uploading closeout document:', error);
    return NextResponse.json({ success: false, error: 'Failed to upload document' }, { status: 500 });
  }
}

// DELETE - Remove a closeout document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const callerRole = await getCallerRole(session.user.email);
    if (!callerRole || !hasMinRole(callerRole, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const docId = searchParams.get('docId');

    if (!docId) {
      return NextResponse.json({ success: false, error: 'Document ID required' }, { status: 400 });
    }

    // Fetch document to get storage path
    const { data: doc } = await supabase
      .from('closeout_documents')
      .select('file_url')
      .eq('id', docId)
      .eq('internship_id', id)
      .single();

    if (doc?.file_url) {
      try {
        const url = new URL(doc.file_url);
        const pathParts = url.pathname.split('/closeout-documents/');
        if (pathParts.length > 1) {
          const storagePath = decodeURIComponent(pathParts[1]);
          await supabase.storage.from('closeout-documents').remove([storagePath]);
        }
      } catch {
        // Non-fatal - storage cleanup failure should not block record deletion
      }
    }

    const { error } = await supabase
      .from('closeout_documents')
      .delete()
      .eq('id', docId)
      .eq('internship_id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting closeout document:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete document' }, { status: 500 });
  }
}
