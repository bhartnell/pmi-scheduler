import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';

// Helper to get current user with role
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// PUT /api/access-requests/[id] - Approve or deny a request (admin+ only)
// Body: { action: 'approve' | 'deny', denial_reason?: string }
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action, denial_reason } = body;

    if (!action || !['approve', 'deny'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'action must be "approve" or "deny"' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const requestId = id;

    // Fetch the access request
    const { data: accessRequest, error: fetchError } = await supabase
      .from('access_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !accessRequest) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
    }

    if (accessRequest.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'This request has already been reviewed' },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      // Check if a lab_user already exists with this email (edge case)
      const { data: existingUser } = await supabase
        .from('lab_users')
        .select('id')
        .ilike('email', accessRequest.email)
        .maybeSingle();

      if (!existingUser) {
        // Create the lab_users entry for the approved volunteer instructor
        const { error: insertError } = await supabase
          .from('lab_users')
          .insert({
            email: accessRequest.email.toLowerCase(),
            name: accessRequest.name || accessRequest.email.split('@')[0],
            role: 'volunteer_instructor',
            is_active: true,
            approved_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error('Error creating lab_user for approved request:', insertError);
          return NextResponse.json(
            { success: false, error: 'Failed to create user account' },
            { status: 500 }
          );
        }
      }

      // Update the access request status
      const { error: updateError } = await supabase
        .from('access_requests')
        .update({
          status: 'approved',
          reviewed_by: session.user.email,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      return NextResponse.json({
        success: true,
        message: `Access approved for ${accessRequest.name || accessRequest.email}. They can now sign in with their Google account.`,
      });
    } else {
      // Deny the request
      const { error: updateError } = await supabase
        .from('access_requests')
        .update({
          status: 'denied',
          reviewed_by: session.user.email,
          reviewed_at: new Date().toISOString(),
          denial_reason: denial_reason || null,
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      return NextResponse.json({
        success: true,
        message: `Request from ${accessRequest.name || accessRequest.email} has been denied.`,
      });
    }
  } catch (error) {
    console.error('Error processing access request:', error);
    return NextResponse.json({ success: false, error: 'Failed to process request' }, { status: 500 });
  }
}
