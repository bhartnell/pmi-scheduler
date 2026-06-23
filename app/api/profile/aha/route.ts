import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * Current user's own AHA instructor credentials (for the AHA Results Export
 * signature line + per-form instructor selection). Self-service: reads/writes
 * only the authenticated user's lab_users row. Additive fields only.
 *
 * GET   → { name, aha_instructor_number, signature_data, signature_kind }
 * PATCH  Body: any of { aha_instructor_number, signature_data, signature_kind }
 *        signature_data must be an image data URL (drawn/uploaded) or null.
 */

const SIG_KINDS = ['drawn', 'uploaded', 'auto'] as const;
const MAX_SIG_LEN = 600_000; // ~600KB data URL ceiling

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('lab_users')
    .select('id, name, aha_instructor_number, signature_data, signature_kind')
    .eq('id', user.id)
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, profile: data });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid body' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if ('aha_instructor_number' in body) {
    const v = body.aha_instructor_number;
    patch.aha_instructor_number = v ? String(v).trim() : null;
  }
  if ('signature_kind' in body) {
    const v = body.signature_kind;
    if (v !== null && !SIG_KINDS.includes(v as typeof SIG_KINDS[number])) {
      return NextResponse.json({ success: false, error: `signature_kind must be one of ${SIG_KINDS.join(', ')} or null` }, { status: 400 });
    }
    patch.signature_kind = v ?? null;
  }
  if ('signature_data' in body) {
    const v = body.signature_data;
    if (v !== null) {
      if (typeof v !== 'string' || !v.startsWith('data:image/')) {
        return NextResponse.json({ success: false, error: 'signature_data must be an image data URL or null' }, { status: 400 });
      }
      if (v.length > MAX_SIG_LEN) {
        return NextResponse.json({ success: false, error: 'signature image too large (max ~600KB)' }, { status: 413 });
      }
    }
    patch.signature_data = v ?? null;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ success: false, error: 'no editable fields in body' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('lab_users')
    .update(patch)
    .eq('id', user.id)
    .select('id, name, aha_instructor_number, signature_data, signature_kind')
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, profile: data });
}
