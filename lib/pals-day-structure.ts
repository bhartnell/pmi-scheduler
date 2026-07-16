/**
 * PALS Hub Build Plan (docs/pals/PALS_Hub_Build_Plan.md), Phase 5 — content
 * population. Static, read-only reference data transcribed verbatim from
 * docs/pals/PALS_2025_Day_Structure.md sections 1-2 (the AHA 2025 Day 1/Day 2
 * timed agenda). This is NOT the live class schedule (that lives in
 * pmi_schedule_blocks, driven by the scheduling poll/planner tool) — it is a
 * reference the PALS Hub displays alongside whatever IS actually scheduled,
 * so instructors can see the AHA-target agenda even when the live calendar
 * for a given cohort's PALS days hasn't been built out to match it yet.
 *
 * Deliberately code-only, no DB write: populating the REAL pmi_schedule_blocks
 * rows for a cohort's actual PALS dates is a live-schedule change (potentially
 * touching room/instructor conflict checks and Google Calendar sync) that
 * needs Ben's go-ahead, not something to do autonomously — see the PALS Hub
 * Build Plan Phase 5 report for the specific G14 finding (7/16-7/17's live
 * pmi_schedule_blocks currently show generic course lecture blocks, not this
 * agenda, and don't reflect the real ~17:30 Day-1 overflow below).
 */

export interface PalsAgendaBlock {
  id: string; // stable id (day-scoped) — used as the pals_agenda_instructors.block_id key
  start: string; // HH:MM, 24h
  durationMinutes: number;
  label: string;
  type: 'lecture' | 'practice' | 'lab' | 'break' | 'lunch' | 'testing';
}

export const PALS_2025_DAY1_AGENDA: PalsAgendaBlock[] = [
  { id: 'd1-intro', start: '08:30', durationMinutes: 5, label: 'Course Introduction', type: 'lecture' },
  { id: 'd1-l1', start: '08:35', durationMinutes: 5, label: 'L1 — Course Overview', type: 'lecture' },
  { id: 'd1-l2', start: '08:40', durationMinutes: 10, label: 'L2 — Science of Pediatric Resuscitation', type: 'lecture' },
  { id: 'd1-l3a', start: '08:50', durationMinutes: 25, label: 'L3A — Child High-Quality BLS Practice', type: 'practice' },
  { id: 'd1-l3b', start: '09:15', durationMinutes: 25, label: 'L3B — Infant High-Quality BLS Practice', type: 'practice' },
  { id: 'd1-l4', start: '09:40', durationMinutes: 30, label: 'L4 — CPR Coach & High-Performance Teams (hands-on)', type: 'practice' },
  { id: 'd1-break1', start: '10:10', durationMinutes: 10, label: 'Break', type: 'break' },
  { id: 'd1-l6a', start: '10:20', durationMinutes: 45, label: 'L6A — Systematic Approach + Assessment Video Cases (11 segments)', type: 'lecture' },
  { id: 'd1-l6b', start: '11:05', durationMinutes: 15, label: 'L6B — Secondary Assessment', type: 'lecture' },
  { id: 'd1-l7a', start: '11:20', durationMinutes: 15, label: 'L7A — Management of Respiratory Emergencies', type: 'lecture' },
  { id: 'd1-l7b', start: '11:35', durationMinutes: 25, label: 'L7B — Respiratory Video Case Discussions', type: 'lecture' },
  { id: 'd1-lunch', start: '12:00', durationMinutes: 60, label: 'Lunch', type: 'lunch' },
  { id: 'd1-l8a', start: '13:00', durationMinutes: 15, label: 'L8A — Management of Shock Emergencies', type: 'lecture' },
  { id: 'd1-l8b', start: '13:15', durationMinutes: 25, label: 'L8B — Shock Video Case Discussions', type: 'lecture' },
  { id: 'd1-l9a', start: '13:40', durationMinutes: 15, label: 'L9A — Management of Arrhythmia Emergencies', type: 'lecture' },
  { id: 'd1-l9b', start: '13:55', durationMinutes: 25, label: 'L9B — Arrhythmia Video Case Discussions', type: 'lecture' },
  { id: 'd1-l10', start: '14:20', durationMinutes: 15, label: 'L10 — Management of Post-Cardiac Arrest Care', type: 'lecture' },
  { id: 'd1-break2', start: '14:35', durationMinutes: 10, label: 'Break', type: 'break' },
  { id: 'd1-sectiona', start: '14:45', durationMinutes: 60, label: 'Section A — Learning Stations (3 stations x 20 min)', type: 'lab' },
  { id: 'd1-break3', start: '15:45', durationMinutes: 5, label: 'Break', type: 'break' },
  { id: 'd1-sectionb', start: '15:50', durationMinutes: 100, label: 'Section B — Case Scenario Practice (4 cases)', type: 'lab' },
  { id: 'd1-end', start: '17:30', durationMinutes: 0, label: 'End of Day 1', type: 'lecture' },
];

export const PALS_2025_DAY2_AGENDA: PalsAgendaBlock[] = [
  { id: 'd2-recap', start: '08:30', durationMinutes: 10, label: 'Recap / finish unfinished scenarios', type: 'lecture' },
  { id: 'd2-sectionc', start: '08:40', durationMinutes: 100, label: 'Section C — Case Scenario Practice (4 cases)', type: 'lab' },
  { id: 'd2-break1', start: '10:20', durationMinutes: 10, label: 'Break', type: 'break' },
  { id: 'd2-sectiond', start: '10:30', durationMinutes: 100, label: 'Section D — Case Scenario Practice (4 cases)', type: 'lab' },
  { id: 'd2-lunch', start: '12:10', durationMinutes: 60, label: 'Lunch', type: 'lunch' },
  { id: 'd2-sectione', start: '13:10', durationMinutes: 75, label: 'Section E — Case Scenario Testing (4 stations x 3 rounds x 25 min)', type: 'testing' },
  { id: 'd2-break2', start: '14:25', durationMinutes: 10, label: 'Break', type: 'break' },
  { id: 'd2-l14', start: '14:35', durationMinutes: 60, label: 'L14 — Exam (online via Atlas, >=84%, open-resource)', type: 'testing' },
  { id: 'd2-remediation', start: '15:35', durationMinutes: 60, label: 'Remediation / retest', type: 'lecture' },
  { id: 'd2-end', start: '16:35', durationMinutes: 0, label: 'Class ends', type: 'lecture' },
];

/** ⚠ Verbatim from PALS_2025_Day_Structure.md — do not silently trim. */
export const PALS_DAY1_OVERFLOW_NOTE =
  'Day 1 runs to ~17:30 per AHA 2025 lesson durations (355 core + 300 practice min before breaks/lunch) — a real overflow past a hard 17:00 stop, not a scheduling error. If a hard 17:00 stop is required, the only compressible blocks are the video-discussion lessons (L7B/L8B/L9B).';

export function palsAgendaForDay(dayIndex: 1 | 2): PalsAgendaBlock[] {
  return dayIndex === 1 ? PALS_2025_DAY1_AGENDA : PALS_2025_DAY2_AGENDA;
}
