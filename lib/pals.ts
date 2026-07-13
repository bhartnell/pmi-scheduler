// PALS testing grading — shared domain helpers.
// HTTP/auth lives in the routes under app/api/pals/*; DB logic lives here
// (matches the lib/adv-cert.ts / lib/exam-scheduling.ts split).
//
// PALS is its own flat-checklist / PASS-NR / three-state-N/A structure — NOT
// the ACLS segment chain. See docs/pals/PALS_Grading_Model_Spec.md.

import { getSupabaseAdmin } from '@/lib/supabase';
import type {
  PalsScenarioWithChecklist,
  PalsTestAttempt,
  SavePalsAttemptInput,
} from '@/types/pals';

const REMEDIATION_WINDOW_DAYS = 30;

/**
 * PALS scenario pool for a picker, gated on narrative_status='complete' —
 * per the spec, a scenario with no loaded narrative is never presented (an
 * empty card). `tier` defaults to both practice + testing.
 */
export async function listPalsScenarios(
  tier: string | string[] = ['scenario_practice', 'scenario_testing']
): Promise<
  Array<{
    id: string;
    title: string;
    case_code: string | null;
    cert_tier: string | null;
    checklist_id: string | null;
    checklist_key: string | null;
    category: string | null;
    subtype: string | null;
  }>
> {
  const supabase = getSupabaseAdmin();
  const tiers = Array.isArray(tier) ? tier : [tier];
  const { data, error } = await supabase
    .from('scenarios')
    .select(
      `id, title, case_code, cert_tier, pals_checklist_id,
       checklist:pals_checklists!scenarios_pals_checklist_id_fkey(checklist_key, category, subtype)`
    )
    .eq('cert_course', 'pals')
    .eq('narrative_status', 'complete')
    .in('cert_tier', tiers)
    .order('case_code', { ascending: true });
  if (error) throw error;
  return (data || []).map((s: any) => ({
    id: s.id,
    title: s.title,
    case_code: s.case_code,
    cert_tier: s.cert_tier,
    checklist_id: s.pals_checklist_id,
    checklist_key: s.checklist?.checklist_key ?? null,
    category: s.checklist?.category ?? null,
    subtype: s.checklist?.subtype ?? null,
  }));
}

/** Full grading-form structure: one PALS scenario + its pathophysiology checklist + ordered active criteria. */
export async function getScenarioWithChecklist(
  scenarioId: string
): Promise<PalsScenarioWithChecklist | null> {
  const supabase = getSupabaseAdmin();
  const { data: scenario, error: sErr } = await supabase
    .from('scenarios')
    .select('id, title, case_code, cert_tier, narrative_status, pals_case_meta, pals_narrative, pals_checklist_id')
    .eq('id', scenarioId)
    .eq('cert_course', 'pals')
    .single();
  if (sErr || !scenario) return null;

  let checklist: PalsScenarioWithChecklist['checklist'] = null;
  if (scenario.pals_checklist_id) {
    const { data: cl, error: cErr } = await supabase
      .from('pals_checklists')
      .select(
        `id, checklist_key, category, subtype, source_ref, content_version, pass_rule, active,
         criteria:pals_checklist_criteria(id, checklist_id, display_order, text, instructor_prompt, prompt_kind, scope_conditional, is_critical, active)`
      )
      .eq('id', scenario.pals_checklist_id)
      .single();
    if (cErr) throw cErr;
    if (cl) {
      checklist = {
        ...(cl as any),
        criteria: ((cl as any).criteria || [])
          .filter((c: any) => c.active)
          .sort((a: any, b: any) => a.display_order - b.display_order),
      };
    }
  }

  return { ...(scenario as any), checklist } as PalsScenarioWithChecklist;
}

export interface SavePalsAttemptResult {
  attempt: PalsTestAttempt;
  deduped: boolean;
  teamLeadLogWritten: boolean;
}

/**
 * Persist a scored PALS test run: the attempt + non-graded team + per-criterion
 * results, plus a best-effort team_lead_log row. Idempotent on client_uuid
 * (offline-safe — a retried sync returns the original instead of double-writing).
 *
 * remediation_due_at (30-day clock) is computed here, not trusted from the
 * client, so the deadline can't be spoofed/drifted by a stale tablet clock.
 */
export async function saveTestAttempt(
  input: SavePalsAttemptInput,
  graderId: string | null
): Promise<SavePalsAttemptResult> {
  const supabase = getSupabaseAdmin();

  if (input.client_uuid) {
    const { data: existing } = await supabase
      .from('pals_test_attempts')
      .select('*')
      .eq('client_uuid', input.client_uuid)
      .maybeSingle();
    if (existing) {
      return { attempt: existing as PalsTestAttempt, deduped: true, teamLeadLogWritten: false };
    }
  }

  const attemptedAt = new Date();
  const remediationDueAt =
    input.result === 'NR'
      ? new Date(attemptedAt.getTime() + REMEDIATION_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
      : null;

  const { data: attempt, error: aErr } = await supabase
    .from('pals_test_attempts')
    .insert({
      checklist_id: input.checklist_id,
      scenario_id: input.scenario_id || null,
      student_id: input.student_id,
      instructor_id: graderId,
      lab_day_id: input.lab_day_id,
      lab_station_id: input.lab_station_id || null,
      lab_group_id: input.lab_group_id || null,
      discipline: input.discipline || null,
      result: input.result,
      remediation_notes: input.remediation_notes || null,
      instructor_initials: input.instructor_initials || null,
      instructor_number: input.instructor_number || null,
      retest_of: input.retest_of || null,
      remediation_due_at: remediationDueAt,
      attempted_at: attemptedAt.toISOString(),
      client_uuid: input.client_uuid || null,
      synced_at: input.client_uuid ? new Date().toISOString() : null,
    })
    .select('*')
    .single();
  if (aErr) throw aErr;

  const uniqueMembers = Array.from(new Set(input.team_member_ids || [])).filter(
    (id) => id !== input.student_id
  );
  if (uniqueMembers.length) {
    const { error } = await supabase.from('pals_attempt_students').insert(
      uniqueMembers.map((sid) => ({ attempt_id: attempt.id, student_id: sid, team_role: 'team_member' }))
    );
    if (error) throw error;
  }

  if (input.criterion_results?.length) {
    const { error: crErr } = await supabase.from('pals_criterion_results').insert(
      input.criterion_results.map((c) => ({
        attempt_id: attempt.id,
        criterion_id: c.criterion_id,
        state: c.state,
      }))
    );
    if (crErr) throw crErr;
  }

  // Best-effort team_lead_log row (mirrors lib/adv-cert.ts). Requires the
  // NOT-NULL cohort_id/date derived from the lab day; skip cleanly if absent.
  let teamLeadLogWritten = false;
  if (input.lab_station_id) {
    try {
      const { data: day } = await supabase
        .from('lab_days')
        .select('id, cohort_id, date')
        .eq('id', input.lab_day_id)
        .single();
      if (day?.cohort_id && day?.date) {
        const { error: tlErr } = await supabase.from('team_lead_log').insert({
          student_id: input.student_id,
          cohort_id: day.cohort_id,
          lab_day_id: input.lab_day_id,
          lab_station_id: input.lab_station_id,
          scenario_id: input.scenario_id || null,
          date: day.date,
          notes: `PALS testing checklist — ${input.result}`,
        });
        if (!tlErr) teamLeadLogWritten = true;
      }
    } catch {
      // non-fatal — grading must not fail because the log row didn't land
    }
  }

  return { attempt: attempt as PalsTestAttempt, deduped: false, teamLeadLogWritten };
}

/** Attempts for a lab day (drives the day's status/report view). */
export async function listAttemptsForDay(labDayId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('pals_test_attempts')
    .select(
      `*,
       student:students!pals_test_attempts_student_id_fkey(id, first_name, last_name),
       checklist:pals_checklists!pals_test_attempts_checklist_id_fkey(id, category, subtype),
       team_members:pals_attempt_students(student_id)`
    )
    .eq('lab_day_id', labDayId)
    .order('attempted_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Open (unresolved, within the 30-day window) NR attempts for a student on a
 * given checklist — the retest_of picker's candidate list.
 */
export async function listOpenRetestCandidates(studentId: string, checklistId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('pals_test_attempts')
    .select('id, attempted_at, result, remediation_due_at, remediation_notes')
    .eq('student_id', studentId)
    .eq('checklist_id', checklistId)
    .eq('result', 'NR')
    .order('attempted_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
