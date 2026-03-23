/**
 * Schedule Constraint Engine
 *
 * Checks calendar events against configurable constraints (instructor conflicts,
 * room conflicts, cohort conflicts, max hours, required gaps) and returns
 * structured conflict results with severity and suggestions.
 */

// Re-use the CalendarEvent shape from the unified API
export interface CalendarEvent {
  id: string;
  source: 'planner' | 'lab_day' | 'lvfr' | 'clinical' | 'shift' | 'meeting';
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  program?: 'paramedic' | 'emt' | 'aemt' | 'lvfr' | 'other';
  color: string;
  cohort_number?: number;
  instructor_names?: string[];
  room?: string;
  linked_id?: string;
  linked_url?: string;
  event_type: 'class' | 'lab' | 'exam' | 'clinical' | 'shift' | 'meeting' | 'other';
  status?: 'draft' | 'published' | 'cancelled';
  content_notes?: string;
  linked_lab_day_id?: string;
  metadata?: Record<string, unknown>;
}

export type ConstraintType =
  | 'instructor_conflict'
  | 'room_conflict'
  | 'cohort_conflict'
  | 'max_hours'
  | 'required_gap';

export interface ScheduleConstraint {
  type: ConstraintType;
  params: Record<string, unknown>;
}

export interface ConflictResult {
  type: ConstraintType;
  severity: 'error' | 'warning' | 'info';
  message: string;
  events: CalendarEvent[];
  date: string;
  time_range: string;
  suggestion?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

function timeToMinutes(t: string): number {
  if (!t) return 0;
  const parts = t.split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function formatTime12(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function eventsOverlap(a: CalendarEvent, b: CalendarEvent): boolean {
  if (a.date !== b.date) return false;
  return a.start_time < b.end_time && b.start_time < a.end_time;
}

/** Returns true if two events are linked (same schedule block + lab day) and should not conflict */
function areLinkedEvents(a: CalendarEvent, b: CalendarEvent): boolean {
  // If a planner block links to a lab day, they represent the same real event
  if (a.linked_lab_day_id && b.source === 'lab_day' && b.linked_id === a.linked_lab_day_id) return true;
  if (b.linked_lab_day_id && a.source === 'lab_day' && a.linked_id === b.linked_lab_day_id) return true;
  return false;
}

/** ISO week-start (Monday) for a given date string */
function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function eventDurationHours(e: CalendarEvent): number {
  const s = timeToMinutes(e.start_time);
  const en = timeToMinutes(e.end_time);
  return en > s ? (en - s) / 60 : 0;
}

// ── Constraint Checkers ──────────────────────────────────────────────

function checkInstructorConflicts(events: CalendarEvent[]): ConflictResult[] {
  const results: ConflictResult[] = [];
  const byDate = groupByDate(events);

  for (const [date, dayEvents] of byDate) {
    // Collect events that have instructors
    const withInstructors = dayEvents.filter(
      (e) => e.instructor_names && e.instructor_names.length > 0
    );

    for (let i = 0; i < withInstructors.length; i++) {
      for (let j = i + 1; j < withInstructors.length; j++) {
        const a = withInstructors[i];
        const b = withInstructors[j];
        if (!eventsOverlap(a, b)) continue;
        if (areLinkedEvents(a, b)) continue;

        const sharedNames = (a.instructor_names || []).filter((n) =>
          (b.instructor_names || []).includes(n)
        );

        for (const name of sharedNames) {
          results.push({
            type: 'instructor_conflict',
            severity: 'error',
            message: `${name} is double-booked: "${a.title}" and "${b.title}"`,
            events: [a, b],
            date,
            time_range: `${formatTime12(a.start_time)}-${formatTime12(a.end_time)} / ${formatTime12(b.start_time)}-${formatTime12(b.end_time)}`,
            suggestion: `Move one event to a different time or assign a different instructor`,
          });
        }
      }
    }
  }
  return results;
}

function checkRoomConflicts(events: CalendarEvent[]): ConflictResult[] {
  const results: ConflictResult[] = [];
  const byDate = groupByDate(events);

  for (const [date, dayEvents] of byDate) {
    const withRooms = dayEvents.filter((e) => e.room);

    for (let i = 0; i < withRooms.length; i++) {
      for (let j = i + 1; j < withRooms.length; j++) {
        const a = withRooms[i];
        const b = withRooms[j];
        if (a.room !== b.room) continue;
        if (!eventsOverlap(a, b)) continue;
        if (areLinkedEvents(a, b)) continue;

        results.push({
          type: 'room_conflict',
          severity: 'error',
          message: `Room "${a.room}" is double-booked: "${a.title}" and "${b.title}"`,
          events: [a, b],
          date,
          time_range: `${formatTime12(a.start_time)}-${formatTime12(a.end_time)} / ${formatTime12(b.start_time)}-${formatTime12(b.end_time)}`,
          suggestion: `Move one event to a different room`,
        });
      }
    }
  }
  return results;
}

function checkCohortConflicts(events: CalendarEvent[]): ConflictResult[] {
  const results: ConflictResult[] = [];
  const byDate = groupByDate(events);

  for (const [date, dayEvents] of byDate) {
    const withCohort = dayEvents.filter((e) => e.cohort_number != null);

    for (let i = 0; i < withCohort.length; i++) {
      for (let j = i + 1; j < withCohort.length; j++) {
        const a = withCohort[i];
        const b = withCohort[j];
        if (a.cohort_number !== b.cohort_number) continue;
        if (!eventsOverlap(a, b)) continue;
        if (areLinkedEvents(a, b)) continue;

        results.push({
          type: 'cohort_conflict',
          severity: 'error',
          message: `Cohort ${a.cohort_number} has overlapping events: "${a.title}" and "${b.title}"`,
          events: [a, b],
          date,
          time_range: `${formatTime12(a.start_time)}-${formatTime12(a.end_time)} / ${formatTime12(b.start_time)}-${formatTime12(b.end_time)}`,
          suggestion: `Reschedule one event so Cohort ${a.cohort_number} is not double-booked`,
        });
      }
    }
  }
  return results;
}

function checkMaxHours(
  events: CalendarEvent[],
  maxWeeklyHours: number
): ConflictResult[] {
  const results: ConflictResult[] = [];

  // Group events by instructor and week
  const instructorWeeks = new Map<string, Map<string, CalendarEvent[]>>();

  for (const e of events) {
    if (!e.instructor_names || e.instructor_names.length === 0) continue;
    const weekKey = getWeekKey(e.date);

    for (const name of e.instructor_names) {
      if (!instructorWeeks.has(name)) instructorWeeks.set(name, new Map());
      const weeks = instructorWeeks.get(name)!;
      if (!weeks.has(weekKey)) weeks.set(weekKey, []);
      weeks.get(weekKey)!.push(e);
    }
  }

  for (const [name, weeks] of instructorWeeks) {
    for (const [weekStart, weekEvents] of weeks) {
      const totalHours = weekEvents.reduce(
        (sum, e) => sum + eventDurationHours(e),
        0
      );
      if (totalHours > maxWeeklyHours) {
        results.push({
          type: 'max_hours',
          severity: 'warning',
          message: `${name} has ${totalHours.toFixed(1)} hours in the week of ${weekStart} (max ${maxWeeklyHours})`,
          events: weekEvents,
          date: weekStart,
          time_range: `Week total: ${totalHours.toFixed(1)} hrs`,
          suggestion: `Reduce ${name}'s schedule by ${(totalHours - maxWeeklyHours).toFixed(1)} hours`,
        });
      }
    }
  }
  return results;
}

function checkRequiredGap(
  events: CalendarEvent[],
  minGapMinutes: number
): ConflictResult[] {
  const results: ConflictResult[] = [];

  // Group by instructor and date, then check gaps
  const instructorDays = new Map<string, Map<string, CalendarEvent[]>>();

  for (const e of events) {
    if (!e.instructor_names || e.instructor_names.length === 0) continue;
    for (const name of e.instructor_names) {
      if (!instructorDays.has(name)) instructorDays.set(name, new Map());
      const days = instructorDays.get(name)!;
      if (!days.has(e.date)) days.set(e.date, []);
      days.get(e.date)!.push(e);
    }
  }

  for (const [name, days] of instructorDays) {
    for (const [date, dayEvents] of days) {
      const sorted = [...dayEvents].sort((a, b) =>
        a.start_time.localeCompare(b.start_time)
      );

      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];
        const endMin = timeToMinutes(current.end_time);
        const startMin = timeToMinutes(next.start_time);
        const gap = startMin - endMin;

        if (gap >= 0 && gap < minGapMinutes) {
          results.push({
            type: 'required_gap',
            severity: 'warning',
            message: `${name} has only ${gap} min break between "${current.title}" and "${next.title}" (need ${minGapMinutes} min)`,
            events: [current, next],
            date,
            time_range: `${formatTime12(current.end_time)} to ${formatTime12(next.start_time)}`,
            suggestion: `Add at least ${minGapMinutes - gap} more minutes between events`,
          });
        }
      }
    }
  }
  return results;
}

// ── Helpers ──────────────────────────────────────────────────────────

function groupByDate(
  events: CalendarEvent[]
): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date)!.push(e);
  }
  return map;
}

// ── Main Entry Point ─────────────────────────────────────────────────

/**
 * Run all requested constraints against the provided events and return conflicts.
 */
export function findConflicts(
  events: CalendarEvent[],
  constraints: ScheduleConstraint[]
): ConflictResult[] {
  const results: ConflictResult[] = [];

  for (const constraint of constraints) {
    switch (constraint.type) {
      case 'instructor_conflict':
        results.push(...checkInstructorConflicts(events));
        break;
      case 'room_conflict':
        results.push(...checkRoomConflicts(events));
        break;
      case 'cohort_conflict':
        results.push(...checkCohortConflicts(events));
        break;
      case 'max_hours':
        results.push(
          ...checkMaxHours(
            events,
            (constraint.params.max_weekly_hours as number) || 40
          )
        );
        break;
      case 'required_gap':
        results.push(
          ...checkRequiredGap(
            events,
            (constraint.params.min_gap_minutes as number) || 15
          )
        );
        break;
    }
  }

  // Deduplicate: same type + same pair of event IDs
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = `${r.type}|${r.events
      .map((e) => e.id)
      .sort()
      .join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Slot Finder ──────────────────────────────────────────────────────

export interface SlotOption {
  date: string;
  start_time: string;
  end_time: string;
  score: 'BEST' | 'GOOD' | 'POSSIBLE' | 'NOT_IDEAL';
  conflicts: ConflictResult[];
  label: string;
}

export interface SlotFinderParams {
  duration_minutes: number;
  preferred_days: number[]; // 0=Sun..6=Sat
  instructor_id?: string;
  instructor_name?: string;
  room?: string;
  start_date: string;
  end_date: string;
  constraints: ScheduleConstraint[];
  start_hour?: number; // default 7
  end_hour?: number; // default 20
  slot_interval?: number; // default 30
}

/**
 * Generate candidate time slots within the date range and score them
 * based on conflicts with existing events.
 */
export function findSlots(
  events: CalendarEvent[],
  params: SlotFinderParams
): SlotOption[] {
  const {
    duration_minutes,
    preferred_days,
    instructor_name,
    room,
    start_date,
    end_date,
    constraints,
    start_hour = 7,
    end_hour = 20,
    slot_interval = 30,
  } = params;

  const results: SlotOption[] = [];
  const current = new Date(start_date + 'T12:00:00');
  const last = new Date(end_date + 'T12:00:00');

  while (current <= last) {
    const dayOfWeek = current.getDay();
    if (preferred_days.length === 0 || preferred_days.includes(dayOfWeek)) {
      const dateStr = current.toISOString().split('T')[0];

      // Generate candidate start times
      for (let hour = start_hour; hour < end_hour; hour++) {
        for (let min = 0; min < 60; min += slot_interval) {
          const startMin = hour * 60 + min;
          const endMin = startMin + duration_minutes;
          if (endMin > end_hour * 60) continue;

          const startTime = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
          const endHour = Math.floor(endMin / 60);
          const endMinRem = endMin % 60;
          const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinRem).padStart(2, '0')}:00`;

          // Create a synthetic event for conflict checking
          const candidateEvent: CalendarEvent = {
            id: `candidate-${dateStr}-${startTime}`,
            source: 'planner',
            title: 'Candidate Slot',
            date: dateStr,
            start_time: startTime,
            end_time: endTime,
            color: '#999',
            event_type: 'class',
            instructor_names: instructor_name ? [instructor_name] : [],
            room: room || undefined,
          };

          // Merge candidate into event list and check conflicts
          const testEvents = [...events, candidateEvent];
          const conflicts = findConflicts(testEvents, constraints).filter(
            (c) => c.events.some((e) => e.id === candidateEvent.id)
          );

          const errorCount = conflicts.filter((c) => c.severity === 'error').length;
          const warningCount = conflicts.filter((c) => c.severity === 'warning').length;

          let score: SlotOption['score'];
          if (errorCount === 0 && warningCount === 0) {
            score = 'BEST';
          } else if (errorCount === 0) {
            score = 'GOOD';
          } else if (errorCount === 1) {
            score = 'POSSIBLE';
          } else {
            score = 'NOT_IDEAL';
          }

          const dayLabel = new Date(dateStr + 'T12:00:00').toLocaleDateString(
            'en-US',
            { weekday: 'short', month: 'short', day: 'numeric' }
          );

          results.push({
            date: dateStr,
            start_time: startTime,
            end_time: endTime,
            score,
            conflicts,
            label: `${dayLabel}, ${formatTime12(startTime)} - ${formatTime12(endTime)}`,
          });
        }
      }
    }
    current.setDate(current.getDate() + 1);
  }

  // Sort: BEST first, then GOOD, POSSIBLE, NOT_IDEAL. Within same score, by date/time.
  const scoreOrder = { BEST: 0, GOOD: 1, POSSIBLE: 2, NOT_IDEAL: 3 };
  results.sort((a, b) => {
    const s = scoreOrder[a.score] - scoreOrder[b.score];
    if (s !== 0) return s;
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    return a.start_time.localeCompare(b.start_time);
  });

  // Limit results to avoid huge payloads: top 50
  return results.slice(0, 50);
}
