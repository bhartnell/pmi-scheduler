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

    if (!body.note?.trim()) {
      return NextResponse.json({ error: 'Note content is required' }, { status: 400 });
    }

    // Verify the learning plan exists for this student
    const { data: plan, error: planError } = await supabase
      .from('learning_plans')
      .select('id')
      .eq('student_id', studentId)
      .maybeSingle();

    if (planError) throw planError;
    if (!plan) {
      return NextResponse.json({ error: 'No learning plan found for this student' }, { status: 404 });
    }

    const { data: note, error: noteError } = await supabase
      .from('learning_plan_notes')
      .insert({
        plan_id: plan.id,
        note: body.note.trim(),
        created_by: callerUser.name || callerUser.email,
      })
      .select('*')
      .single();

    if (noteError) throw noteError;

    return NextResponse.json({ success: true, note });
  } catch (error) {
    console.error('Error adding learning plan note:', error);
    return NextResponse.json({ success: false, error: 'Failed to add note' }, { status: 500 });
  }
}
