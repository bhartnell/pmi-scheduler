/**
 * PALS final testing export: one sheet per student carrying ALL THREE synchronized
 * final rounds of their group (lead named on each) plus the group result.
 * Read-only. Members of a round = recorded pals_attempt_students, else the
 * attempt group's effective membership minus students absent that lab day
 * (lib/pals-attempt-members.ts). Nothing is written or inferred into the DB.
 */
import { getSupabaseAdmin } from '@/lib/supabase';
import type { ReportScope } from '@/lib/reports/engine';
import { applyGroupMoves, loadActiveMoves } from '@/lib/pals-effective-groups';
import { resolveAttemptMembers, groupFinalRounds } from '@/lib/pals-attempt-members';
import { palsGroupResult, normalizePalsResult, type PalsGroupResult } from '@/lib/pals-group-result';

export interface PalsFinalRound {
  attemptId: string;
  caseCode: string | null;
  caseTitle: string | null;
  result: 'PASS' | 'NR' | null;
  watch: boolean;
  leadName: string;
  leadId: string;
  date: string | null;
  groupName: string | null;
}
export interface PalsGroupReportRow {
  student: { id: string; firstName: string; lastName: string };
  groupName: string | null;
  rounds: PalsFinalRound[]; // every final round the student's group carried, in time order
  ledRoundIds: string[]; // rounds this student led
  groupResult: PalsGroupResult;
}

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function fetchPalsGroupReport(scope: ReportScope): Promise<PalsGroupReportRow[]> {
  const sb = getSupabaseAdmin();
  let students: Array<{ id: string; first_name: string; last_name: string; cohort_id: string | null }> = [];
  if (scope.kind === 'student') {
    const { data } = await sb.from('students').select('id, first_name, last_name, cohort_id').eq('id', scope.studentId).single();
    if (data) students = [data];
  } else {
    const { data } = await sb.from('students').select('id, first_name, last_name, cohort_id')
      .eq('is_test', false).eq('cohort_id', scope.cohortId).eq('status', 'active').order('last_name');
    students = data ?? [];
  }
  if (students.length === 0) return [];
  const cohortIds = [...new Set(students.map((s) => s.cohort_id).filter(Boolean))] as string[];

  const { data: days } = await sb.from('lab_days').select('id, date, cohort_id')
    .eq('cert_course', 'pals').eq('is_adv_cert_testing', true).eq('is_archived', false).in('cohort_id', cohortIds);
  const dayIds = (days ?? []).map((d) => d.id);
  if (dayIds.length === 0) return students.map((s) => emptyRow(s));
  const dayDate = Object.fromEntries((days ?? []).map((d) => [d.id, d.date as string]));

  const { data: att } = await sb.from('pals_test_attempts')
    .select(`id, lab_day_id, lab_group_id, scenario_id, result, watch, attempted_at,
      lead:students!pals_test_attempts_student_id_fkey(id, first_name, last_name),
      scenario:scenarios!pals_test_attempts_scenario_id_fkey(case_code, title)`)
    .in('lab_day_id', dayIds);
  const attempts = (att ?? []) as any[];
  const attemptIds = attempts.map((a) => a.id);

  const recorded: Record<string, string[]> = {};
  if (attemptIds.length) {
    const { data } = await sb.from('pals_attempt_students').select('attempt_id, student_id').in('attempt_id', attemptIds);
    for (const r of data ?? []) (recorded[r.attempt_id] ??= []).push(r.student_id);
  }
  const absentByDay: Record<string, Set<string>> = {};
  const { data: abs } = await sb.from('lab_day_attendance').select('lab_day_id, student_id').in('lab_day_id', dayIds).eq('status', 'absent');
  for (const r of abs ?? []) (absentByDay[r.lab_day_id] ??= new Set()).add(r.student_id);

  // Effective group membership per cohort (regroups applied, withdrawn hidden).
  const groupIds = [...new Set(attempts.map((a) => a.lab_group_id).filter(Boolean))] as string[];
  const groupName: Record<string, string> = {};
  const baseMembers: Record<string, any[]> = {};
  if (groupIds.length) {
    const { data: gs } = await sb.from('lab_groups').select('id, name').in('id', groupIds);
    for (const g of gs ?? []) groupName[g.id] = g.name;
    const { data: ms } = await sb.from('lab_group_members')
      .select('lab_group_id, student:students!lab_group_members_student_id_fkey(id, first_name, last_name, status)')
      .in('lab_group_id', groupIds);
    for (const m of ms ?? []) { const s: any = (m as any).student; if (s) (baseMembers[(m as any).lab_group_id] ??= []).push(s); }
  }
  const moves = (await Promise.all(cohortIds.map((c) => loadActiveMoves(sb, c).catch(() => [])))).flat();
  const effective = applyGroupMoves(baseMembers as any, moves);

  const rounds = attempts.map((a) => ({
    a,
    members: resolveAttemptMembers({
      leadId: a.lead?.id, recordedIds: recorded[a.id],
      groupMemberIds: (effective[a.lab_group_id] || []).map((m: any) => m.id),
      absentIds: absentByDay[a.lab_day_id],
    }),
  }));

  return students.map((s) => {
    const mine = rounds.filter((r) => r.members.includes(s.id)).map((r) => r.a);
    const finals = groupFinalRounds(mine.map((a) => ({ ...a, result: a.result })));
    const groupResult = palsGroupResult(finals.map((a: any) => a.result));
    const out: PalsFinalRound[] = finals.map((a: any) => ({
      attemptId: a.id, caseCode: a.scenario?.case_code ?? null, caseTitle: a.scenario?.title ?? null,
      result: normalizePalsResult(a.result), watch: !!a.watch,
      leadName: a.lead ? `${a.lead.first_name} ${a.lead.last_name}` : 'Not recorded', leadId: a.lead?.id ?? '',
      date: dayDate[a.lab_day_id] ?? null, groupName: a.lab_group_id ? groupName[a.lab_group_id] ?? null : null,
    }));
    return {
      student: { id: s.id, firstName: s.first_name, lastName: s.last_name },
      groupName: out[0]?.groupName ?? null, rounds: out,
      ledRoundIds: out.filter((r) => r.leadId === s.id).map((r) => r.attemptId), groupResult,
    };
  });
}

function emptyRow(s: { id: string; first_name: string; last_name: string }): PalsGroupReportRow {
  return { student: { id: s.id, firstName: s.first_name, lastName: s.last_name }, groupName: null, rounds: [], ledRoundIds: [], groupResult: palsGroupResult([]) };
}

export const PALS_GROUP_CSS = '.palsgrp{padding:24px 32px;break-after:page;font-family:Arial,Helvetica,sans-serif;color:#000}.palsgrp h1{font-size:18pt;margin:0 0 4px}.palsgrp h2{font-size:13pt;margin:14px 0 6px}.palsgrp table{width:100%;border-collapse:collapse}.palsgrp th,.palsgrp td{border:1px solid #000;padding:6px 8px;text-align:left;font-size:11pt}.palsgrp th{background:#eee}.palsgrp .pass{font-weight:700;color:#116611}.palsgrp .nr{font-weight:700;color:#aa1111}.palsgrp .note{font-size:10pt;color:#444;margin-top:8px}';

export function renderPalsStudentSheet(row: PalsGroupReportRow): string {
  const gr = row.groupResult;
  const status = gr.status === 'pass' ? 'PASS' : gr.status === 'fail' ? 'NOT YET COMPETENT (NR)' : 'PENDING';
  const rowsHtml = row.rounds.length
    ? row.rounds.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.caseCode?.replace(/^PALS_/i, '').replace(/_/g, ' ') || r.caseTitle || 'Case')}${r.caseTitle && r.caseCode ? ` - ${esc(r.caseTitle)}` : ''}</td><td>${esc(r.leadName)}${r.leadId === row.student.id ? ' (this student led)' : ''}</td><td class="${r.result === 'PASS' ? 'pass' : 'nr'}">${r.result === 'PASS' ? 'PASS' : r.result === 'NR' ? 'NR' : 'Not graded'}${r.watch ? ' (watch)' : ''}</td><td>${esc(r.date)}</td></tr>`).join('')
    : '<tr><td colspan="5">No final rounds recorded for this student\'s group.</td></tr>';
  return `<section class="palsgrp"><h1>PALS Case Scenario Testing - Group Result</h1>
<div><b>${esc(row.student.lastName)}, ${esc(row.student.firstName)}</b>${row.groupName ? ` &middot; ${esc(row.groupName)}` : ''}</div>
<h2>Group result: <span class="${gr.status === 'pass' ? 'pass' : 'nr'}">${status}</span> (${gr.passedRounds} of 3 final rounds passed; 2 of 3 required)</h2>
<table><thead><tr><th>#</th><th>Final round case</th><th>Team leader</th><th>Result</th><th>Date</th></tr></thead><tbody>${rowsHtml}</tbody></table>
<p class="note">Every member of the group carries all three synchronized final rounds. Members are taken from the recorded team roster, or from the group minus students absent that day.</p></section>`;
}

export function renderPalsDocument(rows: PalsGroupReportRow[], opts: { autoPrint?: boolean } = {}): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>PALS Group Results</title><style>${PALS_GROUP_CSS}</style></head><body>${rows.map(renderPalsStudentSheet).join('')}${opts.autoPrint ? '<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>' : ''}</body></html>`;
}
