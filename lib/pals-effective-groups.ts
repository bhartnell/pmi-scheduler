// Effective PALS group membership for a course day.
// lab_group_members is never changed: the coordinator regroup writes overlay
// rows to pals_group_moves, and every reader (graders, coordinator, record
// page) layers the active moves on top of the base roster with this one helper
// so a student shows in the same group everywhere. Withdrawn/inactive students
// are hidden from live pickers only; historical attempts are untouched.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface GroupMoveRow {
  id?: string;
  student_id: string;
  from_group_id: string;
  to_group_id: string;
  duration: string;
  move_date?: string | null;
}

export interface EffectiveMember {
  id: string;
  first_name: string;
  last_name: string;
  status?: string | null;
  discipline?: string | null;
  [k: string]: unknown;
}

/** Active moves only: 'today' moves lapse after the day they were made. */
export function filterActiveMoves<T extends GroupMoveRow>(moves: T[], today: string): T[] {
  return (moves || []).filter((m) => m.duration !== 'today' || m.move_date === today);
}

/** A student is live unless explicitly withdrawn/dropped/inactive. */
export function isLiveStudent(status: string | null | undefined): boolean {
  if (!status) return true;
  return status === 'active';
}

/**
 * Pure: base members per group -> effective members per group.
 * Removes inactive students, then moves each moved student from from_group to
 * to_group (only if they are in from_group and not already in to_group).
 */
export function applyGroupMoves(
  membersByGroup: Record<string, EffectiveMember[]>,
  moves: GroupMoveRow[],
): Record<string, EffectiveMember[]> {
  const out: Record<string, EffectiveMember[]> = {};
  for (const [gid, list] of Object.entries(membersByGroup)) {
    out[gid] = list.filter((s) => isLiveStudent(s.status));
  }
  for (const m of moves) {
    const from = out[m.from_group_id];
    const to = out[m.to_group_id];
    if (!from || !to) continue;
    const idx = from.findIndex((s) => s.id === m.student_id);
    if (idx === -1) continue;
    const [student] = from.splice(idx, 1);
    if (!to.some((s) => s.id === student.id)) to.push(student);
  }
  const byName = (a: EffectiveMember, b: EffectiveMember) =>
    `${a.last_name}${a.first_name}`.localeCompare(`${b.last_name}${b.first_name}`);
  for (const gid of Object.keys(out)) out[gid].sort(byName);
  return out;
}

/** Loads the cohort's active course moves (read-only). */
export async function loadActiveMoves(
  supabase: SupabaseClient,
  cohortId: string,
  today: string = new Date().toISOString().slice(0, 10),
): Promise<GroupMoveRow[]> {
  const { data, error } = await supabase
    .from('pals_group_moves')
    .select('id, student_id, from_group_id, to_group_id, duration, move_date')
    .eq('cohort_id', cohortId)
    .is('ended_at', null);
  if (error) throw error;
  return filterActiveMoves((data || []) as GroupMoveRow[], today);
}
