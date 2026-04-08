import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const { id: studentId } = await params;

  try {
    const supabase = getSupabaseAdmin();

    // Find lab_users record for this student
    const { data: student } = await supabase
      .from('students')
      .select('email')
      .eq('id', studentId)
      .single();

    if (!student?.email) {
      return NextResponse.json({ signups: [] });
    }

    // Find their lab_users ID
    const { data: labUser } = await supabase
      .from('lab_users')
      .select('id')
      .ilike('email', student.email)
      .single();

    if (!labUser) {
      return NextResponse.json({ signups: [] });
    }

    // Fetch open lab signups linked to this user
    const { data: signups, error } = await supabase
      .from('open_lab_signups')
      .select('id, program_level, what_to_work_on, created_at, session:open_lab_sessions(date), requested_instructor:lab_users!open_lab_signups_requested_instructor_id_fkey(name)')
      .eq('student_user_id', labUser.id)
      .is('cancelled_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching open lab history:', error);
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }

    // Flatten session date into top level
    const formatted = (signups || []).map((s: any) => ({
      id: s.id,
      date: s.session?.date || '',
      program_level: s.program_level,
      what_to_work_on: s.what_to_work_on,
      requested_instructor: s.requested_instructor,
      created_at: s.created_at,
    }));

    return NextResponse.json({ signups: formatted });
  } catch (err) {
    console.error('Open lab history error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
