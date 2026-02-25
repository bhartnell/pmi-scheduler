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
    .select('id, role, name')
    .ilike('email', email)
    .single();
  return user;
}

// GET /api/lab-management/lab-days/[id]/debrief
// Fetch all debriefs for a lab day
export async function GET(request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();

  const user = await getAuthenticatedUser(session.user.email);
  if (!user || !hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { data, error } = await supabase
      .from('lab_day_debriefs')
      .select('*')
      .eq('lab_day_id', labDayId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, debriefs: data || [] });
  } catch (error) {
    console.error('Error fetching debriefs:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch debriefs' }, { status: 500 });
  }
}

// POST /api/lab-management/lab-days/[id]/debrief
// Submit a new debrief (or update existing one if instructor already submitted)
export async function POST(request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();

  const user = await getAuthenticatedUser(session.user.email);
  if (!user || !hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { went_well, to_improve, student_concerns, equipment_issues, rating } = body;

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'rating is required and must be 1-5' }, { status: 400 });
    }

    // Check if this instructor already submitted a debrief for this lab day
    const { data: existing } = await supabase
      .from('lab_day_debriefs')
      .select('id')
      .eq('lab_day_id', labDayId)
      .eq('instructor_email', session.user.email)
      .maybeSingle();

    if (existing) {
      // Update the existing debrief
      const { data, error } = await supabase
        .from('lab_day_debriefs')
        .update({
          went_well: went_well?.trim() || null,
          to_improve: to_improve?.trim() || null,
          student_concerns: student_concerns?.trim() || null,
          equipment_issues: equipment_issues?.trim() || null,
          rating,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('*')
        .single();

      if (error) throw error;

      return NextResponse.json({ success: true, debrief: data, updated: true });
    }

    // Insert a new debrief
    const { data, error } = await supabase
      .from('lab_day_debriefs')
      .insert({
        lab_day_id: labDayId,
        instructor_email: session.user.email,
        went_well: went_well?.trim() || null,
        to_improve: to_improve?.trim() || null,
        student_concerns: student_concerns?.trim() || null,
        equipment_issues: equipment_issues?.trim() || null,
        rating,
      })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, debrief: data, updated: false });
  } catch (error) {
    console.error('Error submitting debrief:', error);
    return NextResponse.json({ success: false, error: 'Failed to submit debrief' }, { status: 500 });
  }
}

// PUT /api/lab-management/lab-days/[id]/debrief
// Update an existing debrief — only the original submitter may edit
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();

  const user = await getAuthenticatedUser(session.user.email);
  if (!user || !hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, went_well, to_improve, student_concerns, equipment_issues, rating } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'rating is required and must be 1-5' }, { status: 400 });
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('lab_day_debriefs')
      .select('id, instructor_email')
      .eq('id', id)
      .eq('lab_day_id', labDayId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'Debrief not found' }, { status: 404 });
    }

    if (existing.instructor_email !== session.user.email) {
      return NextResponse.json({ error: 'Forbidden: you can only edit your own debrief' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('lab_day_debriefs')
      .update({
        went_well: went_well?.trim() || null,
        to_improve: to_improve?.trim() || null,
        student_concerns: student_concerns?.trim() || null,
        equipment_issues: equipment_issues?.trim() || null,
        rating,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, debrief: data });
  } catch (error) {
    console.error('Error updating debrief:', error);
    return NextResponse.json({ success: false, error: 'Failed to update debrief' }, { status: 500 });
  }
}
