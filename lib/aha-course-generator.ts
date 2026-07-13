import { getSupabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// AHA-generic course generator (Task Handoff Queue Checkpoint A).
//
// Expands an AHA (ACLS|PALS) course template — stored as one or more
// lab_day_templates rows (category='certification', cert_course set,
// day_number + section_number identifying each section) with their
// lab_template_stations — into a SPECIFIC cohort's own lab_days +
// lab_stations rows, tagging cert_course/is_adv_cert_testing/lab_mode and
// setting lab_days.source_template_id back to the template row.
//
// HARD GUARDRAILS (Ben's explicit conditions, do not relax):
//   - Additive only. Never UPDATEs an existing lab_days/lab_stations row —
//     if a row already exists at the (cohort_id, date, section_number) key,
//     it is reported as skipped and left completely alone. This is
//     intentionally stricter than the generic lab-templates/apply route
//     (which upserts in place) because this generator must never be able
//     to touch a cohort's already-graded certification day.
//   - dryRun computes the full plan via SELECT-only queries and returns
//     without issuing a single INSERT — no transaction rollback trick
//     needed, the write branch just never runs.
// ---------------------------------------------------------------------------

export type CertCourse = 'acls' | 'pals';

export interface AhaTemplateStationPlan {
  station_number: number;
  station_type: string;
  custom_title: string | null;
  scenario_id: string | null;
  scenario_title: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
}

export interface AhaTemplateDayPlan {
  template_id: string;
  day_number: number;
  section_number: number;
  section_label: string | null;
  title: string;
  date: string;
  is_adv_cert_testing: boolean;
  lab_mode: string | null;
  stations: AhaTemplateStationPlan[];
  action: 'create' | 'skip_existing';
  existing_lab_day_id?: string;
  created_lab_day_id?: string;
}

export interface GenerateAhaCourseResult {
  cohort_id: string;
  cert_course: CertCourse;
  dry_run: boolean;
  semester: number | null;
  plan: AhaTemplateDayPlan[];
  created_count: number;
  skipped_count: number;
  errors: string[];
}

export interface GenerateAhaCourseInput {
  cohortId: string;
  certCourse: CertCourse;
  // day_number -> calendar date (YYYY-MM-DD). Every day_number present in
  // the matched templates must have an entry or that day's sections are
  // reported as an error (not silently dropped).
  dayDates: Record<number, string>;
  dryRun: boolean;
}

export async function listAhaCourseTemplateDayNumbers(certCourse: CertCourse): Promise<number[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('lab_day_templates')
    .select('day_number')
    .eq('category', 'certification')
    .eq('cert_course', certCourse);
  if (error) throw new Error(error.message);
  const days = new Set<number>();
  for (const row of data || []) {
    if (typeof row.day_number === 'number') days.add(row.day_number);
  }
  return [...days].sort((a, b) => a - b);
}

export async function generateAhaCourseForCohort(
  input: GenerateAhaCourseInput
): Promise<GenerateAhaCourseResult> {
  const { cohortId, certCourse, dayDates, dryRun } = input;
  const supabase = getSupabaseAdmin();
  const errors: string[] = [];

  const { data: cohort, error: cohortError } = await supabase
    .from('cohorts')
    .select('id, current_semester')
    .eq('id', cohortId)
    .maybeSingle();
  if (cohortError) throw new Error(cohortError.message);
  if (!cohort) throw new Error(`Cohort not found: ${cohortId}`);

  const { data: templates, error: templatesError } = await supabase
    .from('lab_day_templates')
    .select(
      `id, name, day_number, section_number, section_label, is_adv_cert_testing, lab_mode,
       stations:lab_template_stations(id, sort_order, station_type, station_name, scenario_id, scenario_title, notes, metadata)`
    )
    .eq('category', 'certification')
    .eq('cert_course', certCourse)
    .order('day_number', { ascending: true })
    .order('section_number', { ascending: true, nullsFirst: true });
  if (templatesError) throw new Error(templatesError.message);
  if (!templates || templates.length === 0) {
    throw new Error(
      `No "${certCourse}" certification templates found (lab_day_templates.cert_course). Seed a template first.`
    );
  }

  const plan: AhaTemplateDayPlan[] = [];

  for (const t of templates) {
    const dayNumber = t.day_number ?? 1;
    const date = dayDates[dayNumber];
    if (!date) {
      errors.push(`No date supplied for day_number=${dayNumber} (template "${t.name}", ${t.id}) — skipped.`);
      continue;
    }

    // lab_days.section_number is NOT NULL DEFAULT 1 (never actually null on
    // that table, unlike the nullable template column) — normalize here so
    // both the existing-row check and the insert below use the real value.
    const sectionNumber = t.section_number ?? 1;

    // Idempotency / guardrail check: never touch a lab_days row that
    // already exists for this cohort at this (date, section_number).
    const { data: existing, error: existingError } = await supabase
      .from('lab_days')
      .select('id')
      .eq('cohort_id', cohortId)
      .eq('date', date)
      .eq('section_number', sectionNumber)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stations = ((t as Record<string, unknown>).stations as Array<any>) || [];
    const stationPlans: AhaTemplateStationPlan[] = stations
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((s) => ({
        station_number: s.sort_order ?? 1,
        station_type: s.station_type || 'scenario',
        custom_title: s.station_name || null,
        scenario_id: s.scenario_id || null,
        scenario_title: s.scenario_title || null,
        notes: s.notes || null,
        metadata: s.metadata || null,
      }));

    const dayPlan: AhaTemplateDayPlan = {
      template_id: t.id,
      day_number: dayNumber,
      section_number: sectionNumber,
      section_label: t.section_label ?? null,
      title: t.name,
      date,
      is_adv_cert_testing: !!t.is_adv_cert_testing,
      lab_mode: t.lab_mode ?? null,
      stations: stationPlans,
      action: existing ? 'skip_existing' : 'create',
      existing_lab_day_id: existing?.id,
    };
    plan.push(dayPlan);
  }

  if (dryRun) {
    return {
      cohort_id: cohortId,
      cert_course: certCourse,
      dry_run: true,
      semester: cohort.current_semester ?? null,
      plan,
      created_count: plan.filter((p) => p.action === 'create').length,
      skipped_count: plan.filter((p) => p.action === 'skip_existing').length,
      errors,
    };
  }

  for (const dayPlan of plan) {
    if (dayPlan.action !== 'create') continue;
    const { data: labDay, error: insertError } = await supabase
      .from('lab_days')
      .insert({
        cohort_id: cohortId,
        date: dayPlan.date,
        title: dayPlan.title,
        semester: cohort.current_semester ?? null,
        section_number: dayPlan.section_number,
        section_label: dayPlan.section_label,
        cert_course: certCourse,
        is_adv_cert_testing: dayPlan.is_adv_cert_testing,
        lab_mode: dayPlan.lab_mode || 'group_rotations',
        source_template_id: dayPlan.template_id,
      })
      .select('id')
      .single();
    if (insertError) {
      errors.push(`${dayPlan.title} (${dayPlan.date}): ${insertError.message}`);
      continue;
    }
    dayPlan.created_lab_day_id = labDay.id;

    if (dayPlan.stations.length > 0) {
      const stationRows = dayPlan.stations.map((s) => ({
        lab_day_id: labDay.id,
        station_number: s.station_number,
        station_type: s.station_type,
        scenario_id: s.scenario_id,
        custom_title: s.custom_title,
        station_notes: s.notes,
        metadata: s.metadata || {},
      }));
      const { error: stationsError } = await supabase.from('lab_stations').insert(stationRows);
      if (stationsError) {
        errors.push(`${dayPlan.title} stations: ${stationsError.message}`);
      }
    }
  }

  return {
    cohort_id: cohortId,
    cert_course: certCourse,
    dry_run: false,
    semester: cohort.current_semester ?? null,
    plan,
    created_count: plan.filter((p) => p.created_lab_day_id).length,
    skipped_count: plan.filter((p) => p.action === 'skip_existing').length,
    errors,
  };
}
