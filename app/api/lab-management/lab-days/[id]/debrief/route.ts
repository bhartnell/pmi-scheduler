import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/lab-management/lab-days/[id]/debrief
// Fetch all debriefs for a lab day
export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user } = auth;

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();



  try {
    const { data, error } = await supabase
      .from('lab_day_debriefs')
      .select('*')
      .eq('lab_day_id', labDayId)
      .order('created_at', { ascending: true });

    if (error) {
      if ((error as Error).message?.includes('does not exist')) {
        return NextResponse.json({ success: true, debriefs: [] });
      }
      throw error;
    }

    return NextResponse.json({ success: true, debriefs: data || [] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? (error as Error).message : String(error);
    if (msg.includes('does not exist')) {
      return NextResponse.json({ success: true, debriefs: [] });
    }
    console.error('Error fetching debriefs:', error);
    return NextResponse.json({ success: false, error: (error instanceof Error ? (error as Error).message : (error instanceof Error ? (error as Error).message : String(error))) || 'Failed to fetch debriefs' }, { status: 500 });
  }
}

// POST /api/lab-management/lab-days/[id]/debrief
// Submit a new debrief (or update existing one if instructor already submitted)
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user } = auth;

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();



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
      .eq('instructor_email', user.email)
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
        instructor_email: user.email,
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? (error as Error).message : String(error);
    if (msg.includes('does not exist')) {
      return NextResponse.json({ success: false, error: 'Debrief feature is not yet configured. Please run database migrations.' }, { status: 503 });
    }
    console.error('Error submitting debrief:', error);
    return NextResponse.json({ success: false, error: (error instanceof Error ? (error as Error).message : (error instanceof Error ? (error as Error).message : String(error))) || 'Failed to submit debrief' }, { status: 500 });
  }
}

// PUT /api/lab-management/lab-days/[id]/debrief
// Update an existing debrief — only the original submitter may edit
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user } = auth;

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();



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

    if (existing.instructor_email !== user.email) {
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? (error as Error).message : String(error);
    if (msg.includes('does not exist')) {
      return NextResponse.json({ success: false, error: 'Debrief feature is not yet configured. Please run database migrations.' }, { status: 503 });
    }
    console.error('Error updating debrief:', error);
    return NextResponse.json({ success: false, error: (error instanceof Error ? (error as Error).message : (error instanceof Error ? (error as Error).message : String(error))) || 'Failed to update debrief' }, { status: 500 });
  }
}
