import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('lab_users')
      .select('id, name, email')
      .in('role', ['instructor', 'lead_instructor', 'admin', 'superadmin'])
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return NextResponse.json({ instructors: data || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('List instructors error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
