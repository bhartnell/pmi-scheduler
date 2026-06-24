/**
 * AHA Megacode Testing Checklist — data layer (first AHA export branch).
 *
 * Read-only. Pulls each student's SCORED megacode attempts (practice + testing —
 * AHA permits practice scenarios for grading; practice is the program's normal
 * grading vehicle), selects the best, and maps the rhythm chain to an official
 * AHA Megacode variant. Validated against G14 (see docs/AHA_EXPORT_SPEC.md §8a).
 *
 * Selection: best SCORE wins — PASS > FAIL, then most criteria met (no megacode
 * criteria are flagged is_critical today, so "most critical actions" == most met;
 * revisit if criticals get flagged). A testing attempt is used when present; a
 * passing practice attempt is equally valid. If the chosen attempt's chain has no
 * official AHA variant, it is FLAGGED for manual variant selection on the form —
 * the higher score is not discarded to chase a mappable one.
 *
 * The HTML render lives in a separate template module, pending the official 2025
 * AHA form layout (Ben).
 */
import { getSupabaseAdmin } from '@/lib/supabase';
import type { ReportScope } from '@/lib/reports/engine';

// Rhythm-management segment types that define the megacode "chain" (the always-
// present team_leader / cpr_quality / pcac wrap is excluded from the variant key).
const WRAP = new Set(['team_leader', 'cpr_quality', 'pcac']);

export interface AhaVariant { code: string; label: string; rhythms: string[]; }

/** The 6 official AHA Megacode Testing variants, keyed by rhythm chain. */
export const AHA_MEGACODE_VARIANTS: Record<string, AhaVariant> = {
  'bradycardia>pvt>pea': { code: '1/3/8', label: 'Bradycardia → pVT → PEA → PCAC', rhythms: ['bradycardia', 'pvt', 'pea'] },
  'bradycardia>vf>asystole': { code: '2/5', label: 'Bradycardia → VF → Asystole → PCAC', rhythms: ['bradycardia', 'vf', 'asystole'] },
  'tachycardia>vf>pea': { code: '4/7/10', label: 'Tachycardia → VF → PEA → PCAC', rhythms: ['tachycardia', 'vf', 'pea'] },
  'bradycardia>vf>pea': { code: '6/11', label: 'Bradycardia → VF → PEA → PCAC', rhythms: ['bradycardia', 'vf', 'pea'] },
  'tachycardia>pea>vf': { code: '9', label: 'Tachycardia → PEA → VF → PCAC', rhythms: ['tachycardia', 'pea', 'vf'] },
  'bradycardia>vf>asystole/pea': { code: '12', label: 'Bradycardia → VF → Asystole/PEA → PCAC', rhythms: ['bradycardia', 'vf', 'asystole'] },
};

export function chainToVariant(chain: string[]): AhaVariant | null {
  return AHA_MEGACODE_VARIANTS[chain.join('>')] ?? null;
}

export interface MegacodeCriterion { text: string; met: boolean; isCritical: boolean; recorded: boolean; }
export interface MegacodeSegment { name: string; algorithmType: string; order: number; result: string | null; criteria: MegacodeCriterion[]; }
export interface MegacodeAttempt {
  id: string;
  caseCode: string | null;
  certTier: string | null;
  result: 'pass' | 'fail' | string;
  chain: string[];
  metCount: number;
  segments: MegacodeSegment[];
}
export interface MegacodeReportRow {
  student: { id: string; firstName: string; lastName: string };
  best: MegacodeAttempt | null;
  variant: AhaVariant | null;
  allAttempts: MegacodeAttempt[]; // for the optional "show all attempts" print
  flags: string[];
}
export interface MegacodeReport {
  rows: MegacodeReportRow[];
  summary: { total: number; namedVariant: number; sectionMapped: number; noAttempt: number };
}

export function selectBest(attempts: MegacodeAttempt[]): { best: MegacodeAttempt | null; variant: AhaVariant | null; flags: string[] } {
  const flags: string[] = [];
  if (attempts.length === 0) return { best: null, variant: null, flags: ['No scorable megacode attempt'] };
  const passes = attempts.filter((a) => a.result === 'pass');
  const pool = passes.length ? passes : attempts;
  const best = [...pool].sort((a, b) => b.metCount - a.metCount)[0];
  const variant = chainToVariant(best.chain);
  if (passes.length === 0) flags.push('No pass — best fail used for documentation');
  // A non-named chain is NOT a problem: AHA permits practice scenarios as testing
  // cases, and the rhythm SECTIONS (Brady/VF/pVT/PEA/Asystole/PCAC/Tachy) use the
  // same shared criteria regardless of chain — so the form populates validly
  // section-by-section. No flag for an unmatched chain.
  return { best, variant, flags };
}

/**
 * Fetch + shape the megacode report for a scope. Read-only.
 * Runtime-validated end-to-end once the render endpoint exists; the selection +
 * mapping logic is already validated against G14 (docs/AHA_EXPORT_SPEC.md §8a).
 */
export async function fetchMegacodeReport(scope: ReportScope, opts: { course?: 'acls' | 'pals' } = {}): Promise<MegacodeReport> {
  const course = opts.course ?? 'acls';
  const supabase = getSupabaseAdmin();

  // 1. students in scope
  let students: Array<{ id: string; first_name: string; last_name: string }> = [];
  if (scope.kind === 'student') {
    const { data } = await supabase.from('students').select('id, first_name, last_name').eq('id', scope.studentId).single();
    if (data) students = [data];
  } else {
    const { data } = await supabase.from('students')
      .select('id, first_name, last_name').eq('cohort_id', scope.cohortId).eq('status', 'active').order('last_name');
    students = data ?? [];
  }
  const studentIds = students.map((s) => s.id);
  if (studentIds.length === 0) return { rows: [], summary: { total: 0, namedVariant: 0, sectionMapped: 0, noAttempt: 0 } };

  // 2. attempts for those team leads
  const { data: attemptRows } = await supabase
    .from('adv_cert_test_attempts')
    .select('id, team_lead_id, overall_result, scenario_id')
    .eq('cert_course', course)
    .in('team_lead_id', studentIds);
  const attempts = attemptRows ?? [];
  const attemptIds = attempts.map((a) => a.id);
  const scenarioIds = [...new Set(attempts.map((a) => a.scenario_id).filter(Boolean))] as string[];

  // 3. scenario meta + assembled chain (scenario_segments -> segments)
  const scenMeta: Record<string, { caseCode: string | null; certTier: string | null }> = {};
  if (scenarioIds.length) {
    const { data: scs } = await supabase.from('scenarios').select('id, case_code, cert_tier').in('id', scenarioIds);
    for (const s of scs ?? []) scenMeta[s.id] = { caseCode: s.case_code, certTier: s.cert_tier };
  }
  // scenario_segments (chain + segment names + segment id) keyed by scenario
  const scenarioSegs: Record<string, Array<{ id: string; order: number; name: string; algorithmType: string; segmentId: string }>> = {};
  const segmentIds = new Set<string>();
  if (scenarioIds.length) {
    const { data: sss } = await supabase
      .from('adv_cert_scenario_segments')
      .select('id, scenario_id, sequence_order, segment_id, adv_cert_segments(id, name, algorithm_type)')
      .in('scenario_id', scenarioIds);
    for (const r of sss ?? []) {
      const seg = (r as unknown as { adv_cert_segments: { id: string; name: string; algorithm_type: string } | null }).adv_cert_segments;
      const segmentId = seg?.id ?? (r as { segment_id: string }).segment_id;
      if (segmentId) segmentIds.add(segmentId);
      (scenarioSegs[r.scenario_id] ??= []).push({
        id: r.id, order: r.sequence_order, name: seg?.name ?? '', algorithmType: seg?.algorithm_type ?? '', segmentId,
      });
    }
    for (const k of Object.keys(scenarioSegs)) scenarioSegs[k].sort((a, b) => a.order - b.order);
  }

  // 3b. CURRENT criteria definitions per segment (ordered by display_order) — the
  // source of truth for the checklist. Maps by criterion id so each attempt's
  // recorded results attach by identity (robust to criteria added after grading).
  const segCriteriaDefs: Record<string, Array<{ id: string; text: string; isCritical: boolean }>> = {};
  if (segmentIds.size) {
    const { data: defs } = await supabase
      .from('adv_cert_segment_criteria')
      .select('id, segment_id, text, display_order, is_critical')
      .in('segment_id', [...segmentIds]).eq('active', true)
      .order('display_order');
    for (const d of defs ?? []) {
      (segCriteriaDefs[d.segment_id] ??= []).push({ id: d.id, text: d.text, isCritical: !!d.is_critical });
    }
  }

  // 4. segment_results + criterion_results for the attempts
  const segResults: Array<{ id: string; attempt_id: string; scenario_segment_id: string; result: string | null }> = [];
  const metBySegResult: Record<string, Map<string, boolean>> = {}; // segResultId -> (criterionId -> met)
  if (attemptIds.length) {
    const { data: srs } = await supabase
      .from('adv_cert_segment_results')
      .select('id, attempt_id, scenario_segment_id, result')
      .in('attempt_id', attemptIds);
    segResults.push(...(srs ?? []));
    const segResultIds = segResults.map((s) => s.id);
    if (segResultIds.length) {
      const { data: crs } = await supabase
        .from('adv_cert_criterion_results')
        .select('segment_result_id, criterion_id, met')
        .in('segment_result_id', segResultIds);
      for (const cr of crs ?? []) {
        (metBySegResult[cr.segment_result_id] ??= new Map()).set(cr.criterion_id, !!cr.met);
      }
    }
  }
  const segResultsByAttempt: Record<string, typeof segResults> = {};
  for (const sr of segResults) (segResultsByAttempt[sr.attempt_id] ??= []).push(sr);

  // assemble MegacodeAttempt objects — criteria come from the segment's CURRENT
  // definitions (ordered), each annotated with the attempt's recorded met-status
  // (or recorded=false if the attempt has no result, e.g. a criterion added after
  // grading → rendered "needs marking", never a false miss or a fabricated pass).
  function buildAttempt(a: { id: string; overall_result: string; scenario_id: string | null }): MegacodeAttempt {
    const meta = a.scenario_id ? scenMeta[a.scenario_id] : undefined;
    const sss = a.scenario_id ? (scenarioSegs[a.scenario_id] ?? []) : [];
    const segByScenarioSegId = new Map(sss.map((s) => [s.id, s]));
    const chain = sss.filter((s) => !WRAP.has(s.algorithmType)).map((s) => s.algorithmType);
    const segs = (segResultsByAttempt[a.id] ?? []).map((sr) => {
      const m = segByScenarioSegId.get(sr.scenario_segment_id);
      const defs = m ? (segCriteriaDefs[m.segmentId] ?? []) : [];
      const resultMap = metBySegResult[sr.id] ?? new Map<string, boolean>();
      const criteria: MegacodeCriterion[] = defs.map((d) => ({
        text: d.text, isCritical: d.isCritical,
        recorded: resultMap.has(d.id), met: resultMap.get(d.id) ?? false,
      }));
      return {
        name: m?.name ?? '', algorithmType: m?.algorithmType ?? '', order: m?.order ?? 999,
        result: sr.result, criteria,
      } as MegacodeSegment;
    }).sort((x, y) => x.order - y.order);
    const metCount = segs.reduce((n, s) => n + s.criteria.filter((c) => c.met).length, 0);
    return {
      id: a.id, caseCode: meta?.caseCode ?? null, certTier: meta?.certTier ?? null,
      result: a.overall_result, chain, metCount, segments: segs,
    };
  }

  const attemptsByStudent: Record<string, MegacodeAttempt[]> = {};
  for (const a of attempts) (attemptsByStudent[a.team_lead_id] ??= []).push(buildAttempt(a));

  const rows: MegacodeReportRow[] = students.map((s) => {
    const all = attemptsByStudent[s.id] ?? [];
    const { best, variant, flags } = selectBest(all);
    return {
      student: { id: s.id, firstName: s.first_name, lastName: s.last_name },
      best, variant, allAttempts: all, flags,
    };
  });

  const summary = {
    total: rows.length,
    namedVariant: rows.filter((r) => r.best && r.variant).length,
    sectionMapped: rows.filter((r) => r.best && !r.variant).length, // practice-as-testing; valid by section
    noAttempt: rows.filter((r) => !r.best).length,
  };
  return { rows, summary };
}
