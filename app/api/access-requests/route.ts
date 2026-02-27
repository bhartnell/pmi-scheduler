import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';
import { rateLimit } from '@/lib/rate-limit';

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

// GET /api/access-requests - List access requests (admin+ only)
// Query params: ?status=pending (default) | ?status=all
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'pending';

    let query = supabase
      .from('access_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, requests: data || [] });
  } catch (error) {
    console.error('Error fetching access requests:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch access requests' }, { status: 500 });
  }
}

// POST /api/access-requests - Submit a new access request (any signed-in user)
// Body: { email, name, reason? }
export async function POST(request: NextRequest) {
  // Rate limit: 5 requests per minute per IP
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const { success: rateLimitOk } = rateLimit(`access-request:${ip}`, 5, 60000);
  if (!rateLimitOk) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { email, name, reason } = body;

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Check if email already has a lab_users entry (already has access)
    const { data: existingUser } = await supabase
      .from('lab_users')
      .select('id, role')
      .ilike('email', email)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'You already have access to this system.' },
        { status: 400 }
      );
    }

    // Check if there is already a pending request for this email
    const { data: pendingRequest } = await supabase
      .from('access_requests')
      .select('id, status')
      .ilike('email', email)
      .eq('status', 'pending')
      .maybeSingle();

    if (pendingRequest) {
      return NextResponse.json(
        { success: false, error: 'A request is already pending for this email.' },
        { status: 400 }
      );
    }

    // Insert the new access request
    const { data, error } = await supabase
      .from('access_requests')
      .insert({
        email: email.toLowerCase(),
        name: name || email.split('@')[0],
        requested_role: 'volunteer_instructor',
        reason: reason || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      request: data,
      message: 'Your request has been submitted. An administrator will review it shortly.',
    });
  } catch (error) {
    console.error('Error submitting access request:', error);
    return NextResponse.json({ success: false, error: 'Failed to submit request' }, { status: 500 });
  }
}
