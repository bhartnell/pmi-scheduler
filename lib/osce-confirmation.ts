/**
 * OSCE evaluator signup confirmation (OSCE CAL 3/4): a short plain email sent
 * at signup, in addition to the Google Calendar invite. Uses the existing
 * Resend sender and its 'general' template. Best effort: a failure is logged
 * and never blocks or rolls back the signup. Never invents an address.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { buildOsceConfirmation } from '@/lib/osce-confirmation-text';

/** Send the confirmation for a just-created signup. Never throws. */
export async function sendOsceSignupConfirmation(
  supabase: SupabaseClient,
  opts: { observerId: string; blockIds: string[]; baseUrl: string; standbyBlockIds?: string[] },
): Promise<void> {
  try {
    const { data: obs } = await supabase
      .from('osce_observers')
      .select('name, email, contact_email, event_id')
      .eq('id', opts.observerId)
      .maybeSingle();
    const to = (obs?.contact_email || obs?.email || '').trim();
    if (!obs || !to) return;

    const [{ data: event }, { data: blocks }] = await Promise.all([
      supabase.from('osce_events').select('title, subtitle, slug').eq('id', obs.event_id).maybeSingle(),
      supabase.from('osce_time_blocks').select('id, label, date, start_time, end_time').in('id', opts.blockIds),
    ]);
    if (!event || !blocks || blocks.length === 0) return;

    const eventLabel = event.subtitle ? `${event.title}, ${event.subtitle}` : event.title;
    const c = buildOsceConfirmation({ name: obs.name, eventLabel, slug: event.slug, blocks: blocks.map((b) => ({ ...b, standby: (opts.standbyBlockIds ?? []).includes(b.id) })), baseUrl: opts.baseUrl });
    const res = await sendEmail({
      to,
      subject: c.subject,
      template: 'general',
      data: { subject: c.subject, title: c.title, message: c.message, actionUrl: c.actionUrl, actionText: c.actionText },
    });
    if (!res.success) console.error('[osce-confirmation] not sent:', res.error);
  } catch (err) {
    console.error('[osce-confirmation] failed:', err);
  }
}
