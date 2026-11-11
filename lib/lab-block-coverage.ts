/**
 * Lab-type class blocks that the one-event-per-lab-day rule (Ben, 2026-11-10)
 * replaces with the lab day event.
 *
 * Rule (CAL 2/3d item B, decided by Claude AI 2026-11-10/11): a schedule block
 * with block_type = 'lab' AND a linked_lab_day_id is "covered" for a person when
 * that person is a guest on the lab_day_event for the same cohort and date
 * (google_calendar_events source_type 'lab_day_event', source_id '<cohort_id>:<date>').
 * Covered blocks are no longer pushed to that person's calendar. A lab-type block
 * with no linked lab day, or whose day event the person is not on, stays as is,
 * so nobody is left without an entry for a lab they are on.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

interface BlockLike {
  id: string;
  date?: string | null;
  block_type?: string | null;
  linked_lab_day_id?: string | null;
}

/**
 * Of the given blocks, return the ids that are covered for userEmail.
 * Throws on a read error so callers fail toward the old behaviour (keep the
 * block) rather than silently dropping a lab from a calendar.
 */
export async function coveredLabBlockIds(
  supabase: Db,
  userEmail: string,
  blocks: BlockLike[],
): Promise<Set<string>> {
  const candidates = blocks.filter((b) => b.block_type === 'lab' && b.linked_lab_day_id && b.date);
  const covered = new Set<string>();
  if (candidates.length === 0) return covered;

  const dayIds = Array.from(new Set(candidates.map((b) => b.linked_lab_day_id as string)));
  const dayById = new Map<string, { date: string; cohort_id: string | null }>();
  for (let i = 0; i < dayIds.length; i += 100) {
    const { data, error } = await supabase
      .from('lab_days')
      .select('id, date, cohort_id')
      .in('id', dayIds.slice(i, i + 100));
    if (error) throw new Error(`lab-block coverage: lab_days read failed: ${error.message}`);
    for (const d of data ?? []) dayById.set((d as any).id, { date: (d as any).date, cohort_id: (d as any).cohort_id ?? null });
  }

  const keyFor = (b: BlockLike): string | null => {
    const day = dayById.get(b.linked_lab_day_id as string);
    // The block date must match the lab day date, otherwise the link is suspect.
    if (!day || !day.cohort_id || day.date !== b.date) return null;
    return `${day.cohort_id}:${day.date}`;
  };

  const keys = Array.from(new Set(candidates.map(keyFor).filter((k): k is string => !!k)));
  const guestKeys = new Set<string>();
  for (let i = 0; i < keys.length; i += 100) {
    const { data, error } = await supabase
      .from('google_calendar_events')
      .select('source_id')
      .eq('source_type', 'lab_day_event')
      .ilike('user_email', userEmail)
      .in('source_id', keys.slice(i, i + 100));
    if (error) throw new Error(`lab-block coverage: day-event read failed: ${error.message}`);
    for (const g of data ?? []) guestKeys.add((g as any).source_id);
  }

  for (const b of candidates) {
    const k = keyFor(b);
    if (k && guestKeys.has(k)) covered.add(b.id);
  }
  return covered;
}
