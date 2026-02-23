import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createBulkNotifications } from '@/lib/notifications';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { lab_day_id, coverage_needed, coverage_note } = await request.json();

    if (!lab_day_id || !coverage_needed) {
      return NextResponse.json(
        { error: 'lab_day_id and coverage_needed are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Get lab day details for notification
    const { data: labDay, error: labDayError } = await supabase
      .from('lab_days')
      .select(`
        id,
        date,
        title,
        start_time,
        end_time,
        cohort:cohorts(
          cohort_number,
          program:programs(name, abbreviation)
        )
      `)
      .eq('id', lab_day_id)
      .single();

    if (labDayError || !labDay) {
      return NextResponse.json({ error: 'Lab day not found' }, { status: 404 });
    }

    // Get all admin/superadmin users
    const { data: directors, error: directorsError } = await supabase
      .from('lab_users')
      .select('id, name, email')
      .in('role', ['admin', 'superadmin'])
      .eq('is_active', true);

    if (directorsError || !directors || directors.length === 0) {
      console.error('No directors found:', directorsError);
      return NextResponse.json({ error: 'No directors found to notify' }, { status: 404 });
    }

    // Format date for notification
    const formattedDate = new Date(labDay.date + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const cohortInfo = Array.isArray(labDay.cohort) ? labDay.cohort[0] : labDay.cohort;
    const programInfo = Array.isArray(cohortInfo.program) ? cohortInfo.program[0] : cohortInfo.program;
    const cohortName = `${programInfo.abbreviation} G${cohortInfo.cohort_number}`;
    const labTitle = labDay.title || 'Lab Day';

    // Build the new shift URL with pre-filled query params
    const shiftParams = new URLSearchParams({ date: labDay.date, labDayId: lab_day_id });
    if (labDay.start_time) shiftParams.set('start', labDay.start_time.slice(0, 5));
    if (labDay.end_time) shiftParams.set('end', labDay.end_time.slice(0, 5));
    const shiftUrl = `/scheduling/shifts/new?${shiftParams.toString()}`;

    // Create notifications for all directors
    const notifications = directors.map(director => ({
      userEmail: director.email,
      title: `Coverage Request: ${cohortName}`,
      message: `Instructor coverage needed for ${labTitle} on ${formattedDate}. ${coverage_needed} instructor${coverage_needed > 1 ? 's' : ''} needed.${coverage_note ? ` Note: ${coverage_note}` : ''}`,
      type: 'lab_assignment' as const,
      linkUrl: shiftUrl,
      referenceType: 'lab_day',
      referenceId: lab_day_id
    }));

    await createBulkNotifications(notifications);

    return NextResponse.json({
      success: true,
      message: `Notified ${directors.length} director${directors.length > 1 ? 's' : ''}`
    });
  } catch (error) {
    console.error('Error sending coverage request:', error);
    return NextResponse.json({ error: 'Failed to send coverage request' }, { status: 500 });
  }
}
