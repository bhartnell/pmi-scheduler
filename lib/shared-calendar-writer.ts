/**
 * Identity that writes the shared "Pima EMS Programs Schedule" calendar.
 *
 * Every shared-calendar write for day-level lab events (route, cron, membership
 * re-plans) uses the ONE configured writer's token, no matter who triggered the
 * change. A part-timer signing up never uses the part-timer's token, and a
 * missing/expired writer token never falls back to another user's token.
 *
 * Setting: system_settings key `system.shared_calendar_writer` (email). Unset
 * means the calendar owner, the connection the class and PALS-day events on
 * that calendar are already written with.
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { getAccessTokenForUser } from '@/lib/google-calendar';

export const SHARED_CALENDAR_WRITER_KEY = 'system.shared_calendar_writer';
export const DEFAULT_SHARED_CALENDAR_WRITER = 'bhartnell@pmi.edu';

export async function getSharedCalendarWriterEmail(): Promise<string> {
  const { data } = await getSupabaseAdmin()
    .from('system_settings')
    .select('value')
    .eq('key', SHARED_CALENDAR_WRITER_KEY)
    .maybeSingle();
  const v = (data?.value ?? '').trim().toLowerCase();
  return v || DEFAULT_SHARED_CALENDAR_WRITER;
}

export type SharedCalendarWriter =
  | { ok: true; email: string; calendarId: string; accessToken: string }
  | { ok: false; reason: 'no_shared_calendar' | 'writer_not_connected'; email: string };

export async function getSharedCalendarWriter(): Promise<SharedCalendarWriter> {
  const email = await getSharedCalendarWriterEmail();
  const calendarId = process.env.SHARED_CALENDAR_ID ?? '';
  if (!calendarId) return { ok: false, reason: 'no_shared_calendar', email };
  const accessToken = await getAccessTokenForUser(email);
  if (!accessToken) return { ok: false, reason: 'writer_not_connected', email };
  return { ok: true, email, calendarId, accessToken };
}
