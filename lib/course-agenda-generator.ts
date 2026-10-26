import { getSupabaseAdmin } from '@/lib/supabase';
import {
  planAgendaDay,
  type AgendaCourse,
  type AgendaLabDay,
  type AgendaLine,
  type AgendaPlan,
} from '@/lib/course-agenda-plan';

// DB executor for the course agenda plan (Task Handoff Queue: PALS P5c-2a).
// Planning rules and guardrails live in lib/course-agenda-plan.ts. Additive
// only; existing blocks are never updated or deleted; dryRun is SELECT-only;
// writes default to status 'draft' so nothing syncs to calendars unseen.

export interface GenerateCourseAgendaInput {
  cohortId: string;
  course: AgendaCourse;
  // day_index -> calendar date (YYYY-MM-DD)
  dayDates: Record<number, string>;
  dryRun: boolean;
  // Defaults to 'draft' so a generated agenda never syncs to calendars unseen.
  status?: 'draft' | 'published';
}

export interface GenerateCourseAgendaResult {
  cohort_id: string;
  course: AgendaCourse;
  dry_run: boolean;
  days: Array<{ day_index: number; date: string; plan: AgendaPlan }>;
  created_count: number;
  skipped_count: number;
  errors: string[];
}

const dayOfWeek = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

export async function generateCourseAgendaForCohort(
  input: GenerateCourseAgendaInput
): Promise<GenerateCourseAgendaResult> {
  const { cohortId, course, dayDates, dryRun } = input;
  const status = input.status ?? 'draft';
  const supabase = getSupabaseAdmin();
  const errors: string[] = [];
  const result: GenerateCourseAgendaResult = {
    cohort_id: cohortId, course, dry_run: dryRun, days: [], created_count: 0, skipped_count: 0, errors,
  };

  const { data: schedules, error: psError } = await supabase
    .from('pmi_program_schedules')
    .select('id, semester_id')
    .eq('cohort_id', cohortId)
    .eq('is_active', true);
  if (psError) throw new Error(psError.message);
  if (!schedules || schedules.length !== 1) {
    errors.push(`Expected exactly one active program schedule for cohort ${cohortId}, found ${schedules?.length ?? 0}.`);
    return result;
  }
  const programSchedule = schedules[0];

  const { data: lineRows, error: lineError } = await supabase
    .from('course_agenda_lines')
    .select('line_key, day_index, sort_order, start_time, duration_minutes, label, line_type, section_key')
    .eq('course', course)
    .eq('is_active', true);
  if (lineError) throw new Error(lineError.message);
  const lines = (lineRows ?? []) as AgendaLine[];
  if (lines.length === 0) {
    errors.push(`No active course_agenda_lines for course "${course}".`);
    return result;
  }

  for (const [dayKey, date] of Object.entries(dayDates)) {
    const dayIndex = Number(dayKey);
    const dayLines = lines.filter((l) => l.day_index === dayIndex);
    if (dayLines.length === 0) {
      errors.push(`No agenda lines for ${course} day ${dayIndex}.`);
      continue;
    }

    const { data: labDays, error: ldError } = await supabase
      .from('lab_days')
      .select('id, section_number, section_label, start_time, end_time')
      .eq('cohort_id', cohortId)
      .eq('date', date)
      .eq('cert_course', course)
      .eq('is_archived', false);
    if (ldError) throw new Error(ldError.message);

    const { data: existing, error: exError } = await supabase
      .from('pmi_schedule_blocks')
      .select('content_notes')
      .eq('program_schedule_id', programSchedule.id)
      .eq('date', date)
      .like('content_notes', `agenda-line:${course}:%`);
    if (exError) throw new Error(exError.message);
    const existingTags = new Set((existing ?? []).map((r: { content_notes: string | null }) => r.content_notes ?? ''));

    const plan = planAgendaDay({ course, date, lines: dayLines, labDays: (labDays ?? []) as AgendaLabDay[], existingTags });
    result.days.push({ day_index: dayIndex, date, plan });

    for (const b of plan.blocks) {
      if (b.action === 'skip_existing') { result.skipped_count += 1; continue; }
      if (dryRun) { result.created_count += 1; continue; }
      const { error: insError } = await supabase.from('pmi_schedule_blocks').insert({
        semester_id: programSchedule.semester_id,
        program_schedule_id: programSchedule.id,
        date: b.date,
        day_of_week: dayOfWeek(b.date),
        start_time: b.start_time,
        end_time: b.end_time,
        block_type: b.block_type,
        title: b.title,
        course_name: course.toUpperCase(),
        content_notes: b.content_notes,
        status,
        sort_order: b.sort_order,
        is_recurring: false,
        linked_lab_day_id: b.linked_lab_day_id,
        linked_section_number: b.linked_section_number,
      });
      if (insError) errors.push(`${date} ${b.line_key}: ${insError.message}`);
      else result.created_count += 1;
    }
  }
  return result;
}
