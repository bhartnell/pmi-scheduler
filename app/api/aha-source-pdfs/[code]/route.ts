import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { AHA_SOURCE_PDF_BUCKET, ahaSourcePdfKey } from '@/lib/aha-source-pdfs';

// GET /api/aha-source-pdfs/[code] - redirect to a short-lived signed URL for the original PDF (instructor+)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const { code } = await params;
  const key = ahaSourcePdfKey(decodeURIComponent(code));
  if (!key) return NextResponse.json({ error: 'Invalid case code' }, { status: 400 });

  const { data, error } = await getSupabaseAdmin()
    .storage.from(AHA_SOURCE_PDF_BUCKET)
    .createSignedUrl(key, 60);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'No source PDF for this case' }, { status: 404 });
  }
  return NextResponse.redirect(data.signedUrl);
}
