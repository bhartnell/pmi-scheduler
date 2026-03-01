import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { createNotification } from '@/lib/notifications';

// Helper to get current user from lab_users
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// Check if user can review all requests (admin or lead_instructor+)
function canReviewAll(role: string): boolean {
  return hasMinRole(role, 'lead_instructor');
}

// GET - List substitute requests
// Instructors see only their own; lead_instructor+ see all
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Must be at least an instructor to access this feature
    if (!hasMinRole(currentUser.role, 'instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const pendingOnly = searchParams.get('pending_only') === 'true';

    let query = supabase
      .from('substitute_requests')
      .select(`
        id,
        reason,
        reason_details,
        status,
        review_notes,
        created_at,
        reviewed_at,
        covered_at,
        requester_email,
        reviewed_by,
        covered_by,
        lab_day:lab_day_id(
          id,
          date,
          title,
          week_number,
          day_number,
          cohort:cohorts(id, cohort_number, program:programs(abbreviation))
        )
      `)
      .order('created_at', { ascending: false });

    // Non-admin/lead instructors only see their own requests
    if (!canReviewAll(currentUser.role)) {
      query = query.eq('requester_email', currentUser.email);
    }

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    if (pendingOnly) {
      query = query.eq('status', 'pending');
    }

    const { data: requests, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, requests: requests || [] });
  } catch (error) {
    console.error('Error fetching substitute requests:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch substitute requests' },
      { status: 500 }
    );
  }
}

// POST - Submit a new substitute request
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Must be at least an instructor
    if (!hasMinRole(currentUser.role, 'instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { lab_day_id, reason, reason_details } = body;

    if (!lab_day_id || !reason) {
      return NextResponse.json(
        { success: false, error: 'lab_day_id and reason are required' },
        { status: 400 }
      );
    }

    const VALID_REASONS = ['Illness', 'Personal', 'Professional Development', 'Emergency', 'Other'];
    if (!VALID_REASONS.includes(reason)) {
      return NextResponse.json(
        { success: false, error: 'Invalid reason value' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Verify the instructor is actually assigned to this lab day (via lab_day_roles or lab_stations)
    const { data: roleAssignment } = await supabase
      .from('lab_day_roles')
      .select('id')
      .eq('lab_day_id', lab_day_id)
      .eq('instructor_id', currentUser.id)
      .maybeSingle();

    const { data: stationAssignment } = await supabase
      .from('lab_stations')
      .select('id')
      .eq('lab_day_id', lab_day_id)
      .eq('instructor_id', currentUser.id)
      .maybeSingle();

    if (!roleAssignment && !stationAssignment) {
      return NextResponse.json(
        { success: false, error: 'You are not assigned to this lab day' },
        { status: 400 }
      );
    }

    // Check for existing open (pending) request for this lab day
    const { data: existingRequest } = await supabase
      .from('substitute_requests')
      .select('id, status')
      .eq('requester_email', currentUser.email)
      .eq('lab_day_id', lab_day_id)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingRequest) {
      return NextResponse.json(
        { success: false, error: 'You already have a pending substitute request for this lab day' },
        { status: 400 }
      );
    }

    // Create the request
    const { data: newRequest, error } = await supabase
      .from('substitute_requests')
      .insert({
        requester_email: currentUser.email,
        lab_day_id,
        reason,
        reason_details: reason_details || null,
        status: 'pending',
      })
      .select(`
        id,
        reason,
        reason_details,
        status,
        created_at,
        requester_email,
        lab_day:lab_day_id(
          id,
          date,
          title,
          cohort:cohorts(id, cohort_number, program:programs(abbreviation))
        )
      `)
      .single();

    if (error) throw error;

    // Notify admins and lead_instructors of the new request
    try {
      const { data: reviewers } = await supabase
        .from('lab_users')
        .select('email')
        .in('role', ['admin', 'superadmin', 'lead_instructor'])
        .eq('is_active', true);

      if (reviewers && reviewers.length > 0) {
        const labDayData = newRequest.lab_day as { date?: string } | null;
        const labDate = labDayData?.date
          ? new Date(labDayData.date + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })
          : 'upcoming lab';

        await Promise.all(
          reviewers.map(reviewer =>
            createNotification({
              userEmail: reviewer.email,
              title: 'New substitute request',
              message: `${currentUser.name} requested a substitute for ${labDate} — Reason: ${reason}`,
              type: 'shift_available',
              linkUrl: '/scheduling/substitute-requests',
              referenceType: 'substitute_request',
              referenceId: newRequest.id,
            })
          )
        );
      }
    } catch (notifError) {
      console.error('Error sending substitute request notifications:', notifError);
    }

    return NextResponse.json({ success: true, request: newRequest });
  } catch (error) {
    console.error('Error creating substitute request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create substitute request' },
      { status: 500 }
    );
  }
}
