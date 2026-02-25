import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// Returns the highest flag level per student for a list of student IDs
// Used by the student list page to show flag indicators
export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data: callerUser } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', session.user.email)
    .single();

  if (!callerUser || !hasMinRole(callerUser.role, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const studentIdsParam = searchParams.get('studentIds');

  if (!studentIdsParam) {
    return NextResponse.json({ success: true, flags: {} });
  }

  const studentIds = studentIdsParam.split(',').filter(Boolean);
  if (studentIds.length === 0) {
    return NextResponse.json({ success: true, flags: {} });
  }

  try {
    // Fetch all flagged notes for the given students
    const { data, error } = await supabase
      .from('student_notes')
      .select('student_id, flag_level')
      .in('student_id', studentIds)
      .eq('is_flagged', true);

    if (error) throw error;

    // Build a map of student_id -> highest flag level
    // red > yellow
    const flags: Record<string, 'yellow' | 'red'> = {};

    for (const note of data || []) {
      const current = flags[note.student_id];
      if (note.flag_level === 'red') {
        flags[note.student_id] = 'red';
      } else if (note.flag_level === 'yellow' && current !== 'red') {
        flags[note.student_id] = 'yellow';
      }
    }

    return NextResponse.json({ success: true, flags });
  } catch (error) {
    console.error('Error fetching notes summary:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch notes summary' }, { status: 500 });
  }
}
