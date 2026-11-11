import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAccessTokenForUser } from '@/lib/google-calendar';
import { logAuditEvent } from '@/lib/audit';

/**
 * /api/admin/calendar-sync/retire-lab-blocks   (SUPERADMIN, one-time)
 *
 * CAL 2/3d item B (decided by Claude AI 2026-11-10/11, inside Ben's one-event-per-lab-day
 * rule): the class schedule block for a lab ("Day 1 S2 Lab" etc.) is pushed to instructors'
 * calendars as a whole-semester recurring series. Where a date has a linked lab day AND the
 * person is a guest on that day's lab_day_event, the day event replaces it.
 *
 * GET  -> dry run: the exact FUTURE series instances that would be cancelled, and the future
 *         lab-type instances that are KEPT (no linked lab day, or no day event for that person).
 * POST { confirm: true, user_email?: string, limit?: number }
 *      -> cancels each listed instance only (instances API, DELETE of the instance id,
 *         sendUpdates=none, so no mail). The series itself, its recurrence and its mapping row
 *         are NEVER edited or deleted. Use user_email for a canary first.
 *
 * SAFETY (Data Safety standing order):
 *   - Future dates only (Pacific today). Past instances stay.
 *   - Instance-level cancel only. If Google does not return the instance, or the event is not
 *     recurring, the row is skipped and reported; nothing else is touched.
 *   - Every instance is written to audit_log (full instance payload in metadata) BEFORE it is
 *     cancelled, so it can be restored by hand. Sync skips patching a series that has covered
 *     instances, so the cancellations are not undone by a later sync.
 *   - Idempotent: an already-cancelled instance is simply not returned by Google.
 *   - Lab-type blocks with no linked lab day (e.g. 12-07, 12-08, 12-09 series dates) are kept.
 *
 * Remove this route and its button once the dry run lists 0 rows (MAINTENANCE BUTTON RULE).
 */

const GOOGLE = 'https://www.googleapis.com/calendar/v3';

function todayPacific(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
}
function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

interface Target {
  user_email: string;
  google_event_id: string;
  group_id: string;
  title: string;
  date: string;
  block_id: string;
}
interface Kept {
  user_email: string;
  group_id: string;
  title: string;
  date: string;
  reason: string;
}

async function loadTargets(userEmail?: string): Promise<{ targets: Target[]; kept: Kept[] }> {
  const supabase = getSupabaseAdmin();
  const today = todayPacific();

  const { data: blocks, error: bErr } = await supabase
    .from('pmi_schedule_blocks')
    .select('id, recurring_group_id, date, title, linked_lab_day_id')
    .eq('block_type', 'lab')
    .eq('status', 'published')
    .not('recurring_group_id', 'is', null)
    .gte('date', today);
  if (bErr) throw new Error(bErr.message);
  const labBlocks = blocks ?? [];
  if (labBlocks.length === 0) return { targets: [], kept: [] };

  const dayIds = Array.from(new Set(labBlocks.map((b: any) => b.linked_lab_day_id).filter(Boolean)));
  const dayById = new Map<string, { date: string; cohort_id: string | null }>();
  for (let i = 0; i < dayIds.length; i += 100) {
    const { data, error } = await supabase.from('lab_days').select('id, date, cohort_id').in('id', dayIds.slice(i, i + 100));
    if (error) throw new Error(error.message);
    for (const d of data ?? []) dayById.set((d as any).id, { date: (d as any).date, cohort_id: (d as any).cohort_id ?? null });
  }

  // Each person's series mappings for these groups.
  const groupIds = Array.from(new Set(labBlocks.map((b: any) => b.recurring_group_id as string)));
  const mappings: { user_email: string; google_event_id: string; source_id: string }[] = [];
  for (let i = 0; i < groupIds.length; i += 100) {
    let q = supabase
      .from('google_calendar_events')
      .select('user_email, google_event_id, source_id')
      .eq('source_type', 'schedule_block_series')
      .in('source_id', groupIds.slice(i, i + 100));
    if (userEmail) q = q.ilike('user_email', userEmail);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    for (const m of data ?? []) mappings.push(m as any);
  }

  // Day-event guests keyed by cohort:date.
  const keys = Array.from(
    new Set(
      labBlocks
        .map((b: any) => {
          const day = b.linked_lab_day_id ? dayById.get(b.linked_lab_day_id) : undefined;
          return day && day.cohort_id && day.date === b.date ? `${day.cohort_id}:${day.date}` : null;
        })
        .filter((k): k is string => !!k),
    ),
  );
  const guest = new Set<string>();
  for (let i = 0; i < keys.length; i += 100) {
    const { data, error } = await supabase
      .from('google_calendar_events')
      .select('user_email, source_id')
      .eq('source_type', 'lab_day_event')
      .in('source_id', keys.slice(i, i + 100));
    if (error) throw new Error(`day-event guard read failed: ${error.message}`);
    for (const g of data ?? []) guest.add(`${String((g as any).user_email).toLowerCase()}|${(g as any).source_id}`);
  }

  const blocksByGroup = new Map<string, any[]>();
  for (const b of labBlocks) {
    const arr = blocksByGroup.get((b as any).recurring_group_id) ?? [];
    arr.push(b);
    blocksByGroup.set((b as any).recurring_group_id, arr);
  }

  const targets: Target[] = [];
  const kept: Kept[] = [];
  for (const m of mappings) {
    for (const b of blocksByGroup.get(m.source_id) ?? []) {
      const day = b.linked_lab_day_id ? dayById.get(b.linked_lab_day_id) : undefined;
      const base = { user_email: m.user_email, group_id: m.source_id, title: b.title ?? '', date: b.date };
      if (!day) {
        kept.push({ ...base, reason: 'kept: no linked lab day' });
      } else if (!day.cohort_id || day.date !== b.date) {
        kept.push({ ...base, reason: 'kept: linked lab day date does not match the block' });
      } else if (!guest.has(`${m.user_email.toLowerCase()}|${day.cohort_id}:${day.date}`)) {
        kept.push({ ...base, reason: 'kept: not a guest on the day event yet' });
      } else {
        targets.push({ ...base, google_event_id: m.google_event_id, block_id: b.id });
      }
    }
  }
  targets.sort((a, b) => a.date.localeCompare(b.date) || a.user_email.localeCompare(b.user_email));
  return { targets, kept };
}

export async function GET() {
  const auth = await requireAuth('superadmin');
  if (auth instanceof NextResponse) return auth;
  try {
    const { targets, kept } = await loadTargets();
    const byUser: Record<string, number> = {};
    const byGroup: Record<string, number> = {};
    for (const t of targets) {
      byUser[t.user_email.toLowerCase()] = (byUser[t.user_email.toLowerCase()] ?? 0) + 1;
      byGroup[t.group_id] = (byGroup[t.group_id] ?? 0) + 1;
    }
    return NextResponse.json({
      success: true,
      today: todayPacific(),
      total: targets.length,
      series_affected: Object.keys(byGroup).length,
      by_user: byUser,
      by_group: byGroup,
      kept_count: kept.length,
      kept,
      rows: targets.map((t) => ({ user: t.user_email, group: t.group_id, title: t.title, date: t.date })),
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth('superadmin');
  if (auth instanceof NextResponse) return auth;

  let body: { confirm?: boolean; user_email?: string; limit?: number } = {};
  try {
    body = await request.json();
  } catch {
    /* empty */
  }
  if (body.confirm !== true) {
    return NextResponse.json({ success: false, error: 'confirm:true required (use GET for the dry run)' }, { status: 400 });
  }

  try {
    const { targets } = await loadTargets(body.user_email);
    const limit = body.limit && body.limit > 0 ? body.limit : targets.length;
    const batch = targets.slice(0, limit);
    const tokens = new Map<string, string | null>();
    let cancelled = 0;
    let alreadyGone = 0;
    const skipped: { user: string; date: string; reason: string }[] = [];
    const failures: { user: string; date: string; error: string }[] = [];

    for (const t of batch) {
      const email = t.user_email.toLowerCase();
      if (!tokens.has(email)) tokens.set(email, await getAccessTokenForUser(t.user_email));
      const token = tokens.get(email);
      if (!token) {
        failures.push({ user: t.user_email, date: t.date, error: 'no access token (left in place)' });
        continue;
      }
      try {
        const params = new URLSearchParams({
          timeMin: `${addDays(t.date, -1)}T00:00:00Z`,
          timeMax: `${addDays(t.date, 2)}T00:00:00Z`,
          maxResults: '10',
        });
        const res = await fetch(`${GOOGLE}/calendars/primary/events/${encodeURIComponent(t.google_event_id)}/instances?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 404 || res.status === 410) {
          alreadyGone++;
          continue;
        }
        if (!res.ok) {
          failures.push({ user: t.user_email, date: t.date, error: `instances lookup ${res.status} (left in place)` });
          continue;
        }
        const json = await res.json();
        const inst = (json.items ?? []).find(
          (i: any) => i.status !== 'cancelled' && String(i.start?.dateTime ?? i.start?.date ?? '').startsWith(t.date),
        );
        if (!inst) {
          alreadyGone++;
          continue;
        }
        if (!inst.recurringEventId || inst.id === t.google_event_id) {
          skipped.push({ user: t.user_email, date: t.date, reason: 'not a recurring instance, left in place' });
          continue;
        }
        // Restore point first: the full instance goes into audit_log before it is cancelled.
        await logAuditEvent({
          user: { id: auth.user?.id, email: auth.user?.email, role: 'superadmin' },
          action: 'delete',
          resourceType: 'calendar_sync',
          resourceId: t.block_id,
          resourceDescription: `CAL 2/3d B: cancel lab-block instance ${t.date} for ${t.user_email} (day event replaces it)`,
          metadata: { kind: 'retire-lab-blocks', series_event_id: t.google_event_id, group_id: t.group_id, instance: inst },
        });
        const del = await fetch(`${GOOGLE}/calendars/primary/events/${encodeURIComponent(inst.id)}?sendUpdates=none`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (del.ok || del.status === 404 || del.status === 410) cancelled++;
        else failures.push({ user: t.user_email, date: t.date, error: `cancel ${del.status} (left in place)` });
      } catch (e: any) {
        failures.push({ user: t.user_email, date: t.date, error: e.message });
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    return NextResponse.json({
      success: true,
      attempted: batch.length,
      cancelled,
      already_gone: alreadyGone,
      skipped,
      failed: failures.length,
      failures,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
