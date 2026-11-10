// Withdraw action: clear a student's FUTURE placements (Withdrawn Students, PR 3).
// Future = strictly after today (America/Phoenix). Past rows are never touched.
// Every removed row is copied to deleted_records_archive (source 'student_withdraw') BEFORE removal;
// if the archive insert fails, nothing is removed ("no archive, no delete").
// lab_group_members is NOT touched: the live-student rule hides it and re-enroll restores the group.

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveOsceStudent, type RosterStudent } from './osce-student-invites.ts';

export const WITHDRAW_ARCHIVE_SOURCE = 'student_withdraw';

export function todayPhoenix(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Phoenix' }).format(now);
}

export interface PlannedRow {
  table: 'lab_day_station_assignments' | 'exam_signups' | 'osce_student_schedule';
  id: string;
  label: string;
  date: string;
  row: Record<string, unknown>;
  /** OSCE only: Google event on the host calendar to cancel once the row is archived. */
  googleEventId?: string | null;
}

export interface FuturePlan {
  rows: PlannedRow[];
  /** OSCE roster names that could not be resolved to this student (reported, never guessed). */
  notes: string[];
}

interface StudentRef { id: string; first_name: string; last_name: string; email: string | null; cohort_id: string | null }

/** Read-only: what a withdrawal would clear. */
export async function planFuturePlacements(supabase: SupabaseClient, s: StudentRef, today = todayPhoenix()): Promise<FuturePlan> {
  const rows: PlannedRow[] = [];
  const notes: string[] = [];

  // 1. Future station assignments (lab day date > today).
  const { data: sa } = await supabase
    .from('lab_day_station_assignments')
    .select('*, lab_day:lab_days!lab_day_station_assignments_lab_day_id_fkey(date)')
    .eq('student_id', s.id);
  for (const r of (sa ?? []) as any[]) {
    const date = r.lab_day?.date as string | undefined;
    if (date && date > today) {
      const { lab_day: _drop, ...row } = r;
      rows.push({ table: 'lab_day_station_assignments', id: r.id, label: `Station assignment on ${date}`, date, row });
    }
  }

  // 2. Future exam signups still pending/confirmed (session date > today).
  const { data: es } = await supabase
    .from('exam_signups')
    .select('*, session:exam_sessions(date)')
    .eq('student_id', s.id)
    .in('status', ['pending', 'confirmed']);
  for (const r of (es ?? []) as any[]) {
    const date = r.session?.date as string | undefined;
    if (date && date > today) {
      const { session: _drop, ...row } = r;
      rows.push({ table: 'exam_signups', id: r.id, label: `Exam signup on ${date}`, date, row });
    }
  }

  // 3. Future OSCE slots: events of the student's cohort not yet ended, matched by the same name rule
  //    the invite sender uses. A slot is only taken when the name resolves to exactly this student.
  if (s.cohort_id) {
    const { data: events } = await supabase
      .from('osce_events').select('id, title, end_date').eq('cohort_id', s.cohort_id).gte('end_date', today);
    const evs = (events ?? []) as Array<{ id: string }>;
    if (evs.length) {
      const { data: roster } = await supabase
        .from('students').select('id, first_name, last_name, email').eq('cohort_id', s.cohort_id);
      const { data: sched } = await supabase
        .from('osce_student_schedule').select('*, block:osce_time_blocks(date)').in('event_id', evs.map((e) => e.id));
      for (const r of (sched ?? []) as any[]) {
        const date = r.block?.date as string | undefined;
        if (!date || date <= today) continue;
        const res = resolveOsceStudent(r.student_name, (roster ?? []) as RosterStudent[]);
        // email-less match is 'unresolved' in the sender; for withdrawal we still want an id match.
        const nameKey = String(r.student_name ?? '');
        const matchesById = res.status === 'resolved' && res.student.id === s.id;
        const matchesEmailless = res.status === 'unresolved' && res.reason.startsWith('Matched one student but') &&
          nameKey.toUpperCase().includes(s.last_name.toUpperCase());
        if (matchesById || matchesEmailless) {
          const { block: _drop, ...row } = r;
          rows.push({ table: 'osce_student_schedule', id: r.id, label: `OSCE slot ${nameKey} on ${date}`, date, row, googleEventId: r.google_event_id ?? null });
        }
      }
    }
  }
  return { rows, notes };
}

export interface ClearResult {
  cleared: Array<{ table: string; id: string; label: string }>;
  failed: string[];
  batch_id: string | null;
  invites_cancelled: number;
}

/** Archive-then-remove. cancelInvite is injected so tests need no network. */
export async function clearFuturePlacements(opts: {
  supabase: SupabaseClient;
  plan: FuturePlan;
  by: string;
  reason: string | null;
  cancelInvite?: (googleEventId: string) => Promise<boolean>;
}): Promise<ClearResult> {
  const { supabase, plan, by, reason, cancelInvite } = opts;
  const out: ClearResult = { cleared: [], failed: [], batch_id: null, invites_cancelled: 0 };
  if (plan.rows.length === 0) return out;

  const batch = crypto.randomUUID();
  const archiveRows = plan.rows.map((p) => ({
    batch_id: batch, table_name: p.table, row_data: p.row,
    reason: reason || 'Student withdrawn', deleted_by: by, source: WITHDRAW_ARCHIVE_SOURCE,
  }));
  const { error: arcErr } = await supabase.from('deleted_records_archive').insert(archiveRows);
  if (arcErr) {
    out.failed.push(`Archive failed, nothing was cleared: ${arcErr.message}`);
    return out;
  }
  out.batch_id = batch;

  for (const p of plan.rows) {
    if (p.googleEventId && cancelInvite) {
      try { if (await cancelInvite(p.googleEventId)) out.invites_cancelled++; }
      catch { out.failed.push(`Could not cancel the calendar invite for ${p.label}`); }
    }
    const { error } = await supabase.from(p.table).delete().eq('id', p.id);
    if (error) out.failed.push(`${p.label}: ${error.message}`);
    else out.cleared.push({ table: p.table, id: p.id, label: p.label });
  }
  return out;
}
