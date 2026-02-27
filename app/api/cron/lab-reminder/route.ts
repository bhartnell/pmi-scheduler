import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createNotification } from '@/lib/notifications';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LabDayRow {
  id: string;
  date: string;
  week_number: number | null;
  day_number: number | null;
  start_time: string | null;
  location: string | null;
  cohort_id: string;
  cohort: {
    id: string;
    cohort_number: number;
    program: { abbreviation: string } | null;
  } | null;
  stations: LabStationRow[];
}

interface LabStationRow {
  id: string;
  station_number: number | null;
  station_type: string | null;
  custom_title: string | null;
  instructor_id: string | null;
  instructor_email: string | null;
  instructor_name: string | null;
  additional_instructor_id: string | null;
}

interface StudentRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns "tomorrow" as YYYY-MM-DD (UTC). */
function getTomorrowStr(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split('T')[0];
}

function formatTime(timeString: string | null): string {
  if (!timeString) return '';
  const parts = timeString.split(':');
  const hour = parseInt(parts[0], 10);
  const minutes = parts[1] ?? '00';
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return ` at ${hour12}:${minutes} ${ampm}`;
}

// ---------------------------------------------------------------------------
// GET /api/cron/lab-reminder
//
// Runs daily at 5 PM UTC. Finds all lab_days scheduled for tomorrow and
// notifies every student in the cohort plus assigned instructors.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[LAB-REMINDER] Unauthorized cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const tomorrowStr = getTomorrowStr();
  console.log(
    '[LAB-REMINDER] Cron started at',
    new Date().toISOString(),
    '| checking date:',
    tomorrowStr
  );

  const supabase = getSupabaseAdmin();

  // Fetch all lab days scheduled for tomorrow with stations and cohort info
  const { data: labDays, error: labDaysError } = await supabase
    .from('lab_days')
    .select(`
      id,
      date,
      week_number,
      day_number,
      start_time,
      location,
      cohort_id,
      cohort:cohorts(
        id,
        cohort_number,
        program:programs(abbreviation)
      ),
      stations:lab_stations(
        id,
        station_number,
        station_type,
        custom_title,
        instructor_id,
        instructor_email,
        instructor_name,
        additional_instructor_id
      )
    `)
    .eq('date', tomorrowStr);

  if (labDaysError) {
    console.error('[LAB-REMINDER] Error fetching lab days:', labDaysError.message);
    return NextResponse.json(
      { error: 'Failed to fetch lab days', detail: labDaysError.message },
      { status: 500 }
    );
  }

  if (!labDays || labDays.length === 0) {
    console.log('[LAB-REMINDER] No lab days found for', tomorrowStr);
    return NextResponse.json({
      success: true,
      lab_days_found: 0,
      notifications_sent: 0,
      duration_ms: Date.now() - startTime,
    });
  }

  console.log(`[LAB-REMINDER] Found ${labDays.length} lab day(s) for ${tomorrowStr}`);

  // Build dedup set from recent notifications (sent in last 24 hours)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentNotifications } = await supabase
    .from('user_notifications')
    .select('user_email, reference_id')
    .eq('reference_type', 'lab_reminder_day')
    .gte('created_at', oneDayAgo);

  // "<user_email>:<lab_day_id>"
  const alreadySentSet = new Set<string>(
    (recentNotifications || []).map(
      (n: { user_email: string; reference_id: string | null }) =>
        `${n.user_email}:${n.reference_id ?? ''}`
    )
  );

  let notificationsSent = 0;
  const errors: string[] = [];

  for (const labDay of labDays as unknown as LabDayRow[]) {
    const cohort = labDay.cohort as LabDayRow['cohort'];
    const program = cohort?.program as { abbreviation: string } | null;
    const cohortLabel = cohort
      ? `${program?.abbreviation ?? 'PMI'} Cohort ${cohort.cohort_number}`
      : 'Lab';
    const timeStr = formatTime(labDay.start_time);
    const locationStr = labDay.location ? ` at ${labDay.location}` : '';

    // Collect instructor email addresses from stations
    const instructorEmailSet = new Set<string>();
    for (const station of (labDay.stations as LabStationRow[]) || []) {
      if (station.instructor_email) {
        instructorEmailSet.add(station.instructor_email);
      }
    }

    // Also look up instructor emails via station_instructors junction table for this lab day
    const stationIds = ((labDay.stations as LabStationRow[]) || []).map((s) => s.id);
    if (stationIds.length > 0) {
      const { data: junctionInstructors } = await supabase
        .from('station_instructors')
        .select('user_email')
        .in('station_id', stationIds);
      for (const ji of junctionInstructors || []) {
        if (ji.user_email) instructorEmailSet.add(ji.user_email);
      }
    }

    // Fetch all active students in this cohort
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, first_name, last_name, email')
      .eq('cohort_id', labDay.cohort_id)
      .eq('status', 'active');

    if (studentsError) {
      errors.push(`Failed to fetch students for cohort ${labDay.cohort_id}: ${studentsError.message}`);
      continue;
    }

    // Send to instructors
    for (const instructorEmail of instructorEmailSet) {
      const dedupKey = `${instructorEmail}:${labDay.id}`;
      if (alreadySentSet.has(dedupKey)) continue;

      try {
        await createNotification({
          userEmail: instructorEmail,
          title: 'Lab Tomorrow',
          message: `You are scheduled to instruct a lab for ${cohortLabel} tomorrow${timeStr}${locationStr}. Please review station materials and ensure equipment is ready.`,
          type: 'lab_reminder',
          category: 'labs',
          linkUrl: '/lab-management',
          referenceType: 'lab_reminder_day',
          referenceId: labDay.id,
        });
        notificationsSent++;
        alreadySentSet.add(dedupKey);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Instructor notification for ${instructorEmail} (lab_day ${labDay.id}) failed: ${msg}`);
      }
    }

    // Send to students
    for (const student of (students as StudentRow[]) || []) {
      if (!student.email) continue;

      const dedupKey = `${student.email}:${labDay.id}`;
      if (alreadySentSet.has(dedupKey)) continue;

      try {
        await createNotification({
          userEmail: student.email,
          title: 'Lab Tomorrow',
          message: `You have a lab session for ${cohortLabel} tomorrow${timeStr}${locationStr}. Please arrive on time and bring your required equipment.`,
          type: 'lab_reminder',
          category: 'labs',
          linkUrl: '/lab-management',
          referenceType: 'lab_reminder_day',
          referenceId: labDay.id,
        });
        notificationsSent++;
        alreadySentSet.add(dedupKey);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(
          `Student notification for ${student.email} (lab_day ${labDay.id}) failed: ${msg}`
        );
      }
    }
  }

  const summary = {
    success: true,
    lab_days_found: labDays.length,
    notifications_sent: notificationsSent,
    errors,
    duration_ms: Date.now() - startTime,
  };

  console.log('[LAB-REMINDER] Completed:', summary);
  return NextResponse.json(summary);
}
