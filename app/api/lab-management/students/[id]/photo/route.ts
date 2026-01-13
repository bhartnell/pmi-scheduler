import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: studentId } = await params;

  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Invalid file type. Use JPG, PNG, or WebP.' }, { status: 400 });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'File too large. Max 5MB.' }, { status: 400 });
    }

    // Get file extension
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${studentId}.${fileExt}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('student-photos')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({ success: false, error: 'Failed to upload photo' }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('student-photos')
      .getPublicUrl(fileName);

    // Add cache buster to URL
    const photoUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    // Update student record
    const { data: student, error: updateError } = await supabase
      .from('students')
      .update({ photo_url: photoUrl })
      .eq('id', studentId)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ success: false, error: 'Failed to update student record' }, { status: 500 });
    }

    return NextResponse.json({ success: true, photoUrl, student });
  } catch (error) {
    console.error('Error uploading photo:', error);
    return NextResponse.json({ success: false, error: 'Failed to upload photo' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: studentId } = await params;

  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get current student to find photo URL
    const { data: student } = await supabase
      .from('students')
      .select('photo_url')
      .eq('id', studentId)
      .single();

    if (student?.photo_url) {
      // Extract filename from URL
      const urlParts = student.photo_url.split('/');
      const fileNameWithParams = urlParts[urlParts.length - 1];
      const fileName = fileNameWithParams.split('?')[0];

      // Delete from storage
      await supabase.storage
        .from('student-photos')
        .remove([fileName]);
    }

    // Update student record
    const { data: updatedStudent, error } = await supabase
      .from('students')
      .update({ photo_url: null })
      .eq('id', studentId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, student: updatedStudent });
  } catch (error) {
    console.error('Error deleting photo:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete photo' }, { status: 500 });
  }
}
