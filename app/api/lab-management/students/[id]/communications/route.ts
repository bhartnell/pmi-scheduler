import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

type RouteContext = { params: Promise<{ id: string }> };

async function getAuthenticatedUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase
    .from('lab_users')
    .select('id, role, email, name')
    .ilike('email', email)
    .single();
  return user;
}

// GET /api/lab-management/students/[id]/communications
// List all communications for a student, ordered by created_at desc
// Optional query params: ?type=phone, ?flagged=true, ?search=keyword
export async function GET(request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getAuthenticatedUser(session.user.email);
  if (!user || !hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: studentId } = await params;
  const { searchParams } = new URL(request.url);
  const typeFilter = searchParams.get('type');
  const flaggedFilter = searchParams.get('flagged');
  const searchQuery = searchParams.get('search');

  try {
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('student_communications')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (typeFilter && ['phone', 'email', 'meeting', 'text', 'other'].includes(typeFilter)) {
      query = query.eq('comm_type', typeFilter);
    }

    if (flaggedFilter === 'true') {
      query = query.eq('is_flagged', true);
    }

    if (searchQuery && searchQuery.trim()) {
      const term = `%${searchQuery.trim()}%`;
      query = query.or(`subject.ilike.${term},summary.ilike.${term}`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, communications: data || [] });
  } catch (error) {
    console.error('Error fetching student communications:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch communications' }, { status: 500 });
  }
}

// POST /api/lab-management/students/[id]/communications
// Add a new communication log entry
// Body: { comm_type, subject, summary, follow_up_needed?, follow_up_date?, is_flagged? }
export async function POST(request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getAuthenticatedUser(session.user.email);
  if (!user || !hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: studentId } = await params;

  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const validTypes = ['phone', 'email', 'meeting', 'text', 'other'];
    if (!body.comm_type || !validTypes.includes(body.comm_type)) {
      return NextResponse.json({ error: 'Invalid comm_type' }, { status: 400 });
    }
    if (!body.subject?.trim()) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    }
    if (!body.summary?.trim()) {
      return NextResponse.json({ error: 'Summary is required' }, { status: 400 });
    }

    const followUpNeeded = body.follow_up_needed === true;
    const followUpDate = followUpNeeded && body.follow_up_date ? body.follow_up_date : null;

    const { data, error } = await supabase
      .from('student_communications')
      .insert({
        student_id: studentId,
        comm_type: body.comm_type,
        subject: body.subject.trim(),
        summary: body.summary.trim(),
        follow_up_needed: followUpNeeded,
        follow_up_date: followUpDate,
        follow_up_completed: false,
        is_flagged: body.is_flagged === true,
        logged_by: user.email,
      })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, communication: data });
  } catch (error) {
    console.error('Error creating student communication:', error);
    return NextResponse.json({ success: false, error: 'Failed to create communication' }, { status: 500 });
  }
}

// PATCH /api/lab-management/students/[id]/communications
// Update communication - supports toggling follow_up_completed or is_flagged
// Body: { id, follow_up_completed?, is_flagged? }
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getAuthenticatedUser(session.user.email);
  if (!user || !hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: studentId } = await params;

  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Communication id is required' }, { status: 400 });
    }

    // Verify the communication belongs to the given student
    const { data: existing, error: fetchError } = await supabase
      .from('student_communications')
      .select('id, student_id')
      .eq('id', body.id)
      .eq('student_id', studentId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Communication not found' }, { status: 404 });
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.follow_up_completed === 'boolean') {
      updatePayload.follow_up_completed = body.follow_up_completed;
    }
    if (typeof body.is_flagged === 'boolean') {
      updatePayload.is_flagged = body.is_flagged;
    }

    const { data, error } = await supabase
      .from('student_communications')
      .update(updatePayload)
      .eq('id', body.id)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, communication: data });
  } catch (error) {
    console.error('Error updating student communication:', error);
    return NextResponse.json({ success: false, error: 'Failed to update communication' }, { status: 500 });
  }
}
