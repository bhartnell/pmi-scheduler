import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

async function getCallerUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, role, email, name')
    .ilike('email', email)
    .single();
  return data;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const callerUser = await getCallerUser(session.user.email);
  if (!callerUser || !hasMinRole(callerUser.role, 'lead_instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: studentId } = await params;

  try {
    const supabase = getSupabaseAdmin();

    // Fetch the learning plan for this student
    const { data: plan, error: planError } = await supabase
      .from('learning_plans')
      .select('*')
      .eq('student_id', studentId)
      .maybeSingle();

    if (planError) throw planError;

    if (!plan) {
      return NextResponse.json({ success: true, plan: null, notes: [] });
    }

    // Fetch progress notes for the plan
    const { data: notes, error: notesError } = await supabase
      .from('learning_plan_notes')
      .select('*')
      .eq('plan_id', plan.id)
      .order('created_at', { ascending: true });

    if (notesError) throw notesError;

    return NextResponse.json({ success: true, plan, notes: notes || [] });
  } catch (error) {
    console.error('Error fetching learning plan:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch learning plan' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const callerUser = await getCallerUser(session.user.email);
  if (!callerUser || !hasMinRole(callerUser.role, 'lead_instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: studentId } = await params;

  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const validStatuses = ['active', 'on_hold', 'completed', 'archived'];
    const status = validStatuses.includes(body.status) ? body.status : 'active';

    const planData = {
      student_id: studentId,
      goals: Array.isArray(body.goals) ? body.goals : [],
      accommodations: Array.isArray(body.accommodations) ? body.accommodations : [],
      custom_accommodations: body.custom_accommodations?.trim() || null,
      status,
      review_date: body.review_date || null,
      updated_at: new Date().toISOString(),
    };

    // Check if plan already exists (upsert by student_id unique constraint)
    const { data: existing } = await supabase
      .from('learning_plans')
      .select('id')
      .eq('student_id', studentId)
      .maybeSingle();

    let plan;
    if (existing) {
      // Update existing plan
      const { data, error } = await supabase
        .from('learning_plans')
        .update(planData)
        .eq('student_id', studentId)
        .select('*')
        .single();
      if (error) throw error;
      plan = data;
    } else {
      // Create new plan
      const { data, error } = await supabase
        .from('learning_plans')
        .insert({ ...planData, created_by: callerUser.email })
        .select('*')
        .single();
      if (error) throw error;
      plan = data;
    }

    return NextResponse.json({ success: true, plan });
  } catch (error) {
    console.error('Error saving learning plan:', error);
    return NextResponse.json({ success: false, error: 'Failed to save learning plan' }, { status: 500 });
  }
}
