import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/audit';
import { normalizeFlagKey } from '@/lib/module-flags';

export async function GET() {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await getSupabaseAdmin()
    .from('module_flags')
    .select('key, enabled, parked_at, note, updated_by, updated_at')
    .order('key');
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, flags: data ?? [] });
}

/** PUT { key, enabled, note? } - park (enabled=false) or unpark a module. Never deletes rows. */
export async function PUT(request: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.key !== 'string' || !body.key.trim() || typeof body.enabled !== 'boolean') {
    return NextResponse.json({ success: false, error: 'key (string) and enabled (boolean) required' }, { status: 400 });
  }
  const key = normalizeFlagKey(body.key);
  if (key === '/' || key.startsWith('/admin/module-flags') || key.startsWith('/api') || key.startsWith('/parked')) {
    return NextResponse.json({ success: false, error: 'That route cannot be parked' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from('module_flags')
    .upsert({
      key,
      enabled: body.enabled,
      parked_at: body.enabled ? null : now,
      note: typeof body.note === 'string' ? body.note : null,
      updated_by: auth.user.email,
      updated_at: now,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await logAuditEvent({
    user: { id: auth.user.id, email: auth.user.email, role: auth.user.role },
    action: 'update',
    resourceType: 'user',
    resourceDescription: `module_flags: ${key} ${body.enabled ? 'unparked' : 'parked'}`,
  }).catch(() => {});
  return NextResponse.json({ success: true, flag: data });
}
