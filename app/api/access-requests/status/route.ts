import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole, type Role } from '@/lib/permissions';

// GET /api/access-requests/status - Check the access request status for a user
// Non-admin users can only check their own email. Admin+ can query any email via ?email= param.
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const searchParams = request.nextUrl.searchParams;
    const requestedEmail = searchParams.get('email');

    // Determine the email to query - default to the session user's own email
    let email = session.user.email;

    // If a different email was requested, verify the caller is admin+
    if (requestedEmail && requestedEmail.toLowerCase() !== session.user.email.toLowerCase()) {
      const { data: caller } = await supabase
        .from('lab_users')
        .select('role')
        .ilike('email', session.user.email)
        .single();

      if (!caller || !hasMinRole(caller.role as Role, 'admin')) {
        return NextResponse.json(
          { success: false, error: 'You can only check your own access request status' },
          { status: 403 }
        );
      }
      email = requestedEmail;
    }

    // Check if user is already in lab_users
    const { data: existingUser } = await supabase
      .from('lab_users')
      .select('id, role')
      .ilike('email', email)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({
        success: true,
        hasAccess: true,
        role: existingUser.role,
      });
    }

    // Look for the most recent access request for this email
    const { data: accessRequest } = await supabase
      .from('access_requests')
      .select('id, status, denial_reason, created_at, reviewed_at')
      .ilike('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      hasAccess: false,
      request: accessRequest || null,
    });
  } catch (error) {
    console.error('Error checking access request status:', error);
    return NextResponse.json({ success: false, error: 'Failed to check status' }, { status: 500 });
  }
}
