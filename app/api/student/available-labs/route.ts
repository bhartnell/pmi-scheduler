import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/student/available-labs
 * Returns upcoming lab days with open spots for student self-scheduling.
 * Includes current signup count, capacity, and whether the student is already signed up.
 *
 * Query params:
 *   - startDate: ISO date string (default: today)
 *   - endDate:   ISO date string (default: 90 days from today)
 *   - search:    string to filter by title or location
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Verify this is a student account
    const { data: labUser, error: labUserError } = await supabase
      .from('lab_users')
      .select('id, name, email, role')
      .ilike('email', session.user.email)
      .single();

    if (labUserError || !labUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (labUser.role !== 'student') {
      return NextResponse.json({ success: false, error: 'Student access only' }, { status: 403 });
    }

    // Resolve student record
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, cohort_id')
      .ilike('email', session.user.email)
      .single();

    if (studentError || !student) {
      return NextResponse.json(
        { success: false, error: 'Student record not found. Contact your instructor.' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const today = new Date().toISOString().split('T')[0];
    const defaultEnd = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const startDate = searchParams.get('startDate') || today;
    const endDate = searchParams.get('endDate') || defaultEnd;
    const search = searchParams.get('search') || '';

    // Fetch upcoming lab days
    let labQuery = supabase
      .from('lab_days')
      .select(`
        id,
        date,
        title,
        start_time,
        end_time,
        notes,
        cohort_id,
        cohort:cohorts(
          id,
          cohort_number,
          program:programs(name, abbreviation)
        )
      `)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    const { data: labDays, error: labDaysError } = await labQuery;

    if (labDaysError) throw labDaysError;

    if (!labDays || labDays.length === 0) {
      return NextResponse.json({ success: true, labs: [] });
    }

    const labDayIds = labDays.map((ld: { id: string }) => ld.id);

    // Fetch all active signups for these lab days
    const { data: signups, error: signupsError } = await supabase
      .from('student_lab_signups')
      .select('id, lab_day_id, student_id, status, waitlist_position')
      .in('lab_day_id', labDayIds)
      .neq('status', 'cancelled');

    if (signupsError) throw signupsError;

    // Fetch the current student's own signups to mark already-signed-up labs
    const mySignups = (signups || []).filter(
      (s: { student_id: string }) => s.student_id === student.id
    );

    // Build a map of lab_day_id -> signup counts
    const signupCounts: Record<string, { confirmed: number; waitlisted: number }> = {};
    for (const s of signups || []) {
      if (!signupCounts[s.lab_day_id]) {
        signupCounts[s.lab_day_id] = { confirmed: 0, waitlisted: 0 };
      }
      if (s.status === 'confirmed') signupCounts[s.lab_day_id].confirmed++;
      if (s.status === 'waitlisted') signupCounts[s.lab_day_id].waitlisted++;
    }

    // Build a map of lab_day_id -> this student's signup
    const mySignupMap: Record<string, { id: string; status: string; waitlist_position: number | null }> = {};
    for (const s of mySignups) {
      mySignupMap[s.lab_day_id] = {
        id: s.id,
        status: s.status,
        waitlist_position: s.waitlist_position,
      };
    }

    // Default capacity per lab day (can be expanded to use a real column later)
    const DEFAULT_CAPACITY = 20;

    // Assemble the response, applying optional search filter
    type LabDayRow = {
      id: string;
      date: string;
      title: string | null;
      start_time: string | null;
      end_time: string | null;
      notes: string | null;
      cohort_id: string | null;
      cohort: { id: string; cohort_number: string; program: { name: string; abbreviation: string } | null } | null;
    };
    const searchLower = search.toLowerCase();
    const labs = (labDays as unknown as LabDayRow[])
      .map((ld) => {
        const counts = signupCounts[ld.id] || { confirmed: 0, waitlisted: 0 };
        const capacity = DEFAULT_CAPACITY;
        const spotsRemaining = Math.max(0, capacity - counts.confirmed);
        const mySignup = mySignupMap[ld.id] || null;

        return {
          id: ld.id,
          date: ld.date,
          title: ld.title || `Lab Day`,
          start_time: ld.start_time,
          end_time: ld.end_time,
          notes: ld.notes,
          cohort: ld.cohort,
          capacity,
          confirmed_count: counts.confirmed,
          waitlisted_count: counts.waitlisted,
          spots_remaining: spotsRemaining,
          is_full: spotsRemaining === 0,
          my_signup: mySignup,
        };
      })
      .filter((lab: { title: string; notes: string | null }) => {
        if (!searchLower) return true;
        const titleMatch = lab.title.toLowerCase().includes(searchLower);
        const notesMatch = (lab.notes || '').toLowerCase().includes(searchLower);
        return titleMatch || notesMatch;
      });

    return NextResponse.json({ success: true, labs });
  } catch (error) {
    console.error('Error fetching available labs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch available labs' },
      { status: 500 }
    );
  }
}
