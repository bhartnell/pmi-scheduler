/**
 * Deletion-request queue helper.
 *
 * Root cause of the "needs approval fires but nothing appears in
 * /admin/deletion-requests" bug: the DELETE endpoints for students,
 * scenarios, cohorts, lab days, and internships rejected non-superadmin
 * callers with a 403 ("requires superadmin approval via deletion requests")
 * but NEVER inserted a row into `deletion_requests`. The approval queue reads
 * from that table, so it was always empty — the request never reached it.
 *
 * This helper creates the pending request (deduped) so the queue actually
 * receives it. It is best-effort: it logs and swallows errors so a queue
 * hiccup never turns the delete-guard into a 500.
 */
import { getSupabaseAdmin } from '@/lib/supabase';

type Admin = ReturnType<typeof getSupabaseAdmin>;

// item_type values understood by the approval handler's tableMap
// (app/api/admin/deletion-requests/route.ts PATCH).
export type DeletionItemType =
  | 'student' | 'scenario' | 'cohort' | 'station'
  | 'lab_day' | 'certification' | 'ce_record' | 'internship';

/**
 * Insert a pending deletion request if one isn't already queued for this item.
 * Returns true if a new request was created (or one already existed), false on
 * a hard failure — but never throws.
 */
export async function createDeletionRequestIfAbsent(
  supabase: Admin,
  opts: { itemType: DeletionItemType; itemId: string; itemName: string; requestedBy: string },
): Promise<boolean> {
  try {
    const { data: existing } = await supabase
      .from('deletion_requests')
      .select('id')
      .eq('item_type', opts.itemType)
      .eq('item_id', opts.itemId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) return true; // already queued — don't duplicate

    const { error } = await supabase.from('deletion_requests').insert({
      item_type: opts.itemType,
      item_id: opts.itemId,
      item_name: opts.itemName || opts.itemId,
      reason: '',
      requested_by: opts.requestedBy,
      status: 'pending',
    });

    if (error) {
      console.error('[deletion-request] insert failed:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[deletion-request] error:', e instanceof Error ? e.message : String(e));
    return false;
  }
}
