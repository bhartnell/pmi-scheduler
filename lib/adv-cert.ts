// Advanced-Cert (ACLS/PALS) megacode testing — shared domain helpers.
// HTTP/auth lives in the routes under app/api/adv-cert/*; DB logic lives here
// (matches the lib/exam-scheduling.ts split).

import { getSupabaseAdmin } from '@/lib/supabase';
import type {
  AdvCertScenario,
  AdvCertTestAttempt,
  CertCourse,
  CertTier,
  SaveAttemptInput,
} from '@/types/adv-cert';

/**
 * List the megacode scenario "pool" for a course/tier. The pool is derived from
 * the cert tags (there is intentionally no single pointer column — a testing day
 * draws several cases). Returns lightweight rows for a picker.
 */
export async function listScenarios(
  course: CertCourse,
  tier: CertTier = 'megacode_testing'
): Promise<
  Array<{
    id: string;
    name: string;
    case_code: string | null;
    scenario_scope: string | null;
    segment_count: number;
  }>
> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('scenarios')
    .select('id, name:title, case_code, scenario_scope, adv_cert_scenario_segments(id)')
    .eq('cert_course', course)
    .eq('cert_tier', tier)
    .order('case_code', { ascending: true });
  if (error) throw error;
  return (data || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    case_code: s.case_code,
    scenario_scope: s.scenario_scope,
    segment_count: Array.isArray(s.adv_cert_scenario_segments)
      ? s.adv_cert_scenario_segments.length
      : 0,
  }));
}

/**
 * Full grading-form structure for one megacode scenario: the scenario plus its
 * ordered segments, each with its active criteria.
 */
export async function getScenarioWithSegments(
  scenarioId: string
): Promise<AdvCertScenario | null> {
  const supabase = getSupabaseAdmin();
  const { data: scenario, error: sErr } = await supabase
    .from('scenarios')
    .select('id, name:title, case_code, cert_course, cert_tier, scenario_scope, grading_model')
    .eq('id', scenarioId)
    .single();
  if (sErr || !scenario) return null;

  const { data: segs, error: segErr } = await supabase
    .from('adv_cert_scenario_segments')
    .select(
      `id, scenario_id, segment_id, sequence_order,
       segment:adv_cert_segments(
         id, key, name, algorithm_type, always_present, cert_course, content_version, active,
         criteria:adv_cert_segment_criteria(id, segment_id, text, display_order, is_critical, active)
       )`
    )
    .eq('scenario_id', scenarioId)
    .order('sequence_order', { ascending: true });
  if (segErr) throw segErr;

  const segments = (segs || []).map((row: any) => ({
    ...row,
    segment: row.segment
      ? {
          ...row.segment,
          criteria: (row.segment.criteria || [])
            .filter((c: any) => c.active)
            .sort((a: any, b: any) => a.display_order - b.display_order),
        }
      : undefined,
  }));

  return { ...(scenario as any), segments } as AdvCertScenario;
}

export interface SaveAttemptResult {
  attempt: AdvCertTestAttempt;
  deduped: boolean; // true when an existing client_uuid attempt was returned
  teamLeadLogWritten: boolean;
}

/**
 * Persist a scored megacode run: the attempt + tested students + per-segment
 * results + per-criterion results, plus a best-effort team_lead_log row for the
 * test team-lead. Idempotent on client_uuid (offline-safe).
 *
 * Not a single SQL transaction (supabase-js has no multi-statement tx); ordered
 * so the parent attempt commits first and children reference it. client_uuid
 * dedup means a retried offline sync returns the original instead of double-writing.
 */
export async function saveAttempt(
  input: SaveAttemptInput,
  graderId: string | null
): Promise<SaveAttemptResult> {
  const supabase = getSupabaseAdmin();
  const course: CertCourse = input.cert_course || 'acls';

  // 1. Offline idempotency: a client_uuid we've already stored → return it.
  if (input.client_uuid) {
    const { data: existing } = await supabase
      .from('adv_cert_test_attempts')
      .select('*')
      .eq('client_uuid', input.client_uuid)
      .maybeSingle();
    if (existing) {
      return { attempt: existing as AdvCertTestAttempt, deduped: true, teamLeadLogWritten: false };
    }
  }

  // 2. Parent attempt.
  const { data: attempt, error: aErr } = await supabase
    .from('adv_cert_test_attempts')
    .insert({
      lab_day_id: input.lab_day_id,
      lab_station_id: input.lab_station_id || null,
      lab_group_id: input.lab_group_id,
      scenario_id: input.scenario_id,
      team_lead_id: input.team_lead_id || null,
      grader_id: graderId,
      cert_course: course,
      overall_result: input.overall_result,
      comments: input.comments || null,
      client_uuid: input.client_uuid || null,
      synced_at: input.client_uuid ? new Date().toISOString() : null,
    })
    .select('*')
    .single();
  if (aErr) throw aErr;

  // 3. Tested students.
  const uniqueStudents = Array.from(new Set(input.student_ids || []));
  if (uniqueStudents.length) {
    const { error } = await supabase
      .from('adv_cert_attempt_students')
      .insert(uniqueStudents.map((sid) => ({ attempt_id: attempt.id, student_id: sid })));
    if (error) throw error;
  }

  // 4. Per-segment results, then per-criterion results keyed off each result id.
  for (const seg of input.segment_results || []) {
    const { data: segRow, error: segErr } = await supabase
      .from('adv_cert_segment_results')
      .insert({
        attempt_id: attempt.id,
        scenario_segment_id: seg.scenario_segment_id,
        result: seg.result ?? null,
        comments: seg.comments ?? null,
      })
      .select('id')
      .single();
    if (segErr) throw segErr;

    if (seg.criteria?.length) {
      const { error: critErr } = await supabase.from('adv_cert_criterion_results').insert(
        seg.criteria.map((c) => ({
          segment_result_id: segRow.id,
          criterion_id: c.criterion_id,
          met: !!c.met,
        }))
      );
      if (critErr) throw critErr;
    }
  }

  // 5. Best-effort team_lead_log row (confirmed wiring). Requires NOT-NULL
  //    cohort_id/lab_day_id/lab_station_id/date — derive cohort_id + date from
  //    the lab day; skip cleanly if station context is absent.
  let teamLeadLogWritten = false;
  if (input.team_lead_id && input.lab_station_id) {
    try {
      const { data: day } = await supabase
        .from('lab_days')
        .select('id, cohort_id, date')
        .eq('id', input.lab_day_id)
        .single();
      if (day?.cohort_id && day?.date) {
        const { error: tlErr } = await supabase.from('team_lead_log').insert({
          student_id: input.team_lead_id,
          cohort_id: day.cohort_id,
          lab_day_id: input.lab_day_id,
          lab_station_id: input.lab_station_id,
          scenario_id: input.scenario_id,
          date: day.date,
          notes: `Advanced-cert (${course.toUpperCase()}) megacode test — ${input.overall_result.toUpperCase()}`,
        });
        if (!tlErr) teamLeadLogWritten = true;
      }
    } catch {
      // non-fatal — grading must not fail because the log row didn't land
    }
  }

  return { attempt: attempt as AdvCertTestAttempt, deduped: false, teamLeadLogWritten };
}

/** Attempts for a lab day (drives the later filter/report view + grading-day status). */
export async function listAttemptsForDay(labDayId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('adv_cert_test_attempts')
    .select(
      `*,
       team_lead:students!adv_cert_test_attempts_team_lead_id_fkey(id, first_name, last_name),
       scenario:scenarios!adv_cert_test_attempts_scenario_id_fkey(id, name:title, case_code),
       students:adv_cert_attempt_students(student_id)`
    )
    .eq('lab_day_id', labDayId)
    .order('started_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
