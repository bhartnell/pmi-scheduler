import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/audit';
import { sendEmail } from '@/lib/email';

const APP_URL = process.env.NEXTAUTH_URL || 'https://pmiparamedic.tools';

/**
 * GET /api/admin/external-access
 *
 * List all approved external emails. Admin+ only.
 */
export async function GET() {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('approved_external_emails')
    .select('*')
    .order('approved_at', { ascending: false });

  if (error) {
    console.error('[EXTERNAL-ACCESS] GET error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to fetch approved emails' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data || [] });
}

/**
 * POST /api/admin/external-access
 *
 * Add a single approved external email. Admin+ only.
 * Body: { email, organization, default_role, default_scope?, notes?, send_welcome? }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const body = await request.json();
  const { email, organization, default_role, default_scope, notes, send_welcome } = body;

  if (!email || !organization) {
    return NextResponse.json({ success: false, error: 'Email and organization are required' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const domain = normalizedEmail.split('@')[1];

  if (!domain) {
    return NextResponse.json({ success: false, error: 'Invalid email address' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Check for existing entry
  const { data: existing } = await supabase
    .from('approved_external_emails')
    .select('id, is_active')
    .eq('email', normalizedEmail)
    .single();

  if (existing) {
    if (existing.is_active) {
      return NextResponse.json({ success: false, error: 'This email is already approved' }, { status: 409 });
    }
    // Reactivate a previously revoked entry
    const { error: updateError } = await supabase
      .from('approved_external_emails')
      .update({
        is_active: true,
        revoked_at: null,
        organization,
        default_role: default_role || 'pending',
        default_scope: default_scope || [],
        approved_by: user.email,
        approved_at: new Date().toISOString(),
        notes: notes || null,
      })
      .eq('id', existing.id);

    if (updateError) {
      return NextResponse.json({ success: false, error: 'Failed to reactivate entry' }, { status: 500 });
    }

    logAuditEvent({
      user: { id: user.id, email: user.email, role: user.role },
      action: 'external_email_reactivated',
      resourceType: 'user',
      resourceDescription: `Reactivated external email: ${normalizedEmail}`,
      metadata: { email: normalizedEmail, organization, default_role },
    }).catch(() => {});

    return NextResponse.json({ success: true, message: 'Email reactivated' });
  }

  // Insert new entry
  const { data: newEntry, error: insertError } = await supabase
    .from('approved_external_emails')
    .insert({
      email: normalizedEmail,
      domain,
      organization,
      default_role: default_role || 'pending',
      default_scope: default_scope || [],
      approved_by: user.email,
      notes: notes || null,
    })
    .select()
    .single();

  if (insertError) {
    console.error('[EXTERNAL-ACCESS] POST error:', insertError.message);
    return NextResponse.json({ success: false, error: 'Failed to add approved email' }, { status: 500 });
  }

  logAuditEvent({
    user: { id: user.id, email: user.email, role: user.role },
    action: 'external_email_approved',
    resourceType: 'user',
    resourceDescription: `Approved external email: ${normalizedEmail}`,
    metadata: { email: normalizedEmail, organization, default_role },
  }).catch(() => {});

  // Send welcome email if requested
  if (send_welcome) {
    try {
      await sendEmail({
        to: normalizedEmail,
        subject: 'PMI Paramedic Tools — Course Access',
        template: 'general',
        data: {
          title: 'Welcome to PMI Paramedic Tools',
          message: `You've been granted access to PMI Paramedic Tools. Sign in using the "Sign in with Microsoft" button with your ${normalizedEmail} account.`,
          actionUrl: `${APP_URL}/auth/signin`,
          actionText: 'Sign In Now',
        },
      });
    } catch (err) {
      console.error('[EXTERNAL-ACCESS] Welcome email failed:', err);
      // Don't fail the request — email is optional
    }
  }

  return NextResponse.json({ success: true, data: newEntry });
}

/**
 * PUT /api/admin/external-access
 *
 * Revoke or reactivate an approved external email. Admin+ only.
 * Body: { id, action: 'revoke' | 'reactivate' }
 */
export async function PUT(request: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const body = await request.json();
  const { id, action } = body;

  if (!id || !['revoke', 'reactivate'].includes(action)) {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const updates = action === 'revoke'
    ? { is_active: false, revoked_at: new Date().toISOString() }
    : { is_active: true, revoked_at: null };

  const { error } = await supabase
    .from('approved_external_emails')
    .update(updates)
    .eq('id', id);

  if (error) {
    return NextResponse.json({ success: false, error: `Failed to ${action} entry` }, { status: 500 });
  }

  logAuditEvent({
    user: { id: user.id, email: user.email, role: user.role },
    action: `external_email_${action}d` as 'external_email_revoked' | 'external_email_reactivated',
    resourceType: 'user',
    resourceId: id,
    resourceDescription: `External email ${action}d`,
  }).catch(() => {});

  return NextResponse.json({ success: true, message: `Entry ${action}d` });
}
