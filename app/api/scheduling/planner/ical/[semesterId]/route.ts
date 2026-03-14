import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// ICS date format: YYYYMMDDTHHMMSS
function toICSDate(dateStr: string, time: string): string {
  const [year, month, day] = dateStr.split('-');
  const [h, m] = time.split(':');
  return `${year}${month}${day}T${h}${m}00`;
}

// ICS day abbreviation mapping (0=SU, 1=MO, etc.)
const ICS_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function escapeICS(text: string): string {
  // ICS spec requires escaping backslash, semicolon, comma, newline
  let result = text;
  result = result.split(String.fromCharCode(92)).join(String.fromCharCode(92, 92));
  result = result.split(";").join(String.fromCharCode(92) + ";");
  result = result.split(",").join(String.fromCharCode(92) + ",");
  result = result.split(String.fromCharCode(10)).join(String.fromCharCode(92) + "n");
  return result;
}

function generateUID(blockId: string, semesterId: string): string {
  return `${blockId}-${semesterId}@pmi-scheduler`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ semesterId: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { semesterId } = await params;
    const supabase = getSupabaseAdmin();

    // Get semester info
    const { data: semester, error: semError } = await supabase
      .from('pmi_semesters')
      .select('*')
      .eq('id', semesterId)
      .single();

    if (semError || !semester) {
      return NextResponse.json({ error: 'Semester not found' }, { status: 404 });
    }

    // Get all program schedules for this semester
    const { data: schedules, error: schedError } = await supabase
      .from('pmi_program_schedules')
      .select('id')
      .eq('semester_id', semesterId)
      .eq('is_active', true);

    if (schedError) throw schedError;

    const scheduleIds = (schedules || []).map(s => s.id);
    if (scheduleIds.length === 0) {
      // Return empty calendar
      const emptyICS = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//PMI Scheduler//Semester Planner//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        `X-WR-CALNAME:${escapeICS(semester.name)}`,
        'X-WR-TIMEZONE:America/Phoenix',
        'END:VCALENDAR',
      ].join('\r\n');

      return new NextResponse(emptyICS, {
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': `attachment; filename="${semester.name.replace(/\s+/g, '-')}.ics"`,
        },
      });
    }

    // Get all blocks with relationships
    const { data: blocks, error: blockError } = await supabase
      .from('pmi_schedule_blocks')
      .select(`
        *,
        room:pmi_rooms!pmi_schedule_blocks_room_id_fkey(id, name),
        program_schedule:pmi_program_schedules!pmi_schedule_blocks_program_schedule_id_fkey(
          id, class_days, color, label,
          cohort:cohorts!pmi_program_schedules_cohort_id_fkey(
            id, cohort_number,
            program:programs(id, name, abbreviation)
          )
        ),
        instructors:pmi_block_instructors(
          id, role,
          instructor:lab_users!pmi_block_instructors_instructor_id_fkey(id, name, email)
        )
      `)
      .in('program_schedule_id', scheduleIds)
      .order('day_of_week')
      .order('start_time');

    if (blockError) throw blockError;

    // Build ICS
    const icsLines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//PMI Scheduler//Semester Planner//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${escapeICS(semester.name)}`,
      'X-WR-TIMEZONE:America/Phoenix',
      // VTIMEZONE for America/Phoenix (no DST)
      'BEGIN:VTIMEZONE',
      'TZID:America/Phoenix',
      'BEGIN:STANDARD',
      'DTSTART:19700101T000000',
      'TZOFFSETFROM:-0700',
      'TZOFFSETTO:-0700',
      'TZNAME:MST',
      'END:STANDARD',
      'END:VTIMEZONE',
    ];

    const semesterStartDate = new Date(semester.start_date + 'T12:00:00');
    const semesterEndDate = new Date(semester.end_date + 'T12:00:00');

    for (const block of (blocks || [])) {
      const program = block.program_schedule as any;
      const cohort = program?.cohort as any;
      const programAbbr = cohort?.program?.abbreviation || cohort?.program?.name || 'Prog';
      const cohortNum = cohort?.cohort_number ?? '?';
      const room = block.room as any;

      // Title: "EMS 141 (Grp 14)" or "course_name (Grp N)"
      const courseName = block.course_name || block.title || block.block_type;
      const summary = `${courseName} (${programAbbr} Grp ${cohortNum})`;

      // Location
      const location = room?.name || '';

      // Description
      const descParts: string[] = [];
      descParts.push(`Program: ${programAbbr} Group ${cohortNum}`);
      descParts.push(`Type: ${block.block_type}`);
      if (block.instructors && block.instructors.length > 0) {
        const names = block.instructors.map((bi: any) => bi.instructor?.name).filter(Boolean);
        if (names.length > 0) descParts.push(`Instructor: ${names.join(', ')}`);
      }
      if (block.content_notes) descParts.push(`Notes: ${block.content_notes}`);
      const description = descParts.join('\n');

      // Find the first occurrence date
      // block.day_of_week: 0=Sun, 1=Mon, etc.
      const startDow = semesterStartDate.getDay(); // 0-6
      let daysToAdd = block.day_of_week - startDow;
      if (daysToAdd < 0) daysToAdd += 7;

      const firstOccurrence = new Date(semesterStartDate);
      firstOccurrence.setDate(firstOccurrence.getDate() + daysToAdd);

      // Format dates
      const dateStr = firstOccurrence.toISOString().split('T')[0]; // YYYY-MM-DD
      const dtstart = toICSDate(dateStr, block.start_time);
      const dtend = toICSDate(dateStr, block.end_time);

      // RRULE: recur weekly until semester end
      const untilDate = toICSDate(semester.end_date, '23:59');
      const icsDay = ICS_DAYS[block.day_of_week];

      icsLines.push('BEGIN:VEVENT');
      icsLines.push(`UID:${generateUID(block.id, semesterId)}`);
      icsLines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
      icsLines.push(`DTSTART;TZID=America/Phoenix:${dtstart}`);
      icsLines.push(`DTEND;TZID=America/Phoenix:${dtend}`);

      if (block.is_recurring) {
        icsLines.push(`RRULE:FREQ=WEEKLY;BYDAY=${icsDay};UNTIL=${untilDate}`);
      }

      icsLines.push(`SUMMARY:${escapeICS(summary)}`);
      if (location) icsLines.push(`LOCATION:${escapeICS(location)}`);
      icsLines.push(`DESCRIPTION:${description}`);
      icsLines.push('END:VEVENT');
    }

    icsLines.push('END:VCALENDAR');

    const icsContent = icsLines.join('\r\n');

    return new NextResponse(icsContent, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${semester.name.replace(/\s+/g, '-')}.ics"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('ICS export error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
