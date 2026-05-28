/**
 * /api/lab-management/stations/[id]/documents
 *
 * Per-lab_station document attachments — distinct from
 * /api/lab-management/skills/[id]/documents which attaches to a
 * skill DEFINITION and inherits onto every station referencing it.
 *
 * Endpoints mirror the skills version so the EditStationModal upload
 * UI can share components:
 *   GET     list docs for a station
 *   POST    upload (multipart) OR add a URL-only link (JSON body)
 *   PATCH   rename / re-type / reorder a doc
 *   DELETE  remove a doc (and storage object if it lives in Supabase)
 *
 * Storage uses the existing 'station-documents' bucket under
 *   {station_id}/{ts}_{document_type}.{ext}
 * The bucket is already public in production from the previous
 * (now-replaced) single-slot uploader.
 *
 * NOTE: The previous version of this route only modified the legacy
 * single-slot fields `skill_sheet_url` / `instructions_url` on
 * lab_stations and uploaded to a separate `station-documents`
 * bucket. It had zero callers — replaced wholesale with this
 * multi-doc design on 2026-05-28. The two URL fields are still
 * managed directly via the regular PATCH endpoint on the station.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

const VALID_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DOC_TYPES = ['skill_sheet', 'checkoff', 'reference', 'protocol'] as const;
// Use the existing public 'station-documents' bucket — already
// provisioned in production. Path scheme namespaces uploads under
// {station_id}/ so each station's files are easy to clean up.
const BUCKET = 'station-documents';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: stationId } = await params;
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('station_documents')
      .select('*')
      .eq('station_id', stationId)
      .order('display_order')
      .order('document_name');

    if (error) throw error;
    return NextResponse.json({ success: true, documents: data });
  } catch (error) {
    console.error('Error fetching station documents:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch station documents' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: stationId } = await params;
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { session } = auth;

    const supabase = getSupabaseAdmin();
    const contentType = request.headers.get('content-type') || '';

    // URL-only path (JSON body) — e.g. linking a Google Doc that
    // already lives in Drive instead of uploading a fresh PDF.
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { url, documentName, documentType, displayOrder } = body;

      if (!url) {
        return NextResponse.json(
          { success: false, error: 'url is required' },
          { status: 400 }
        );
      }
      if (!documentName?.trim()) {
        return NextResponse.json(
          { success: false, error: 'documentName is required' },
          { status: 400 }
        );
      }
      if (!DOC_TYPES.includes((documentType || 'reference') as typeof DOC_TYPES[number])) {
        return NextResponse.json(
          { success: false, error: 'Invalid document type' },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from('station_documents')
        .insert({
          station_id: stationId,
          document_name: documentName.trim(),
          document_url: url,
          document_type: documentType || 'reference',
          file_type: 'link',
          display_order: displayOrder ?? 0,
          created_by: session.user.email,
        })
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to save document record' },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, document: data });
    }

    // File upload path (multipart/form-data).
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const documentName =
      (formData.get('documentName') as string) || file?.name || 'Document';
    const documentType = (formData.get('documentType') as string) || 'reference';
    const displayOrder = parseInt((formData.get('displayOrder') as string) || '0');

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }
    if (!DOC_TYPES.includes(documentType as typeof DOC_TYPES[number])) {
      return NextResponse.json(
        { success: false, error: 'Invalid document type' },
        { status: 400 }
      );
    }
    if (!VALID_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid file type. Allowed: PDF, DOCX, JPG, PNG, WebP, GIF.',
        },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File too large. Max 10MB.' },
        { status: 400 }
      );
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'pdf';
    const timestamp = Date.now();
    const fileName = `${stationId}/${timestamp}_${documentType}.${fileExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      if (
        uploadError.message?.includes('not found') ||
        uploadError.message?.includes('Bucket')
      ) {
        return NextResponse.json(
          {
            success: false,
            error: `Storage bucket not configured. Please create "${BUCKET}" bucket in Supabase.`,
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'Failed to upload document' },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    const documentUrl = urlData.publicUrl;

    let fileTypeCategory = 'other';
    if (file.type === 'application/pdf') fileTypeCategory = 'pdf';
    else if (file.type.startsWith('image/')) fileTypeCategory = 'image';
    else if (file.type.includes('word')) fileTypeCategory = 'docx';

    const { data, error } = await supabase
      .from('station_documents')
      .insert({
        station_id: stationId,
        document_name: documentName,
        document_url: documentUrl,
        document_type: documentType,
        file_type: fileTypeCategory,
        file_size_bytes: file.size,
        display_order: displayOrder,
        created_by: session.user.email,
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      // Roll back the uploaded object so we don't leak orphans.
      await supabase.storage.from(BUCKET).remove([fileName]);
      return NextResponse.json(
        { success: false, error: 'Failed to save document record' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      document: data,
      fileName: file.name,
    });
  } catch (error) {
    console.error('Error uploading station document:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: stationId } = await params;
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: 'Document ID required' },
        { status: 400 }
      );
    }

    const { data: doc } = await supabase
      .from('station_documents')
      .select('document_url, file_type')
      .eq('id', documentId)
      .eq('station_id', stationId)
      .single();

    // Only attempt storage cleanup for files we uploaded; URL-only
    // entries (file_type='link') point to Drive / external URLs and
    // never had an object in the bucket.
    if (doc?.document_url && doc.file_type !== 'link') {
      try {
        const url = new URL(doc.document_url);
        const pathParts = url.pathname.split(`/${BUCKET}/`);
        if (pathParts.length > 1) {
          const storagePath = decodeURIComponent(pathParts[1]);
          await supabase.storage.from(BUCKET).remove([storagePath]);
        }
      } catch {
        // Non-fatal — proceed with DB delete even if storage cleanup fails.
      }
    }

    const { error } = await supabase
      .from('station_documents')
      .delete()
      .eq('id', documentId)
      .eq('station_id', stationId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting station document:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: stationId } = await params;
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { documentId, document_name, document_type, display_order } = body;

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: 'Document ID required' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (document_name !== undefined) updateData.document_name = document_name;
    if (document_type !== undefined) {
      if (!DOC_TYPES.includes(document_type as typeof DOC_TYPES[number])) {
        return NextResponse.json(
          { success: false, error: 'Invalid document type' },
          { status: 400 }
        );
      }
      updateData.document_type = document_type;
    }
    if (display_order !== undefined) updateData.display_order = display_order;

    const { data, error } = await supabase
      .from('station_documents')
      .update(updateData)
      .eq('id', documentId)
      .eq('station_id', stationId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, document: data });
  } catch (error) {
    console.error('Error updating station document:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update document' },
      { status: 500 }
    );
  }
}
