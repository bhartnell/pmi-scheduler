import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

type RouteContext = { params: Promise<{ key: string }> };

/**
 * GET  /api/system-settings/[key]
 * PUT  /api/system-settings/[key]   body: { value: string }
 *
 * Generic read/write for a single key in `system_settings`. Used
 * primarily for feature flags (e.g. `feature.lab_day_chat`).
 *
 * Read permission: any authenticated user (instructor+). The flag
 * value is non-sensitive — it just controls component visibility.
 * Write permission: admin+. The route is shaped for future flag
 * additions without per-flag API plumbing.
 *
 * Values are stored as text. Callers interpret 'true'/'false' or
 * other strings as needed.
 */

// Only allow keys with a `feature.` or `system.` prefix from this
// generic endpoint. Anything else needs a dedicated route. Prevents
// admin-write powers from accidentally touching sensitive keys like
// `session_timeout_hours` via this surface.
const ALLOWED_PREFIXES = ['feature.', 'system.'];
function isAllowedKey(key: string): boolean {
  return ALLOWED_PREFIXES.some((p) => key.startsWith(p));
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const { key } = await params;
  if (!isAllowedKey(key)) {
    return NextResponse.json(
      { success: false, error: `Key '${key}' not exposed via this endpoint` },
      { status: 403 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('system_settings')
    .select('key, value, updated_at')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ success: true, key, value: null, exists: false });
  }
  // Short browser-side cache so a page with multiple flag readers
  // (the wrapper + a debug widget, say) doesn't fan out into N
  // identical requests. Flags rarely change.
  const res = NextResponse.json({ success: true, key: data.key, value: data.value, exists: true });
  res.headers.set('Cache-Control', 'private, max-age=10, stale-while-revalidate=30');
  return res;
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const { key } = await params;
  if (!isAllowedKey(key)) {
    return NextResponse.json(
      { success: false, error: `Key '${key}' not exposed via this endpoint` },
      { status: 403 },
    );
  }

  let body: { value?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof body.value !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Body must be { value: string }' },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('system_settings')
    .upsert(
      { key, value: body.value, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    );

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  // Best-effort audit trail entry — failure shouldn't block the
  // write itself.
  try {
    await supabase.from('audit_log').insert({
      actor_email: user.email,
      action: 'system_setting_updated',
      details: { key, value: body.value },
    });
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({ success: true, key, value: body.value });
}
