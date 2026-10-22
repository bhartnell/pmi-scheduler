import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireStudentContext } from '@/lib/view-as-student';

/**
 * GET /api/student/available-labs/my-signups
 * Returns the current student's lab day signups, categorized as:
 * - upcoming: confirmed or waitlisted, future lab days
 * - past: confirmed or waitlisted, past lab days
 * - cancelled: cancelled signups
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireStudentContext(request);
    if (auth instanceof NextResponse) return auth;
    if (!auth.found) {
      return NextResponse.json(
        { success: false, error: 'Student record not found. Contact your instructor.' },
        { status: 404 }
      );
    }
    const student = { id: auth.id };
    const supabase = getSupabaseAdmin();

    // Fetch all signups for this student
    const { data: signups, error: signupsError } = await supabase
      .from('student_lab_signups')
      .select(`
        id,
        lab_day_id,
        status,
        waitlist_position,
        signed_up_at,
        cancelled_at,
        cancel_reason,
        lab_day:lab_day_id(
          id,
          date,
          title,
          start_time,
          end_time,
          notes,
          cohort:cohorts(
            id,
            cohort_number,
            program:programs(name, abbreviation)
          )
        )
      `)
      .eq('student_id', student.id)
      .order('signed_up_at', { ascending: false });

    if (signupsError) throw signupsError;

    const today = new Date().toISOString().split('T')[0];

    const upcoming: typeof signups = [];
    const past: typeof signups = [];
    const cancelled: typeof signups = [];

    for (const s of signups || []) {
      const labDay = s.lab_day as unknown as { date: string } | null;
      const labDate = labDay?.date || '';

      if (s.status === 'cancelled') {
        cancelled.push(s);
      } else if (labDate >= today) {
        upcoming.push(s);
      } else {
        past.push(s);
      }
    }

    // Sort upcoming by date ascending, past by date descending
    upcoming.sort((a, b) => {
      const aDate = (a.lab_day as unknown as { date: string } | null)?.date || '';
      const bDate = (b.lab_day as unknown as { date: string } | null)?.date || '';
      return aDate.localeCompare(bDate);
    });

    past.sort((a, b) => {
      const aDate = (a.lab_day as unknown as { date: string } | null)?.date || '';
      const bDate = (b.lab_day as unknown as { date: string } | null)?.date || '';
      return bDate.localeCompare(aDate);
    });

    return NextResponse.json({
      success: true,
      signups: {
        upcoming,
        past,
        cancelled,
      },
    });
  } catch (error) {
    console.error('Error fetching student signups:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch signups' },
      { status: 500 }
    );
  }
}
