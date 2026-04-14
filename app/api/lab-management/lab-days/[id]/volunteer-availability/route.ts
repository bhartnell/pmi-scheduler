import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

type AvailabilityKind = 'full' | 'am' | 'pm' | 'half' | 'unknown';

interface VolunteerRow {
  name: string;
  email: string | null;
  notes: string | null;
  availability: AvailabilityKind;
  startHour: number; // 24h, decimal-ish
  endHour: number;
  assignedStation: string | null;
}

/**
 * Classify a volunteer registration note into an availability window.
 * Matches the simple rules requested by the coordinator UI:
 *   - empty / "full day" → full day bar  (9–17)
 *   - contains "AM" or "morning" → AM only (9–13)
 *   - contains "PM" / "noon" / "12" → PM only (12–17)
 *   - contains "half"  → half day  (9–13)
 *   - default → unknown (full width gray)
 * Order matters: check AM before PM so an "AM only" note doesn't get pulled
 * in by the digit 12 heuristic. "half" is checked before AM/PM so an ambiguous
 * "half day" note gets the half bucket.
 */
function classifyNote(rawNote: string | null): {
  kind: AvailabilityKind;
  startHour: number;
  endHour: number;
} {
  if (!rawNote || rawNote.trim() === '') {
    return { kind: 'full', startHour: 9, endHour: 17 };
  }

  const note = rawNote.toLowerCase();

  if (/\bfull\s*day\b/.test(note)) {
    return { kind: 'full', startHour: 9, endHour: 17 };
  }
  if (/\bhalf\b/.test(note)) {
    return { kind: 'half', startHour: 9, endHour: 13 };
  }
  // AM / morning — check before PM because notes can mention both
  if (/\bam\b/.test(note) || /morning/.test(note)) {
    return { kind: 'am', startHour: 9, endHour: 13 };
  }
  if (/\bpm\b/.test(note) || /noon/.test(note) || /\b12\b/.test(note)) {
    return { kind: 'pm', startHour: 12, endHour: 17 };
  }

  // Default: they registered but left a note we can't classify — show full
  // width so they don't get hidden, but label unknown so the UI can tint.
  return { kind: 'unknown', startHour: 9, endHour: 17 };
}

/**
 * GET /api/lab-management/lab-days/[id]/volunteer-availability
 *
 * Returns volunteer registrations for the linked volunteer_event, with each
 * volunteer's parsed availability window and their station assignment (if any).
 *
 * Response:
 *   { success: true, volunteers: VolunteerRow[] }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();

  try {
    // 1. Find all volunteer_events linked to this lab day.
    const { data: events, error: eventsError } = await supabase
      .from('volunteer_events')
      .select('id')
      .eq('linked_lab_day_id', labDayId);

    if (eventsError) throw eventsError;

    const eventIds = (events || []).map((e: { id: string }) => e.id);

    if (eventIds.length === 0) {
      return NextResponse.json({ success: true, volunteers: [] });
    }

    // 2. Fetch all registrations for those events (registered status only).
    const { data: regs, error: regsError } = await supabase
      .from('volunteer_registrations')
      .select('id, name, email, notes, status, volunteer_type')
      .in('event_id', eventIds)
      .eq('status', 'registered');

    if (regsError) throw regsError;

    // 3. Fetch stations on this lab day (for examiner assignment matching).
    //    Match by instructor_email (case-insensitive).
    const { data: stations } = await supabase
      .from('lab_stations')
      .select('id, station_number, custom_title, instructor_name, instructor_email, scenario:scenarios(title)')
      .eq('lab_day_id', labDayId);

    // Build email → station display name map.
    const emailToStation: Record<string, string> = {};
    for (const s of stations || []) {
      if (!s.instructor_email) continue;
      const scenario = s.scenario as unknown as { title?: string } | null;
      const label =
        s.custom_title ||
        scenario?.title ||
        `Station ${s.station_number}`;
      emailToStation[s.instructor_email.toLowerCase()] = label;
    }

    // 4. Build the volunteer row list.
    const volunteers: VolunteerRow[] = (regs || []).map((r: {
      name: string;
      email: string | null;
      notes: string | null;
    }) => {
      const classification = classifyNote(r.notes);
      const email = r.email ? r.email.toLowerCase() : null;
      const assignedStation = email ? emailToStation[email] || null : null;
      return {
        name: r.name,
        email: r.email,
        notes: r.notes,
        availability: classification.kind,
        startHour: classification.startHour,
        endHour: classification.endHour,
        assignedStation,
      };
    });

    // Sort: assigned volunteers first, then alphabetically.
    volunteers.sort((a, b) => {
      const aAssigned = a.assignedStation ? 0 : 1;
      const bAssigned = b.assignedStation ? 0 : 1;
      if (aAssigned !== bAssigned) return aAssigned - bAssigned;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ success: true, volunteers });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    // If the underlying tables don't exist yet, return empty instead of 500.
    if (msg.includes('does not exist')) {
      return NextResponse.json({ success: true, volunteers: [] });
    }
    console.error('Error fetching volunteer availability:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch volunteer availability' },
      { status: 500 }
    );
  }
}
