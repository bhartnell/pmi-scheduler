import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/access-requests/status - Check the access request status for the current signed-in user
// Used by the /request-access page to show current status (pending/denied/none)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const email = session.user.email;
    const supabase = getSupabaseAdmin();

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
