import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// Valid file types for drill documents
const VALID_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// GET - Fetch all documents for a drill
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: drillId } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('skill_documents')
      .select('*')
      .eq('drill_id', drillId)
      .order('display_order')
      .order('document_name');

    if (error) throw error;

    return NextResponse.json({ success: true, documents: data });
  } catch (error) {
    console.error('Error fetching drill documents:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch drill documents' }, { status: 500 });
  }
}

// POST - Upload a new document for a drill (file upload OR URL)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: drillId } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') || '';

    // --- URL-only path ---
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { url, documentName, documentType, displayOrder } = body;

      if (!url) {
        return NextResponse.json({ success: false, error: 'url is required' }, { status: 400 });
      }
      if (!documentName?.trim()) {
        return NextResponse.json({ success: false, error: 'documentName is required' }, { status: 400 });
      }
      if (!['skill_sheet', 'checkoff', 'reference', 'protocol'].includes(documentType || 'reference')) {
        return NextResponse.json({ success: false, error: 'Invalid document type' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('skill_documents')
        .insert({
          drill_id: drillId,
          document_name: documentName.trim(),
          document_url: url,
          document_type: documentType || 'reference',
          file_type: 'link',
          display_order: displayOrder ?? 0,
          created_by: session.user.email
        })
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        return NextResponse.json({ success: false, error: 'Failed to save document record' }, { status: 500 });
      }

      return NextResponse.json({ success: true, document: data });
    }

    // --- File upload path ---
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const documentName = formData.get('documentName') as string || file?.name || 'Document';
    const documentType = formData.get('documentType') as string || 'reference';
    const displayOrder = parseInt(formData.get('displayOrder') as string || '0');

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    if (!['skill_sheet', 'checkoff', 'reference', 'protocol'].includes(documentType)) {
      return NextResponse.json({ success: false, error: 'Invalid document type' }, { status: 400 });
    }

    // Validate file type
    if (!VALID_TYPES.includes(file.type)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid file type. Allowed: PDF, DOCX, JPG, PNG, WebP, GIF.'
      }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: 'File too large. Max 10MB.' }, { status: 400 });
    }

    // Get file extension
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'pdf';
    const timestamp = Date.now();
    const fileName = `drills/${drillId}/${timestamp}_${documentType}.${fileExt}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('skill-documents')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      if (uploadError.message?.includes('not found') || uploadError.message?.includes('Bucket')) {
        return NextResponse.json({
          success: false,
          error: 'Storage bucket not configured. Please create "skill-documents" bucket in Supabase.'
        }, { status: 500 });
      }
      return NextResponse.json({ success: false, error: 'Failed to upload document' }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('skill-documents')
      .getPublicUrl(fileName);

    const documentUrl = urlData.publicUrl;

    // Determine file type category
    let fileTypeCategory = 'other';
    if (file.type === 'application/pdf') fileTypeCategory = 'pdf';
    else if (file.type.startsWith('image/')) fileTypeCategory = 'image';
    else if (file.type.includes('word')) fileTypeCategory = 'docx';

    // Create skill_documents record with drill_id
    const { data, error } = await supabase
      .from('skill_documents')
      .insert({
        drill_id: drillId,
        document_name: documentName,
        document_url: documentUrl,
        document_type: documentType,
        file_type: fileTypeCategory,
        file_size_bytes: file.size,
        display_order: displayOrder,
        created_by: session.user.email
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ success: false, error: 'Failed to save document record' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      document: data,
      fileName: file.name
    });
  } catch (error) {
    console.error('Error uploading drill document:', error);
    return NextResponse.json({ success: false, error: 'Failed to upload document' }, { status: 500 });
  }
}

// DELETE - Remove a document from a drill
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: drillId } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json({ success: false, error: 'Document ID required' }, { status: 400 });
    }

    // Get document to find storage path
    const { data: doc } = await supabase
      .from('skill_documents')
      .select('document_url, file_type')
      .eq('id', documentId)
      .eq('drill_id', drillId)
      .single();

    if (doc?.document_url && doc.file_type !== 'link') {
      // Extract storage path from URL and attempt cleanup
      try {
        const url = new URL(doc.document_url);
        const pathParts = url.pathname.split('/skill-documents/');
        if (pathParts.length > 1) {
          const storagePath = decodeURIComponent(pathParts[1]);
          await supabase.storage.from('skill-documents').remove([storagePath]);
        }
      } catch {
        // Non-fatal — storage cleanup failure should not block record deletion
      }
    }

    // Delete database record
    const { error } = await supabase
      .from('skill_documents')
      .delete()
      .eq('id', documentId)
      .eq('drill_id', drillId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting drill document:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete document' }, { status: 500 });
  }
}

// PATCH - Update document metadata (name, type, order)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: drillId } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { documentId, document_name, document_type, display_order } = body;

    if (!documentId) {
      return NextResponse.json({ success: false, error: 'Document ID required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (document_name !== undefined) updateData.document_name = document_name;
    if (document_type !== undefined) updateData.document_type = document_type;
    if (display_order !== undefined) updateData.display_order = display_order;

    const { data, error } = await supabase
      .from('skill_documents')
      .update(updateData)
      .eq('id', documentId)
      .eq('drill_id', drillId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, document: data });
  } catch (error) {
    console.error('Error updating drill document:', error);
    return NextResponse.json({ success: false, error: 'Failed to update document' }, { status: 500 });
  }
}
