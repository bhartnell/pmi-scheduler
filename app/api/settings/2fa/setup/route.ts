import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { generateTOTPSecret, buildOTPAuthURI } from '@/lib/totp';

/**
 * POST /api/settings/2fa/setup
 * Generates a new TOTP secret and stores it (not yet enabled).
 * Returns the secret and the otpauth:// URI for QR code display.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const secret = generateTOTPSecret();
    const uri = buildOTPAuthURI(session.user.email, secret);

    // Upsert a record with the new secret (not yet enabled)
    const { error } = await supabase
      .from('user_2fa')
      .upsert(
        {
          user_email: session.user.email,
          totp_secret: secret,
          is_enabled: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_email' },
      );

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      secret,
      uri,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to set up 2FA';
    console.error('Error setting up 2FA:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
