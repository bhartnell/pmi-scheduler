import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InstructorUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AvailabilityRecord {
  instructor_id: string;
  date: string;
  created_at: string;
}

interface ReminderRecord {
  user_email: string;
  created_at: string;
  reference_id: string; // The week start date used as dedup key
}

interface InstructorStatus {
  id: string;
  email: string;
  name: string;
  role: string;
  has_submitted: boolean;
  last_submitted: string | null;
  last_reminder_sent: string | null;
}

// ---------------------------------------------------------------------------
// GET /api/scheduling/availability-status
//
// Returns submission status for all instructors for a given week.
//
// Query params:
//   week: YYYY-MM-DD — the Monday (start) of the week to check (required)
//
// Role restriction: admin, superadmin, lead_instructor
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Look up current user and role
    const { data: currentUser, error: userError } = await supabase
      .from('lab_users')
      .select('id, name, email, role')
      .ilike('email', session.user.email)
      .single();

    if (userError || !currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Only lead_instructor and above can view availability status
    if (!hasMinRole(currentUser.role, 'lead_instructor')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions. Lead Instructor or higher required.' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const weekParam = searchParams.get('week');

    if (!weekParam) {
      return NextResponse.json(
        { success: false, error: 'week query parameter is required (YYYY-MM-DD format, Monday)' },
        { status: 400 }
      );
    }

    // Validate and compute week boundaries
    const weekStart = new Date(weekParam + 'T00:00:00');
    if (isNaN(weekStart.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid week parameter. Use YYYY-MM-DD format.' },
        { status: 400 }
      );
    }

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Sun = Mon + 6

    const weekStartStr = weekParam;
    const weekEndStr = toDateString(weekEnd);

    // Fetch all active instructors
    const { data: instructors, error: instructorError } = await supabase
      .from('lab_users')
      .select('id, name, email, role')
      .in('role', ['instructor', 'lead_instructor', 'volunteer_instructor', 'admin', 'superadmin'])
      .eq('is_active', true)
      .order('name');

    if (instructorError) {
      throw instructorError;
    }

    // Fetch all availability for the week
    const { data: availability, error: availError } = await supabase
      .from('instructor_availability')
      .select('instructor_id, date, created_at')
      .gte('date', weekStartStr)
      .lte('date', weekEndStr);

    if (availError) {
      throw availError;
    }

    // Fetch reminder notifications sent for this week
    // We identify them by reference_type='availability_reminder' and reference_id = weekStartStr
    const instructorEmails = (instructors as InstructorUser[]).map((i) => i.email);
    let reminders: ReminderRecord[] = [];

    if (instructorEmails.length > 0) {
      const { data: reminderData } = await supabase
        .from('user_notifications')
        .select('user_email, created_at, reference_id')
        .in('user_email', instructorEmails)
        .eq('reference_type', 'availability_reminder')
        .eq('reference_id', weekStartStr)
        .order('created_at', { ascending: false });

      reminders = (reminderData || []) as ReminderRecord[];
    }

    // Build lookup: instructor_id -> most recent submission date for this week
    const submissionMap = new Map<string, string>(); // instructor_id -> created_at of first submission
    for (const record of (availability || []) as AvailabilityRecord[]) {
      if (!submissionMap.has(record.instructor_id)) {
        submissionMap.set(record.instructor_id, record.created_at);
      }
    }

    // Build lookup: email -> most recent reminder sent date
    const reminderMap = new Map<string, string>(); // email -> created_at
    for (const reminder of reminders) {
      if (!reminderMap.has(reminder.user_email)) {
        reminderMap.set(reminder.user_email, reminder.created_at);
      }
    }

    // Build response
    const instructorStatuses: InstructorStatus[] = (instructors as InstructorUser[]).map(
      (instructor) => ({
        id: instructor.id,
        email: instructor.email,
        name: instructor.name,
        role: instructor.role,
        has_submitted: submissionMap.has(instructor.id),
        last_submitted: submissionMap.get(instructor.id) ?? null,
        last_reminder_sent: reminderMap.get(instructor.email) ?? null,
      })
    );

    const submitted = instructorStatuses.filter((i) => i.has_submitted);
    const notSubmitted = instructorStatuses.filter((i) => !i.has_submitted);

    return NextResponse.json({
      success: true,
      week: weekStartStr,
      week_end: weekEndStr,
      instructors: instructorStatuses,
      summary: {
        total: instructorStatuses.length,
        submitted: submitted.length,
        not_submitted: notSubmitted.length,
        percent_submitted:
          instructorStatuses.length > 0
            ? Math.round((submitted.length / instructorStatuses.length) * 100)
            : 0,
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching availability status:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch availability status';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
