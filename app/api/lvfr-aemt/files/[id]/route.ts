import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAgencyRole, canEditLVFR } from '@/lib/permissions';

const BUCKET = 'lvfr-aemt-files';

// ---------------------------------------------------------------------------
// PATCH /api/lvfr-aemt/files/[id]
//
// Update file metadata (title, description, visibility, module/chapter).
// Auth: instructor+ only
// ---------------------------------------------------------------------------
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (isAgencyRole(user.role)) {
    return NextResponse.json({ error: 'Agency roles are read-only' }, { status: 403 });
  }
  if (!canEditLVFR(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.visible_to_students !== undefined) updates.visible_to_students = body.visible_to_students;
  if (body.module_id !== undefined) updates.module_id = body.module_id;
  if (body.chapter_id !== undefined) updates.chapter_id = body.chapter_id;
  if (body.day_number !== undefined) updates.day_number = body.day_number;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('lvfr_aemt_files')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, file: data });
}

// ---------------------------------------------------------------------------
// DELETE /api/lvfr-aemt/files/[id]
//
// Delete from storage and database.
// Auth: instructor+ only
// ---------------------------------------------------------------------------
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (isAgencyRole(user.role)) {
    return NextResponse.json({ error: 'Agency roles are read-only' }, { status: 403 });
  }
  if (!canEditLVFR(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  // Get file record to find storage path
  const { data: file, error: fetchError } = await supabase
    .from('lvfr_aemt_files')
    .select('id, file_url')
    .eq('id', id)
    .single();

  if (fetchError || !file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  // Delete from storage if it's a storage path (not a URL)
  if (file.file_url && !file.file_url.startsWith('http')) {
    await supabase.storage.from(BUCKET).remove([file.file_url]);
  }

  // Delete from database
  const { error: deleteError } = await supabase
    .from('lvfr_aemt_files')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
