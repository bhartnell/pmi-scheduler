// ---------------------------------------------------------------------------
// Course agenda planner (Task Handoff Queue: PALS P5c-2a). Pure, no DB; the
// DB executor is lib/course-agenda-generator.ts.
//
// Expands a course's agenda template (course_agenda_lines: lessons, breaks,
// lunch, exam, remediation) into a SPECIFIC cohort's pmi_schedule_blocks for
// its course days. Works for any cohort + course, not a one-off for G15.
//
// Section lines (section_key A-E) are not timed from the template: the block
// takes its start/end and its link from the cohort's own lab_days row for
// that section (linked_lab_day_id + linked_section_number), so the schedule
// can never disagree with the lab day it points at. A section with no
// lab_days row is reported, never guessed.
//
// Guardrails:
//   - Additive only. Existing blocks are never updated or deleted; a line
//     whose tag already exists on that date is reported as skip_existing.
//   - Writes default to status 'draft' so nothing reaches Google Calendar
//     until someone publishes on purpose.
//   - dryRun is required and computes the plan from SELECTs only.
// ---------------------------------------------------------------------------

export type AgendaCourse = 'pals' | 'acls';
export type AgendaLineType = 'lecture' | 'practice' | 'lab' | 'break' | 'lunch' | 'testing';

export interface AgendaLine {
  line_key: string;
  day_index: number;
  sort_order: number;
  start_time: string; // HH:MM or HH:MM:SS
  duration_minutes: number;
  label: string;
  line_type: AgendaLineType;
  section_key: string | null;
}

export interface AgendaLabDay {
  id: string;
  section_number: number | null;
  section_label: string | null;
  start_time: string | null;
  end_time: string | null;
}

export interface PlannedBlock {
  line_key: string;
  date: string;
  start_time: string;
  end_time: string;
  block_type: string;
  title: string;
  content_notes: string;
  sort_order: number;
  linked_lab_day_id: string | null;
  linked_section_number: number | null;
  action: 'create' | 'skip_existing';
}

export interface PlanWarning {
  line_key: string;
  reason: 'missing_section' | 'section_no_times' | 'zero_duration_marker';
  detail: string;
}

export interface AgendaPlan {
  blocks: PlannedBlock[];
  warnings: PlanWarning[];
}

const BLOCK_TYPE: Record<AgendaLineType, string> = {
  lecture: 'lecture',
  practice: 'lab',
  lab: 'lab',
  testing: 'exam',
  break: 'other',
  lunch: 'other',
};

export const agendaTag = (course: AgendaCourse, lineKey: string) => `agenda-line:${course}:${lineKey}`;

const hhmm = (t: string) => t.slice(0, 5);

export function addMinutes(hhmmValue: string, minutes: number): string {
  const [h, m] = hhmmValue.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// House style: hyphen, never em dash, in generated titles.
const plainDash = (s: string) => s.replace(/\s*[—–]\s*/g, ' - ');

/** Match a lab_days row to a template section letter via its "Section X" label. */
export function labDayForSection(labDays: AgendaLabDay[], sectionKey: string): AgendaLabDay | undefined {
  const re = new RegExp(`^section\\s+${sectionKey}\\b`, 'i');
  return labDays.find((d) => d.section_label && re.test(d.section_label.trim()));
}

/**
 * Pure planner for ONE course day. `existingTags` are content_notes values
 * already on that date's blocks (idempotency check).
 */
export function planAgendaDay(input: {
  course: AgendaCourse;
  date: string;
  lines: AgendaLine[];
  labDays: AgendaLabDay[];
  existingTags: ReadonlySet<string>;
}): AgendaPlan {
  const { course, date, lines, labDays, existingTags } = input;
  const courseLabel = course.toUpperCase();
  const blocks: PlannedBlock[] = [];
  const warnings: PlanWarning[] = [];
  let sort = 0;

  for (const line of [...lines].sort((a, b) => a.sort_order - b.sort_order)) {
    let start = hhmm(line.start_time);
    let end = addMinutes(start, line.duration_minutes);
    let linkedId: string | null = null;
    let linkedSection: number | null = null;

    if (line.section_key) {
      const labDay = labDayForSection(labDays, line.section_key);
      if (!labDay) {
        warnings.push({
          line_key: line.line_key,
          reason: 'missing_section',
          detail: `No lab_days row labelled "Section ${line.section_key}" for ${date}; block not planned.`,
        });
        continue;
      }
      if (!labDay.start_time || !labDay.end_time) {
        warnings.push({
          line_key: line.line_key,
          reason: 'section_no_times',
          detail: `Section ${line.section_key} lab day ${labDay.id} has no start/end time; block not planned.`,
        });
        continue;
      }
      start = hhmm(labDay.start_time);
      end = hhmm(labDay.end_time);
      linkedId = labDay.id;
      linkedSection = labDay.section_number;
    } else if (line.duration_minutes === 0) {
      warnings.push({
        line_key: line.line_key,
        reason: 'zero_duration_marker',
        detail: `"${line.label}" is an end-of-day marker (0 min); no block written.`,
      });
      continue;
    }

    sort += 1;
    const tag = agendaTag(course, line.line_key);
    const isLab = line.line_type === 'lab' || line.line_type === 'testing';
    blocks.push({
      line_key: line.line_key,
      date,
      start_time: start,
      end_time: end,
      block_type: BLOCK_TYPE[line.line_type],
      title: `${courseLabel}${isLab && line.section_key ? ' LAB' : ''} · ${plainDash(line.label)}`,
      content_notes: tag,
      sort_order: sort,
      linked_lab_day_id: linkedId,
      linked_section_number: linkedSection,
      action: existingTags.has(tag) ? 'skip_existing' : 'create',
    });
  }
  return { blocks, warnings };
}
