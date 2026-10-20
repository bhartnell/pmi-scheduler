/**
 * OSCE evaluator calendar invites, DB-aware layer (OSCE CAL 2/4).
 *
 * Signup adds the registrant as a guest on each chosen block's event and
 * stamps osce_observer_blocks.calendar_invite_sent_at; cancel removes the
 * guest and clears the stamp. Failures are recorded on the row
 * (calendar_invite_error), never retried in a loop, and never block the
 * signup/cancel itself. Nothing here deletes a registration or writes to any
 * calendar except the OSCE host's primary calendar.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getAccessTokenForUser } from '@/lib/google-calendar';
import { OSCE_CAL_HOST_EMAIL, addOsceGuest, removeOsceGuest } from '@/lib/osce-calendar';

interface Deps {
  getToken?: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
}

interface Row {
  id: string;
  block_id: string;
  calendar_invite_sent_at: string | null;
  osce_time_blocks: { google_event_id: string | null } | { google_event_id: string | null }[] | null;
}

const hostToken = () => getAccessTokenForUser(OSCE_CAL_HOST_EMAIL);

async function loadRows(supabase: SupabaseClient, observerId: string, blockIds?: string[]): Promise<Row[]> {
  let q = supabase
    .from('osce_observer_blocks')
    .select('id, block_id, calendar_invite_sent_at, osce_time_blocks(google_event_id)')
    .eq('observer_id', observerId);
  if (blockIds) q = q.in('block_id', blockIds);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Row[];
}

/** Block's event id: its own google_event_id first, else the older calendar-invites mapping, so the two never duplicate. */
async function resolveEventId(supabase: SupabaseClient, row: Row): Promise<string | null> {
  const tb = Array.isArray(row.osce_time_blocks) ? row.osce_time_blocks[0] : row.osce_time_blocks;
  if (tb?.google_event_id) return tb.google_event_id;
  const { data } = await supabase
    .from('google_calendar_events')
    .select('google_event_id')
    .eq('source_type', 'osce_block')
    .eq('source_id', row.block_id)
    .maybeSingle();
  return data?.google_event_id ?? null;
}

async function setRow(supabase: SupabaseClient, rowId: string, patch: { calendar_invite_sent_at?: string | null; calendar_invite_error?: string | null }) {
  const { error } = await supabase.from('osce_observer_blocks').update(patch).eq('id', rowId);
  if (error) console.error('[osce-invites] could not update signup row', rowId, error.message);
}

/** Invite a registrant to the given blocks (default: all of their blocks). Skips already-stamped rows. Never throws. */
export async function inviteObserverToBlocks(
  supabase: SupabaseClient,
  opts: { observerId: string; blockIds?: string[] } & Deps,
): Promise<void> {
  try {
    const { data: obs } = await supabase
      .from('osce_observers')
      .select('name, email, contact_email')
      .eq('id', opts.observerId)
      .maybeSingle();
    const email = (obs?.contact_email || obs?.email || '').trim();
    if (!obs || !email) return; // never invent an address

    const rows = (await loadRows(supabase, opts.observerId, opts.blockIds)).filter((r) => !r.calendar_invite_sent_at);
    if (rows.length === 0) return;

    const token = await (opts.getToken ?? hostToken)();
    if (!token) {
      for (const r of rows) await setRow(supabase, r.id, { calendar_invite_error: 'Calendar token unavailable; invite not sent' });
      return;
    }

    for (const r of rows) {
      const eventId = await resolveEventId(supabase, r);
      if (!eventId) {
        await setRow(supabase, r.id, { calendar_invite_error: 'No calendar event exists for this block yet; invite not sent' });
        continue;
      }
      const res = await addOsceGuest({ accessToken: token, eventId, email, displayName: obs.name, fetchImpl: opts.fetchImpl });
      if (res.status === 'error') await setRow(supabase, r.id, { calendar_invite_error: res.error });
      else await setRow(supabase, r.id, { calendar_invite_sent_at: new Date().toISOString(), calendar_invite_error: null });
    }
  } catch (err) {
    console.error('[osce-invites] invite failed:', err);
  }
}

/**
 * Remove a registrant as guest from the given blocks (default: all) and clear the stamp.
 * Call BEFORE the signup rows are deleted. Only stamped rows had an invite, so only those are touched.
 * Never throws and never deletes anything; a failure is recorded on the row (or logged if the row is about to go).
 */
export async function removeObserverFromBlocks(
  supabase: SupabaseClient,
  opts: { observerId: string; blockIds?: string[] } & Deps,
): Promise<void> {
  try {
    const { data: obs } = await supabase
      .from('osce_observers')
      .select('email, contact_email')
      .eq('id', opts.observerId)
      .maybeSingle();
    const email = (obs?.contact_email || obs?.email || '').trim();
    if (!obs || !email) return;

    const rows = (await loadRows(supabase, opts.observerId, opts.blockIds)).filter((r) => r.calendar_invite_sent_at);
    if (rows.length === 0) return;

    const token = await (opts.getToken ?? hostToken)();
    if (!token) {
      console.error('[osce-invites] calendar token unavailable; guest not removed for observer', opts.observerId);
      for (const r of rows) await setRow(supabase, r.id, { calendar_invite_error: 'Calendar token unavailable; guest not removed' });
      return;
    }

    for (const r of rows) {
      const eventId = await resolveEventId(supabase, r);
      if (!eventId) {
        await setRow(supabase, r.id, { calendar_invite_sent_at: null });
        continue;
      }
      const res = await removeOsceGuest({ accessToken: token, eventId, email, fetchImpl: opts.fetchImpl });
      if (res.status === 'error') {
        console.error('[osce-invites] guest not removed:', res.error);
        await setRow(supabase, r.id, { calendar_invite_error: res.error });
      } else {
        await setRow(supabase, r.id, { calendar_invite_sent_at: null, calendar_invite_error: null });
      }
    }
  } catch (err) {
    console.error('[osce-invites] remove failed:', err);
  }
}
