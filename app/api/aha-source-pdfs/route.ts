import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { AHA_SOURCE_PDF_BUCKET, ahaSourcePdfKey } from '@/lib/aha-source-pdfs';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

// GET /api/aha-source-pdfs - codes that have an uploaded source PDF (instructor+)
export async function GET() {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await getSupabaseAdmin()
    .storage.from(AHA_SOURCE_PDF_BUCKET)
    .list('', { limit: 1000 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const files = (data || [])
    .filter((o) => o.name.endsWith('.pdf'))
    .map((o) => ({ code: o.name.replace(/\.pdf$/, ''), updated_at: o.updated_at ?? null }));
  return NextResponse.json({ success: true, files });
}

// POST /api/aha-source-pdfs - multipart { code, file }; admin only. Replaces an existing PDF for the code.
export async function POST(request: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  const form = await request.formData();
  const code = String(form.get('code') || '');
  const file = form.get('file');
  const key = ahaSourcePdfKey(code);
  if (!key) return NextResponse.json({ error: 'Invalid case code' }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (file.type !== 'application/pdf') return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'File exceeds 50MB' }, { status: 400 });

  const { error } = await getSupabaseAdmin()
    .storage.from(AHA_SOURCE_PDF_BUCKET)
    .upload(key, Buffer.from(await file.arrayBuffer()), { contentType: 'application/pdf', upsert: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, code: key.replace(/\.pdf$/, '') });
}
