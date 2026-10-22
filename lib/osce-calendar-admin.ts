/**
 * OSCE calendar admin actions (OSCE CAL 4/4): per-event "create block events"
 * and "send pending invites", plus the status read model for the admin panel.
 *
 * (OSCE CAL 5 adds the automatic per-block create/update/cancel used by the
 * block routes; the button stays as the repair action.)
 *
 * Both actions reuse the 1/4 and 2/4 code paths (createOsceBlockEvent,
 * inviteObserverToBlocks); there is no second implementation. They are only
 * ever called from an admin route when an admin presses the button, are
 * idempotent (blocks with an event id and rows already stamped are skipped),
 * keyed on the event id (any OSCE event, not Fall 2026), and never retry in
 * a loop or delete anything.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  OSCE_CAL_HOST_EMAIL, addOsceGuest, cancelOsceBlockEvent, createOsceBlockEvent, osceEventLabel, registrantState,
  updateOsceBlockEvent, type OsceCalEvent,
} from '@/lib/osce-calendar';
import { inviteObserverToBlocks } from '@/lib/osce-invites';

export interface BlockEventOutcome {
  block_id: string;
  label: string;
  status: 'created' | 'updated' | 'cancelled' | 'gone' | 'exists' | 'linked_other' | 'error';
  error?: string;
}

interface EventRow { title: string; subtitle: string | null; slug: string; location: string | null }
interface BlockRow { id: string; label: string; date: string; start_time: string; end_time: string; google_event_id: string | null; calendar_error?: string | null }

function toCalEvent(e: EventRow): OsceCalEvent {
  return { slug: e.slug, label: osceEventLabel(e), location: e.location };
}

async function loadEvent(supabase: SupabaseClient, eventId: string) {
  const { data: event, error } = await supabase
    .from('osce_events')
    .select('title, subtitle, slug, location')
    .eq('id', eventId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!event) return null;
  const { data: blocks, error: bErr } = await supabase
    .from('osce_time_blocks')
    .select('id, label, date, start_time, end_time, google_event_id, calendar_error')
    .eq('event_id', eventId)
    .order('sort_order');
  if (bErr) throw new Error(bErr.message);
  return { event: event as EventRow, blocks: (blocks ?? []) as BlockRow[] };
}

/** Block ids that already have an event from the older admin invite route (google_calendar_events mapping). */
async function legacyMappedBlocks(supabase: SupabaseClient, blockIds: string[]): Promise<Set<string>> {
  if (blockIds.length === 0) return new Set();
  const { data } = await supabase
    .from('google_calendar_events')
    .select('source_id')
    .eq('source_type', 'osce_block')
    .in('source_id', blockIds);
  return new Set((data ?? []).map((r: { source_id: string }) => r.source_id));
}


/** Record (or clear, with null) the last automatic calendar failure on the block. Never throws. */
async function setBlockError(supabase: SupabaseClient, blockId: string, message: string | null) {
  const { error } = await supabase.from('osce_time_blocks').update({ calendar_error: message }).eq('id', blockId);
  if (error) console.error('[osce-calendar-admin] could not record calendar_error on block', blockId, error.message);
}

/**
 * Create the host-calendar event for every block of the event that has none.
 * Blocks with a google_event_id are reported as 'exists'; blocks the older
 * invite route already mapped are 'linked_other' and are left alone so the
 * two paths never produce a second event.
 */
export async function createPendingBlockEvents(
  supabase: SupabaseClient,
  opts: {
    eventId: string; accessToken: string; baseUrl: string; fetchImpl?: typeof fetch;
    /** Only these blocks (automatic sync on create/edit); default is every block of the event. */
    blockIds?: string[];
    /** Added as a guest on each newly created event so it lands on their calendar (skipped when it is the host). */
    creatorEmail?: string | null;
  },
): Promise<BlockEventOutcome[] | null> {
  const loaded = await loadEvent(supabase, opts.eventId);
  if (!loaded) return null;
  if (opts.blockIds) loaded.blocks = loaded.blocks.filter((b) => opts.blockIds!.includes(b.id));
  const calEvent = toCalEvent(loaded.event);
  const legacy = await legacyMappedBlocks(supabase, loaded.blocks.map((b) => b.id));
  const out: BlockEventOutcome[] = [];

  for (const block of loaded.blocks) {
    if (block.google_event_id) { out.push({ block_id: block.id, label: block.label, status: 'exists' }); continue; }
    if (legacy.has(block.id)) { out.push({ block_id: block.id, label: block.label, status: 'linked_other' }); continue; }

    const res = await createOsceBlockEvent({
      accessToken: opts.accessToken, event: calEvent, block, baseUrl: opts.baseUrl, fetchImpl: opts.fetchImpl,
    });
    if (res.status === 'error') {
      await setBlockError(supabase, block.id, res.error);
      out.push({ block_id: block.id, label: block.label, status: 'error', error: res.error });
      continue;
    }
    if (res.status === 'exists') { out.push({ block_id: block.id, label: block.label, status: 'exists' }); continue; }

    // Guarded write: only fills an empty id, so a concurrent press cannot overwrite a stored one.
    const { error } = await supabase
      .from('osce_time_blocks')
      .update({ google_event_id: res.eventId })
      .eq('id', block.id)
      .is('google_event_id', null);
    if (error) {
      // The calendar event exists but its id was not stored: say so with the id so it can be linked by hand.
      out.push({ block_id: block.id, label: block.label, status: 'error', error: `Event created (${res.eventId}) but id not saved: ${error.message}` });
      continue;
    }
    let guestNote: string | null = null;
    const creator = opts.creatorEmail?.trim();
    if (creator && creator.toLowerCase() !== OSCE_CAL_HOST_EMAIL.toLowerCase()) {
      const g = await addOsceGuest({ accessToken: opts.accessToken, eventId: res.eventId, email: creator, fetchImpl: opts.fetchImpl });
      if (g.status === 'error') guestNote = `Event created, but ${creator} was not added as a guest: ${g.error}`;
    }
    await setBlockError(supabase, block.id, guestNote);
    out.push(guestNote ? { block_id: block.id, label: block.label, status: 'created', error: guestNote } : { block_id: block.id, label: block.label, status: 'created' });
  }
  return out;
}

// ─── Automatic sync from the block routes (OSCE CAL 5) ───────────────

export interface AutoSyncOpts {
  eventId: string;
  getToken: () => Promise<string | null>;
  baseUrl: string;
  /** The admin making the change; added as a guest on newly created events. */
  creatorEmail?: string | null;
  fetchImpl?: typeof fetch;
}

const NO_TOKEN = `The calendar connection for ${OSCE_CAL_HOST_EMAIL} is missing or lacks write access. Reconnect it in Settings, then press Create calendar events.`;

/**
 * After blocks are created or edited: create the event for any of these blocks
 * that has none, or update title/time/location of the ones that do. Idempotent
 * on osce_time_blocks.google_event_id. Never throws and never blocks the block
 * write itself: failures are stored on the block (calendar_error) and returned.
 */
export async function syncBlocksToCalendar(supabase: SupabaseClient, blockIds: string[], opts: AutoSyncOpts): Promise<BlockEventOutcome[]> {
  try {
    const loaded = await loadEvent(supabase, opts.eventId);
    if (!loaded) return [];
    const blocks = loaded.blocks.filter((b) => blockIds.includes(b.id));
    if (blocks.length === 0) return [];
    const accessToken = await opts.getToken();
    if (!accessToken) {
      for (const b of blocks) await setBlockError(supabase, b.id, NO_TOKEN);
      return blocks.map((b) => ({ block_id: b.id, label: b.label, status: 'error' as const, error: NO_TOKEN }));
    }
    const out: BlockEventOutcome[] = [];
    const needCreate = blocks.filter((b) => !b.google_event_id).map((b) => b.id);
    if (needCreate.length > 0) {
      const created = await createPendingBlockEvents(supabase, {
        eventId: opts.eventId, accessToken, baseUrl: opts.baseUrl, fetchImpl: opts.fetchImpl,
        blockIds: needCreate, creatorEmail: opts.creatorEmail,
      });
      out.push(...(created ?? []));
    }
    const calEvent = toCalEvent(loaded.event);
    for (const block of blocks.filter((b) => b.google_event_id)) {
      const res = await updateOsceBlockEvent({
        accessToken, eventId: block.google_event_id!, event: calEvent, block, baseUrl: opts.baseUrl, fetchImpl: opts.fetchImpl,
      });
      if (res.status === 'error') {
        await setBlockError(supabase, block.id, res.error);
        out.push({ block_id: block.id, label: block.label, status: 'error', error: res.error });
      } else if (res.status === 'gone') {
        const msg = 'The calendar event was removed on the calendar side. It was not re-created automatically.';
        await setBlockError(supabase, block.id, msg);
        out.push({ block_id: block.id, label: block.label, status: 'gone', error: msg });
      } else {
        await setBlockError(supabase, block.id, null);
        out.push({ block_id: block.id, label: block.label, status: 'updated' });
      }
    }
    return out;
  } catch (err) {
    console.error('[osce-calendar-admin] syncBlocksToCalendar failed:', err);
    return [];
  }
}

export type BlockCancelOutcome =
  | { ok: true; status: 'no_event' | 'cancelled' | 'gone' }
  | { ok: false; error: string };

/**
 * Before a block is deleted: cancel its event on the host calendar. A block
 * with no event of its own (or only an older-invite mapping) needs nothing.
 * On any failure the caller must NOT delete the block (log and abort, the
 * admin can retry or force); the error is stored on the block. Never throws.
 */
export async function cancelBlockCalendarEvent(
  supabase: SupabaseClient,
  opts: { eventId: string; blockId: string; getToken: () => Promise<string | null>; fetchImpl?: typeof fetch },
): Promise<BlockCancelOutcome> {
  try {
    const { data, error } = await supabase
      .from('osce_time_blocks').select('google_event_id').eq('id', opts.blockId).eq('event_id', opts.eventId).maybeSingle();
    if (error) return { ok: false, error: error.message };
    const eventId = data?.google_event_id as string | null | undefined;
    if (!eventId) return { ok: true, status: 'no_event' };
    const accessToken = await opts.getToken();
    if (!accessToken) { await setBlockError(supabase, opts.blockId, NO_TOKEN); return { ok: false, error: NO_TOKEN }; }
    const res = await cancelOsceBlockEvent({ accessToken, eventId, fetchImpl: opts.fetchImpl });
    if (res.status === 'error') { await setBlockError(supabase, opts.blockId, res.error); return { ok: false, error: res.error }; }
    return { ok: true, status: res.status === 'gone' ? 'gone' : 'cancelled' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unexpected error' };
  }
}

export interface InviteSummary { observers: number; rows_pending: number; }

/**
 * For every registrant on the event with unstamped block rows, run the same
 * invite function signup uses. Rows already stamped are skipped by that
 * function; rows whose block has no event yet record "no calendar event"
 * on the row. Never throws.
 */
export async function sendPendingInvites(
  supabase: SupabaseClient,
  opts: { eventId: string; getToken: () => Promise<string | null>; fetchImpl?: typeof fetch },
): Promise<InviteSummary> {
  const { data, error } = await supabase
    .from('osce_observer_blocks')
    .select('observer_id, osce_observers!inner(event_id)')
    .eq('osce_observers.event_id', opts.eventId)
    .is('calendar_invite_sent_at', null);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { observer_id: string }[];
  const observerIds = [...new Set(rows.map((r) => r.observer_id))];

  // One token refresh for the whole run.
  let tokenPromise: Promise<string | null> | null = null;
  const getToken = () => (tokenPromise ??= opts.getToken());

  for (const observerId of observerIds) {
    await inviteObserverToBlocks(supabase, { observerId, getToken, fetchImpl: opts.fetchImpl });
  }
  return { observers: observerIds.length, rows_pending: rows.length };
}

// ─── Status read model ───────────────────────────────────────────────

export interface OsceCalendarStatus {
  blocks: { id: string; label: string; date: string; linked: boolean; source: 'event' | 'older_invite' | null; calendar_error: string | null }[];
  registrants: {
    observer_id: string;
    name: string;
    blocks: { block_id: string; block_label: string; state: 'sent' | 'pending' | 'failed'; error: string | null }[];
  }[];
}

export async function getOsceCalendarStatus(supabase: SupabaseClient, eventId: string): Promise<OsceCalendarStatus | null> {
  const loaded = await loadEvent(supabase, eventId);
  if (!loaded) return null;
  const legacy = await legacyMappedBlocks(supabase, loaded.blocks.map((b) => b.id));
  const blocks = loaded.blocks.map((b) => ({
    id: b.id, label: b.label, date: b.date,
    linked: !!b.google_event_id || legacy.has(b.id),
    source: b.google_event_id ? ('event' as const) : legacy.has(b.id) ? ('older_invite' as const) : null,
    calendar_error: b.calendar_error ?? null,
  }));
  const labelOf = new Map(loaded.blocks.map((b) => [b.id, b.label]));

  const { data, error } = await supabase
    .from('osce_observer_blocks')
    .select('observer_id, block_id, calendar_invite_sent_at, calendar_invite_error, osce_observers!inner(id, name, event_id)')
    .eq('osce_observers.event_id', eventId);
  if (error) throw new Error(error.message);

  const byObserver = new Map<string, OsceCalendarStatus['registrants'][number]>();
  for (const r of (data ?? []) as unknown as {
    observer_id: string; block_id: string; calendar_invite_sent_at: string | null; calendar_invite_error: string | null;
    osce_observers: { name: string } | { name: string }[];
  }[]) {
    const obs = Array.isArray(r.osce_observers) ? r.osce_observers[0] : r.osce_observers;
    if (!byObserver.has(r.observer_id)) byObserver.set(r.observer_id, { observer_id: r.observer_id, name: obs?.name ?? '', blocks: [] });
    byObserver.get(r.observer_id)!.blocks.push({
      block_id: r.block_id, block_label: labelOf.get(r.block_id) ?? '', state: registrantState(r), error: r.calendar_invite_error,
    });
  }
  const registrants = [...byObserver.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { blocks, registrants };
}
