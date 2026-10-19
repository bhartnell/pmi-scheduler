import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/module-flags
 * Parked modules only, for the route guard and nav. Fails open: any error
 * returns an empty list so a flag problem can never lock users out.
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await getSupabaseAdmin()
    .from('module_flags')
    .select('key, enabled, parked_at, note')
    .eq('enabled', false);
  if (error) {
    console.error('module_flags read failed (failing open):', error.message);
    return NextResponse.json({ success: true, flags: [] });
  }
  return NextResponse.json({ success: true, flags: data ?? [] });
}
