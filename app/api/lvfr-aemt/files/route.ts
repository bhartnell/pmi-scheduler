import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole, isAgencyRole, canEditLVFR } from '@/lib/permissions';
import { logRecordAccess } from '@/lib/ferpa';

const VALID_MIME_TYPES = [
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const BUCKET = 'lvfr-aemt-files';

// ---------------------------------------------------------------------------
// GET /api/lvfr-aemt/files
//
// List file metadata with signed download URLs.
// Students: only visible_to_students = true.
// Query: ?module_id=...&chapter_id=...&day_number=...&file_type=...
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const supabase = getSupabaseAdmin();
  const moduleId = request.nextUrl.searchParams.get('module_id');
  const chapterId = request.nextUrl.searchParams.get('chapter_id');
  const dayNumber = request.nextUrl.searchParams.get('day_number');
  const fileType = request.nextUrl.searchParams.get('file_type');

  let query = supabase
    .from('lvfr_aemt_files')
    .select(`
      id, title, description, file_url, file_type, file_size,
      module_id, chapter_id, day_number, uploaded_at, visible_to_students,
      uploader:lab_users!lvfr_aemt_files_uploaded_by_fkey(name)
    `)
    .order('module_id', { nullsFirst: false })
    .order('day_number', { nullsFirst: true })
    .order('title');

  // Students only see visible files
  if (user.role === 'student') {
    query = query.eq('visible_to_students', true);
  }

  if (moduleId) query = query.eq('module_id', moduleId);
  if (chapterId) query = query.eq('chapter_id', chapterId);
  if (dayNumber) query = query.eq('day_number', parseInt(dayNumber));
  if (fileType) query = query.eq('file_type', fileType);

  const { data: files, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Generate signed URLs (1hr) for download
  const filesWithUrls = await Promise.all((files || []).map(async (f) => {
    // Check if file_url is a storage path (not a full URL)
    let downloadUrl = f.file_url;
    if (f.file_url && !f.file_url.startsWith('http')) {
      const { data: signedData } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(f.file_url, 3600);
      if (signedData) downloadUrl = signedData.signedUrl;
    }
    return { ...f, download_url: downloadUrl };
  }));

  // Log access for agency roles
  if (isAgencyRole(user.role)) {
    logRecordAccess({
      userEmail: user.email, userRole: user.role,
      dataType: 'grades', action: 'view',
      route: '/api/lvfr-aemt/files',
      details: { file_count: filesWithUrls.length },
    }).catch(() => {});
  }

  return NextResponse.json({ files: filesWithUrls });
}

// ---------------------------------------------------------------------------
// POST /api/lvfr-aemt/files
//
// Upload a file to Supabase Storage + create metadata record.
// Multipart form: file + title, description, module_id, chapter_id,
//                 day_number, visible_to_students
// Auth: instructor+ only
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, session } = auth;

  if (isAgencyRole(user.role)) {
    return NextResponse.json({ error: 'Agency roles are read-only' }, { status: 403 });
  }
  if (!canEditLVFR(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = (formData.get('title') as string) || file?.name || 'Untitled';
    const description = formData.get('description') as string || null;
    const moduleId = formData.get('module_id') as string || null;
    const chapterId = formData.get('chapter_id') as string || null;
    const dayNumber = formData.get('day_number') as string;
    const visibleToStudents = formData.get('visible_to_students') !== 'false';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!VALID_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({
        error: 'Invalid file type. Allowed: PDF, PPT/PPTX, DOC/DOCX, PNG, JPG, TXT, CSV, XLSX',
      }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum 50MB.' }, { status: 400 });
    }

    // Build storage path
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = moduleId
      ? `modules/${moduleId}/${timestamp}_${sanitizedName}`
      : `general/${timestamp}_${sanitizedName}`;

    // Upload to storage
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      if (uploadError.message?.includes('not found') || uploadError.message?.includes('Bucket')) {
        return NextResponse.json({
          error: `Storage bucket "${BUCKET}" not configured. Please create it in Supabase.`,
        }, { status: 500 });
      }
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }

    // Determine file type category
    let fileTypeCategory = 'other';
    if (file.type === 'application/pdf') fileTypeCategory = 'pdf';
    else if (file.type.includes('presentation') || file.type.includes('powerpoint')) fileTypeCategory = 'pptx';
    else if (file.type.includes('word') || file.type === 'application/msword') fileTypeCategory = 'docx';
    else if (file.type.startsWith('image/')) fileTypeCategory = 'image';
    else if (file.type.includes('csv') || file.type.includes('spreadsheet')) fileTypeCategory = 'xlsx';
    else if (file.type === 'text/plain') fileTypeCategory = 'txt';

    // Get uploader lab_users id
    const { data: uploader } = await supabase
      .from('lab_users')
      .select('id')
      .ilike('email', user.email)
      .single();

    // Create database record
    const { data: fileRecord, error: dbError } = await supabase
      .from('lvfr_aemt_files')
      .insert({
        title: title.trim(),
        description,
        file_url: storagePath,
        file_type: fileTypeCategory,
        file_size: file.size,
        module_id: moduleId,
        chapter_id: chapterId,
        day_number: dayNumber ? parseInt(dayNumber) : null,
        uploaded_by: uploader?.id || null,
        visible_to_students: visibleToStudents,
      })
      .select()
      .single();

    if (dbError) {
      console.error('DB error:', dbError);
      // Clean up uploaded file
      await supabase.storage.from(BUCKET).remove([storagePath]);
      return NextResponse.json({ error: 'Failed to save file record' }, { status: 500 });
    }

    return NextResponse.json({ success: true, file: fileRecord });
  } catch (err) {
    console.error('Error uploading file:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
