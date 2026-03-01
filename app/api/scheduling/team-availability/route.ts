import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// Convert a TIME string "HH:MM" or "HH:MM:SS" to minutes since midnight
function timeToMinutes(time: string): number {
  const parts = time.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

// Convert minutes since midnight back to "HH:MM"
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

interface AvailabilityRow {
  date: string;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
  instructor_id: string;
  instructor: { id: string; name: string; email: string } | null;
}

interface OverlapWindow {
  date: string;
  day_name: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
}

interface InstructorDaySlot {
  start: number; // minutes since midnight
  end: number;
}

// Find overlapping windows for a given date across all instructors
function computeOverlap(
  date: string,
  instructorSlots: Map<string, InstructorDaySlot[]>,
  requiredEmails: string[]
): OverlapWindow[] {
  const overlaps: OverlapWindow[] = [];

  // All required instructors must have slots for this date
  for (const email of requiredEmails) {
    if (!instructorSlots.has(email) || instructorSlots.get(email)!.length === 0) {
      return [];
    }
  }

  // Collect all boundary points
  const boundaries = new Set<number>();
  for (const email of requiredEmails) {
    for (const slot of instructorSlots.get(email)!) {
      boundaries.add(slot.start);
      boundaries.add(slot.end);
    }
  }

  const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);

  // For each interval between boundaries, check if ALL instructors cover it
  for (let i = 0; i < sortedBoundaries.length - 1; i++) {
    const segStart = sortedBoundaries[i];
    const segEnd = sortedBoundaries[i + 1];
    if (segEnd <= segStart) continue;

    const midpoint = (segStart + segEnd) / 2;
    const allCover = requiredEmails.every(email => {
      const slots = instructorSlots.get(email) || [];
      return slots.some(slot => slot.start <= midpoint && midpoint < slot.end);
    });

    if (allCover) {
      overlaps.push({
        date,
        day_name: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
        start_time: minutesToTime(segStart),
        end_time: minutesToTime(segEnd),
        duration_minutes: segEnd - segStart,
      });
    }
  }

  // Merge contiguous segments
  const merged: OverlapWindow[] = [];
  for (const window of overlaps) {
    if (
      merged.length > 0 &&
      merged[merged.length - 1].end_time === window.start_time
    ) {
      const last = merged[merged.length - 1];
      last.end_time = window.end_time;
      last.duration_minutes += window.duration_minutes;
    } else {
      merged.push({ ...window });
    }
  }

  return merged;
}

// GET - Find overlapping availability across selected instructors
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const emailsParam = searchParams.get('emails');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (!emailsParam) {
      return NextResponse.json({ success: false, error: 'emails parameter is required' }, { status: 400 });
    }

    const emails = emailsParam.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

    if (emails.length < 2) {
      return NextResponse.json({ success: false, error: 'At least 2 instructor emails are required' }, { status: 400 });
    }

    if (!startDate || !endDate) {
      return NextResponse.json({ success: false, error: 'start_date and end_date are required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch instructor user records for the given emails
    const { data: instructorUsers, error: usersError } = await supabase
      .from('lab_users')
      .select('id, name, email')
      .in('email', emails);

    if (usersError) throw usersError;

    const instructorIds = (instructorUsers || []).map((u: { id: string }) => u.id);

    if (instructorIds.length === 0) {
      return NextResponse.json({ success: true, overlaps: [], individual: [] });
    }

    // Fetch availability for all matching instructors in the date range
    const { data: availability, error: availError } = await supabase
      .from('instructor_availability')
      .select(`
        date,
        start_time,
        end_time,
        is_all_day,
        instructor_id,
        instructor:instructor_id(id, name, email)
      `)
      .in('instructor_id', instructorIds)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date')
      .order('start_time');

    if (availError) throw availError;

    const rows = (availability || []) as unknown as AvailabilityRow[];

    // Build a map: email -> date -> slots
    const emailDateSlots = new Map<string, Map<string, InstructorDaySlot[]>>();
    for (const row of rows) {
      const email = row.instructor?.email?.toLowerCase() || '';
      if (!email) continue;

      if (!emailDateSlots.has(email)) {
        emailDateSlots.set(email, new Map());
      }
      const dateMap = emailDateSlots.get(email)!;
      if (!dateMap.has(row.date)) {
        dateMap.set(row.date, []);
      }

      // All-day availability = 00:00 to 23:59
      const startMin = row.is_all_day ? 0 : timeToMinutes(row.start_time || '00:00');
      const endMin = row.is_all_day ? 23 * 60 + 59 : timeToMinutes(row.end_time || '23:59');

      dateMap.get(row.date)!.push({ start: startMin, end: endMin });
    }

    // Gather all unique dates present in any instructor's data
    const allDates = new Set<string>();
    for (const dateMap of emailDateSlots.values()) {
      for (const date of dateMap.keys()) {
        allDates.add(date);
      }
    }

    // Compute overlaps for each date
    const allOverlaps: OverlapWindow[] = [];
    for (const date of Array.from(allDates).sort()) {
      // Build per-email slot map for this date
      const daySlots = new Map<string, InstructorDaySlot[]>();
      for (const email of emails) {
        const slots = emailDateSlots.get(email)?.get(date) || [];
        daySlots.set(email, slots);
      }

      const dateOverlaps = computeOverlap(date, daySlots, emails);
      allOverlaps.push(...dateOverlaps);
    }

    // Build individual availability for display (per instructor, per date)
    const individualMap: Record<string, { name: string; email: string; slots: Array<{ date: string; start_time: string; end_time: string; is_all_day: boolean }> }> = {};
    for (const row of rows) {
      const email = row.instructor?.email?.toLowerCase() || '';
      if (!email) continue;

      if (!individualMap[email]) {
        individualMap[email] = {
          name: row.instructor?.name || email,
          email,
          slots: [],
        };
      }
      individualMap[email].slots.push({
        date: row.date,
        start_time: row.is_all_day ? '00:00' : (row.start_time || '00:00'),
        end_time: row.is_all_day ? '23:59' : (row.end_time || '23:59'),
        is_all_day: row.is_all_day,
      });
    }

    return NextResponse.json({
      success: true,
      overlaps: allOverlaps,
      individual: Object.values(individualMap),
    });
  } catch (error) {
    console.error('Error computing team availability:', error);
    return NextResponse.json({ success: false, error: 'Failed to compute team availability' }, { status: 500 });
  }
}

// POST - Save a team availability view for reuse
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, instructor_emails } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }

    if (!Array.isArray(instructor_emails) || instructor_emails.length < 2) {
      return NextResponse.json({ success: false, error: 'At least 2 instructor emails are required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('team_availability_views')
      .insert({
        name: name.trim(),
        instructor_emails: instructor_emails.map((e: string) => e.toLowerCase().trim()),
        created_by: session.user.email.toLowerCase(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, view: data });
  } catch (error) {
    console.error('Error saving team view:', error);
    return NextResponse.json({ success: false, error: 'Failed to save team view' }, { status: 500 });
  }
}
