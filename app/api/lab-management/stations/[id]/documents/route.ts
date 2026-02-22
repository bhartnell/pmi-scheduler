import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// Valid file types for station documents
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: stationId } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const documentType = formData.get('documentType') as string; // 'skill_sheet' or 'instructions'

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    if (!documentType || !['skill_sheet', 'instructions'].includes(documentType)) {
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
    const fileName = `${stationId}_${documentType}.${fileExt}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('station-documents')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      // If bucket doesn't exist, provide helpful error
      if (uploadError.message?.includes('not found') || uploadError.message?.includes('Bucket')) {
        return NextResponse.json({
          success: false,
          error: 'Storage bucket not configured. Please create "station-documents" bucket in Supabase.'
        }, { status: 500 });
      }
      return NextResponse.json({ success: false, error: 'Failed to upload document' }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('station-documents')
      .getPublicUrl(fileName);

    // Add cache buster to URL
    const documentUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    // Update station record with the URL
    const updateField = documentType === 'skill_sheet' ? 'skill_sheet_url' : 'instructions_url';
    const { data: station, error: updateError } = await supabase
      .from('lab_stations')
      .update({ [updateField]: documentUrl })
      .eq('id', stationId)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ success: false, error: 'Failed to update station record' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      documentUrl,
      station,
      fileName: file.name,
      documentType
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json({ success: false, error: 'Failed to upload document' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: stationId } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const documentType = searchParams.get('documentType');

    if (!documentType || !['skill_sheet', 'instructions'].includes(documentType)) {
      return NextResponse.json({ success: false, error: 'Invalid document type' }, { status: 400 });
    }

    // Get current station to find document URL
    const { data: station } = await supabase
      .from('lab_stations')
      .select('skill_sheet_url, instructions_url')
      .eq('id', stationId)
      .single();

    const currentUrl = documentType === 'skill_sheet' ? station?.skill_sheet_url : station?.instructions_url;
    if (currentUrl) {
      // Extract filename from URL
      const urlParts = currentUrl.split('/');
      const fileNameWithParams = urlParts[urlParts.length - 1];
      const fileName = fileNameWithParams.split('?')[0];

      // Delete from storage
      await supabase.storage
        .from('station-documents')
        .remove([fileName]);
    }

    // Update station record
    const updateData = documentType === 'skill_sheet'
      ? { skill_sheet_url: null }
      : { instructions_url: null };
    const { data: updatedStation, error } = await supabase
      .from('lab_stations')
      .update(updateData)
      .eq('id', stationId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, station: updatedStation });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete document' }, { status: 500 });
  }
}
