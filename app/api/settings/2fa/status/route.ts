import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/settings/2fa/status
 * Returns the current 2FA status for the authenticated user.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const { data } = await supabase
      .from('user_2fa')
      .select('is_enabled, required, backup_codes')
      .eq('user_email', session.user.email)
      .single();

    return NextResponse.json({
      success: true,
      is_enabled: data?.is_enabled ?? false,
      required: data?.required ?? false,
      backup_codes_remaining: Array.isArray(data?.backup_codes)
        ? (data.backup_codes as string[]).length
        : 0,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch 2FA status';
    console.error('Error fetching 2FA status:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
