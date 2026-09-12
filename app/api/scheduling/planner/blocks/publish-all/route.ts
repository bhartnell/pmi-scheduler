import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { syncSeriesForUser } from '@/lib/calendar-auto-sync';

/**
 * Calendar auto-sync for a batch of just-published blocks. Publishing is
 * the moment these blocks first become visible to findBlocksForInstructor
 * (which filters on status='published'), so this is the write path that
 * was silently never triggering any Google sync. Resolves every assigned
 * instructor (join table + legacy direct columns) per block, then fires
 * one syncSeriesForUser per unique (instructor, recurringGroupId|blockId)
 * pair via Promise.allSettled so one failure never aborts the rest of the
 * batch. Awaited by the caller (not fire-and-forget) — Vercel freezes the
 * serverless function as soon as the response returns, and this is a bulk
 * action where losing the sync silently would be easy to miss (same bug
 * class documented in station-instructors/route.ts, commit 0a98e539).
 */
async function syncPublishedBlocks(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  blockIds: string[]
): Promise<void> {
  if (blockIds.length === 0) return;
  try {
    const { data: blocks } = await supabase
      .from('pmi_schedule_blocks')
      .select('id, recurring_group_id, instructor_id, additional_instructor_id')
      .in('id', blockIds);
    if (!blocks || blocks.length === 0) return;

    const blockToInstructorIds = new Map<string, Set<string>>();
    for (const b of blocks) {
      const set = new Set<string>();
      if (b.instructor_id) set.add(b.instructor_id);
      if (b.additional_instructor_id) set.add(b.additional_instructor_id);
      blockToInstructorIds.set(b.id, set);
    }

    const { data: joinRows } = await supabase
      .from('pmi_block_instructors')
      .select('schedule_block_id, instructor_id')
      .in('schedule_block_id', blockIds);
    for (const r of joinRows ?? []) {
      const set = blockToInstructorIds.get(r.schedule_block_id) ?? new Set<string>();
      if (r.instructor_id) set.add(r.instructor_id);
      blockToInstructorIds.set(r.schedule_block_id, set);
    }

    const allInstructorIds = new Set<string>();
    for (const set of blockToInstructorIds.values()) for (const iid of set) allInstructorIds.add(iid);
    if (allInstructorIds.size === 0) return;

    const { data: users } = await supabase
      .from('lab_users')
      .select('id, email')
      .in('id', Array.from(allInstructorIds));
    const idToEmail = new Map<string, string>();
    for (const u of users ?? []) idToEmail.set(u.id, (u.email as string).toLowerCase());

    // De-dupe to one sync call per (instructor, series) pair — a
    // recurring group publishes many blocks at once but only needs one
    // push per instructor.
    const pairs = new Map<string, { userEmail: string; recurringGroupId: string | null; blockIdForOneOff: string | null }>();
    for (const b of blocks) {
      const instrIds = blockToInstructorIds.get(b.id) ?? new Set<string>();
      for (const iid of instrIds) {
        const email = idToEmail.get(iid);
        if (!email) continue;
        const key = b.recurring_group_id ? `${email}:group:${b.recurring_group_id}` : `${email}:block:${b.id}`;
        if (!pairs.has(key)) {
          pairs.set(key, {
            userEmail: email,
            recurringGroupId: b.recurring_group_id ?? null,
            blockIdForOneOff: b.recurring_group_id ? null : b.id,
          });
        }
      }
    }

    const settled = await Promise.allSettled(
      Array.from(pairs.values()).map((p) => syncSeriesForUser(p))
    );
    for (const s of settled) {
      if (s.status === 'rejected') {
        console.error('[publish-all] auto-sync rejected:', s.reason);
      } else if (s.value.status === 'failed') {
        console.warn('[publish-all] auto-sync failed:', s.value.error);
      }
    }
  } catch (err) {
    console.error('[publish-all] auto-sync error:', err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { semester_id, program_schedule_id, date_from, date_to } = body;

    if (!semester_id) {
      return NextResponse.json({ error: 'semester_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Scoped publish (planning workspace): publish only a single cohort's draft
    // blocks, optionally within a date range (the visible week). Keeps the
    // workspace's "publish what's in view" tight instead of the whole semester.
    if (program_schedule_id) {
      let q = supabase
        .from('pmi_schedule_blocks')
        .update({ status: 'published' })
        .eq('status', 'draft')
        .eq('program_schedule_id', program_schedule_id);
      if (date_from) q = q.gte('date', date_from);
      if (date_to) q = q.lte('date', date_to);
      const { data: scoped, error: scopedErr } = await q.select('id');
      if (scopedErr) {
        return NextResponse.json({ error: scopedErr.message }, { status: 500 });
      }
      await syncPublishedBlocks(supabase, (scoped ?? []).map((b) => b.id));
      return NextResponse.json({ count: scoped?.length || 0 });
    }

    // Find the program_schedule_ids for this semester
    const { data: schedules } = await supabase
      .from('pmi_program_schedules')
      .select('id')
      .eq('semester_id', semester_id);

    const scheduleIds = schedules?.map(s => s.id) || [];

    if (scheduleIds.length === 0) {
      // Also try direct semester_id on blocks
      const { data: updated, error } = await supabase
        .from('pmi_schedule_blocks')
        .update({ status: 'published' })
        .eq('semester_id', semester_id)
        .eq('status', 'draft')
        .select('id');

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      await syncPublishedBlocks(supabase, (updated ?? []).map((b) => b.id));
      return NextResponse.json({ count: updated?.length || 0 });
    }

    // Update all draft blocks for these program schedules
    const { data: updated, error } = await supabase
      .from('pmi_schedule_blocks')
      .update({ status: 'published' })
      .eq('status', 'draft')
      .in('program_schedule_id', scheduleIds)
      .select('id');

    if (error) {
      // Try with semester_id directly as fallback
      const { data: updated2, error: error2 } = await supabase
        .from('pmi_schedule_blocks')
        .update({ status: 'published' })
        .eq('semester_id', semester_id)
        .eq('status', 'draft')
        .select('id');

      if (error2) {
        return NextResponse.json({ error: error2.message }, { status: 500 });
      }

      await syncPublishedBlocks(supabase, (updated2 ?? []).map((b) => b.id));
      return NextResponse.json({ count: updated2?.length || 0 });
    }

    // Also publish blocks with direct semester_id reference (unlinked blocks)
    const { data: unlinkedUpdated } = await supabase
      .from('pmi_schedule_blocks')
      .update({ status: 'published' })
      .eq('semester_id', semester_id)
      .eq('status', 'draft')
      .is('program_schedule_id', null)
      .select('id');

    const totalCount = (updated?.length || 0) + (unlinkedUpdated?.length || 0);

    await syncPublishedBlocks(supabase, [
      ...(updated ?? []).map((b) => b.id),
      ...(unlinkedUpdated ?? []).map((b) => b.id),
    ]);

    return NextResponse.json({ count: totalCount });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
