import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifyTOTP, generateBackupCodes } from '@/lib/totp';

/**
 * POST /api/settings/2fa/verify
 * Verifies the provided TOTP code against the stored (not-yet-enabled) secret.
 * On success, enables 2FA and returns 10 backup codes (one-time display).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as { code?: string };
    const code = (body.code ?? '').replace(/\s/g, '');

    if (!code) {
      return NextResponse.json({ error: 'Verification code is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch the stored (pending) secret for this user from lab_users
    const { data, error: fetchError } = await supabase
      .from('lab_users')
      .select('totp_secret, totp_enabled')
      .eq('email', session.user.email)
      .single();

    if (fetchError || !data?.totp_secret) {
      return NextResponse.json(
        { error: 'No pending 2FA setup found. Please start setup first.' },
        { status: 400 },
      );
    }

    // Verify the code
    const valid = verifyTOTP(data.totp_secret, code);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid verification code. Please try again.' }, { status: 400 });
    }

    // Generate backup codes and enable 2FA
    const backupCodes = generateBackupCodes();

    const { error: updateError } = await supabase
      .from('lab_users')
      .update({
        totp_enabled: true,
        totp_backup_codes: backupCodes,
        totp_verified_at: new Date().toISOString(),
      })
      .eq('email', session.user.email);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      backup_codes: backupCodes,
      message: '2FA has been enabled successfully.',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to verify 2FA code';
    console.error('Error verifying 2FA code:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
