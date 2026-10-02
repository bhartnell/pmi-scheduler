import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { AHA_CREDENTIALS, SIGNATURE_FACES, LEGACY_SIGNATURE_FACES } from '@/lib/reports/aha/signature';

/**
 * Current user's own AHA instructor credentials (for the AHA Results Export
 * signature line + per-form instructor selection). Self-service: reads/writes
 * only the authenticated user's lab_users row. Additive fields only.
 *
 * GET   → { name, aha_instructor_number, signature_*, aha_credentials }
 * PATCH  Body: any of { aha_instructor_number, signature_data, signature_kind }
 *        signature_data must be an image data URL (drawn/uploaded) or null.
 */

const SIG_KINDS = ['drawn', 'uploaded', 'auto', 'typed'] as const;
const COLS = 'id, name, aha_instructor_number, signature_data, signature_kind, signature_text, signature_face, aha_credentials';
const MAX_SIG_LEN = 600_000; // ~600KB data URL ceiling

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('lab_users')
    .select(COLS)
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
  if ('signature_text' in body) {
    const v = body.signature_text;
    if (v !== null && (typeof v !== 'string' || v.length > 80)) {
      return NextResponse.json({ success: false, error: 'signature_text must be a string up to 80 chars or null' }, { status: 400 });
    }
    patch.signature_text = typeof v === 'string' ? v.trim() || null : null;
  }
  if ('signature_face' in body) {
    const v = body.signature_face;
    if (v !== null && (typeof v !== 'string' || !(v in SIGNATURE_FACES || (LEGACY_SIGNATURE_FACES as readonly string[]).includes(v)))) {
      return NextResponse.json({ success: false, error: `signature_face must be one of ${Object.keys(SIGNATURE_FACES).join(', ')} or null` }, { status: 400 });
    }
    patch.signature_face = v ?? null;
  }
  if ('aha_credentials' in body) {
    const v = body.aha_credentials;
    if (v !== null && (!Array.isArray(v) || v.some((x) => !(AHA_CREDENTIALS as readonly string[]).includes(x as string)))) {
      return NextResponse.json({ success: false, error: `aha_credentials must be an array of ${AHA_CREDENTIALS.join(', ')}` }, { status: 400 });
    }
    patch.aha_credentials = v && (v as string[]).length ? v : null;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ success: false, error: 'no editable fields in body' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('lab_users')
    .update(patch)
    .eq('id', user.id)
    .select(COLS)
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, profile: data });
}
