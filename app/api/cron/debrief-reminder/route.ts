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
  cohort_id: string;
  cohort: {
    id: string;
    cohort_number: number;
    program: { abbreviation: string } | null;
  } | null;
  stations: StationRow[];
}

interface StationRow {
  id: string;
  instructor_email: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns yesterday as YYYY-MM-DD (UTC). */
function getYesterdayStr(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// GET /api/cron/debrief-reminder
//
// Runs daily at 7 AM MST (14:00 UTC). Finds all lab_days from yesterday
// that have zero debrief notes AND zero structured debriefs, and notifies
// all assigned instructors to submit their feedback.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[DEBRIEF-REMINDER] Unauthorized cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const yesterdayStr = getYesterdayStr();
  console.log(
    '[DEBRIEF-REMINDER] Cron started at',
    new Date().toISOString(),
    '| checking date:',
    yesterdayStr
  );

  const supabase = getSupabaseAdmin();

  // Fetch all lab days from yesterday with station info and cohort
  const { data: labDays, error: labDaysError } = await supabase
    .from('lab_days')
    .select(`
      id,
      date,
      week_number,
      day_number,
      cohort_id,
      cohort:cohorts(
        id,
        cohort_number,
        program:programs(abbreviation)
      ),
      stations:lab_stations(
        id,
        instructor_email
      )
    `)
    .eq('date', yesterdayStr);

  if (labDaysError) {
    console.error('[DEBRIEF-REMINDER] Error fetching lab days:', labDaysError.message);
    return NextResponse.json(
      { error: 'Failed to fetch lab days', detail: labDaysError.message },
      { status: 500 }
    );
  }

  if (!labDays || labDays.length === 0) {
    console.log('[DEBRIEF-REMINDER] No lab days found for', yesterdayStr);
    return NextResponse.json({
      success: true,
      lab_days_found: 0,
      notifications_sent: 0,
      duration_ms: Date.now() - startTime,
    });
  }

  console.log(`[DEBRIEF-REMINDER] Found ${labDays.length} lab day(s) for ${yesterdayStr}`);

  // Build dedup set from recent notifications (sent in last 48 hours)
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: recentNotifications } = await supabase
    .from('user_notifications')
    .select('user_email, reference_id')
    .eq('reference_type', 'debrief_reminder')
    .gte('created_at', twoDaysAgo);

  const alreadySentSet = new Set<string>(
    (recentNotifications || []).map(
      (n: { user_email: string; reference_id: string | null }) =>
        `${n.user_email}:${n.reference_id ?? ''}`
    )
  );

  let notificationsSent = 0;
  const errors: string[] = [];

  for (const labDay of labDays as unknown as LabDayRow[]) {
    // Check if any debrief notes exist for this lab day
    const { count: notesCount } = await supabase
      .from('lab_day_debrief_notes')
      .select('id', { count: 'exact', head: true })
      .eq('lab_day_id', labDay.id);

    // Check if any structured debriefs exist
    const { count: debriefCount } = await supabase
      .from('lab_day_debriefs')
      .select('id', { count: 'exact', head: true })
      .eq('lab_day_id', labDay.id);

    const totalDebriefs = (notesCount || 0) + (debriefCount || 0);
    if (totalDebriefs > 0) {
      console.log(`[DEBRIEF-REMINDER] Lab day ${labDay.id} already has ${totalDebriefs} debrief(s), skipping`);
      continue;
    }

    const cohort = labDay.cohort as LabDayRow['cohort'];
    const program = cohort?.program as { abbreviation: string } | null;
    const cohortLabel = cohort
      ? `${program?.abbreviation ?? 'PMI'} Cohort ${cohort.cohort_number}`
      : 'Lab';

    // Collect instructor emails from stations
    const instructorEmailSet = new Set<string>();
    for (const station of (labDay.stations as StationRow[]) || []) {
      if (station.instructor_email) {
        instructorEmailSet.add(station.instructor_email);
      }
    }

    // Also check station_instructors junction table
    const stationIds = ((labDay.stations as StationRow[]) || []).map((s) => s.id);
    if (stationIds.length > 0) {
      const { data: junctionInstructors } = await supabase
        .from('station_instructors')
        .select('user_email')
        .in('station_id', stationIds);
      for (const ji of junctionInstructors || []) {
        if (ji.user_email) instructorEmailSet.add(ji.user_email);
      }
    }

    // Send reminder to each instructor
    for (const instructorEmail of instructorEmailSet) {
      const dedupKey = `${instructorEmail}:${labDay.id}`;
      if (alreadySentSet.has(dedupKey)) continue;

      try {
        await createNotification({
          userEmail: instructorEmail,
          title: 'Debrief Reminder',
          message: `Yesterday's ${cohortLabel} lab has no debrief notes yet. Please take a moment to share your observations and feedback.`,
          type: 'lab_reminder',
          category: 'labs',
          linkUrl: `/lab-management/schedule/${labDay.id}#debrief-notes`,
          referenceType: 'debrief_reminder',
          referenceId: labDay.id,
        });
        notificationsSent++;
        alreadySentSet.add(dedupKey);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Debrief reminder for ${instructorEmail} (lab_day ${labDay.id}) failed: ${msg}`);
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

  console.log('[DEBRIEF-REMINDER] Completed:', summary);
  return NextResponse.json(summary);
}
