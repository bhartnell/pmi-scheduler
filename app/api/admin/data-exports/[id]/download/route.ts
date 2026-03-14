import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/admin/data-exports/[id]/download?file=path/to/file.csv
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const filePath = request.nextUrl.searchParams.get('file');

    const supabase = getSupabaseAdmin();

    // Verify archive exists
    const { data: archive } = await supabase
      .from('data_export_archives')
      .select('id, files, folder_path')
      .eq('id', id)
      .single();

    if (!archive) {
      return NextResponse.json({ error: 'Archive not found' }, { status: 404 });
    }

    if (filePath) {
      // Single file download - generate signed URL
      const { data: signedUrl, error } = await supabase.storage
        .from('data-exports')
        .createSignedUrl(filePath, 3600); // 1 hour

      if (error) {
        return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 });
      }

      return NextResponse.json({ success: true, url: signedUrl.signedUrl });
    }

    // All files - generate signed URLs for each
    const files = archive.files as { name: string; path: string; size: number; row_count: number }[];
    const urls: { name: string; url: string; size: number; row_count: number }[] = [];

    for (const file of files) {
      const { data: signedUrl } = await supabase.storage
        .from('data-exports')
        .createSignedUrl(file.path, 3600);

      if (signedUrl) {
        urls.push({ name: file.name, url: signedUrl.signedUrl, size: file.size, row_count: file.row_count });
      }
    }

    return NextResponse.json({ success: true, files: urls });
  } catch (err) {
    console.error('GET /api/admin/data-exports/[id]/download error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/data-exports/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('superadmin');
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: archive } = await supabase
      .from('data_export_archives')
      .select('id, files, folder_path')
      .eq('id', id)
      .single();

    if (!archive) {
      return NextResponse.json({ error: 'Archive not found' }, { status: 404 });
    }

    // Delete files from storage
    const files = archive.files as { path: string }[];
    const filePaths = files.map(f => f.path);
    if (filePaths.length > 0) {
      await supabase.storage.from('data-exports').remove(filePaths);
    }

    // Delete archive record
    await supabase.from('data_export_archives').delete().eq('id', archive.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/admin/data-exports/[id] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
