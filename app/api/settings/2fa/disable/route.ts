import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifyTOTP, verifyAndConsumeBackupCode } from '@/lib/totp';

/**
 * POST /api/settings/2fa/disable
 * Disables 2FA for the authenticated user.
 * Requires either a valid TOTP code or a backup code for verification.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as { code?: string };
    const code = (body.code ?? '').trim();

    if (!code) {
      return NextResponse.json(
        { error: 'A verification code or backup code is required to disable 2FA.' },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();

    // Fetch current 2FA record
    const { data, error: fetchError } = await supabase
      .from('user_2fa')
      .select('totp_secret, is_enabled, backup_codes')
      .eq('user_email', session.user.email)
      .single();

    if (fetchError || !data) {
      return NextResponse.json({ error: '2FA is not configured for your account.' }, { status: 400 });
    }

    if (!data.is_enabled) {
      return NextResponse.json({ error: '2FA is not currently enabled.' }, { status: 400 });
    }

    // First, try to verify as a TOTP code (6 digits)
    let verified = false;
    let remainingBackupCodes: string[] = Array.isArray(data.backup_codes) ? (data.backup_codes as string[]) : [];

    if (/^\d{6}$/.test(code) && data.totp_secret) {
      verified = verifyTOTP(data.totp_secret, code);
    }

    // If not verified as TOTP, try as a backup code
    if (!verified) {
      const result = verifyAndConsumeBackupCode(remainingBackupCodes, code);
      if (result.valid) {
        verified = true;
        remainingBackupCodes = result.remainingCodes;
      }
    }

    if (!verified) {
      return NextResponse.json(
        { error: 'Invalid code. Please enter your 6-digit authenticator code or a backup code.' },
        { status: 400 },
      );
    }

    // Disable 2FA
    const { error: updateError } = await supabase
      .from('user_2fa')
      .update({
        is_enabled: false,
        totp_secret: null,
        backup_codes: [],
        remembered_devices: [],
        updated_at: new Date().toISOString(),
      })
      .eq('user_email', session.user.email);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: '2FA has been disabled.',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to disable 2FA';
    console.error('Error disabling 2FA:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
