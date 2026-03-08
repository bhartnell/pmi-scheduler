import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  getAccessTokenForUser,
  getEventMapping,
  storeEventMapping,
  deleteEventMapping,
} from '@/lib/google-calendar';

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  let usersProcessed = 0;
  let eventsCreated = 0;
  let eventsUpdated = 0;
  let eventsDeleted = 0;
  let eventsVerified = 0;
  let failures = 0;
  const errorDetails: Array<{ email: string; error: string }> = [];

  try {
    // Get connected users with events scope (max 50 per run)
    const { data: connectedUsers } = await supabase
      .from('lab_users')
      .select('email')
      .eq('google_calendar_connected', true)
      .eq('google_calendar_scope', 'events')
      .limit(50);

    if (!connectedUsers?.length) {
      await logSyncRun(supabase, {
        run_type: 'cron',
        users_processed: 0,
        duration_ms: Date.now() - startTime,
      });
      return NextResponse.json({ success: true, message: 'No connected users to process' });
    }

    for (const user of connectedUsers) {
      try {
        usersProcessed++;

        const accessToken = await getAccessTokenForUser(user.email);
        if (!accessToken) {
          failures++;
          errorDetails.push({ email: user.email, error: 'Token refresh failed' });
          continue;
        }

        // Get all mappings for this user
        const { data: mappings } = await supabase
          .from('google_calendar_events')
          .select('*')
          .ilike('user_email', user.email);

        if (!mappings?.length) continue;

        for (const mapping of mappings) {
          // Rate limit: 200ms between Google API calls
          await new Promise((r) => setTimeout(r, 200));

          try {
            // Verify event still exists on Google Calendar
            const verifyRes = await fetch(
              `${GOOGLE_CALENDAR_API}/calendars/primary/events/${mapping.google_event_id}`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            if (verifyRes.status === 404 || verifyRes.status === 410) {
              // Event was deleted from Google Calendar
              const sourceExists = await checkSourceExists(supabase, mapping);
              if (!sourceExists) {
                // Source also deleted — clean up mapping
                await deleteEventMapping(mapping.user_email, mapping.source_type, mapping.source_id);
                eventsDeleted++;
              } else {
                // Source still exists but Google event gone — leave mapping for now
                // (will be recreated on next user action)
                eventsDeleted++;
                await supabase
                  .from('google_calendar_events')
                  .delete()
                  .eq('id', mapping.id);
              }
            } else if (verifyRes.ok) {
              eventsVerified++;
            } else {
              failures++;
            }
          } catch {
            failures++;
          }
        }
      } catch (userError) {
        failures++;
        errorDetails.push({ email: user.email, error: String(userError) });
      }
    }
  } catch (err) {
    console.error('[cron/calendar-sync] Fatal error:', err);
    failures++;
  }

  const durationMs = Date.now() - startTime;

  await logSyncRun(supabase, {
    run_type: 'cron',
    users_processed: usersProcessed,
    events_created: eventsCreated,
    events_updated: eventsUpdated,
    events_deleted: eventsDeleted,
    events_verified: eventsVerified,
    failures,
    duration_ms: durationMs,
    error_details: errorDetails,
  });

  return NextResponse.json({
    success: true,
    users_processed: usersProcessed,
    events_created: eventsCreated,
    events_updated: eventsUpdated,
    events_deleted: eventsDeleted,
    events_verified: eventsVerified,
    failures,
    duration_ms: durationMs,
  });
}

async function checkSourceExists(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  mapping: any
): Promise<boolean> {
  try {
    const tableMap: Record<string, string> = {
      station_assignment: 'station_instructors',
      lab_day_role: 'lab_day_roles',
      shift_signup: 'shift_signups',
      site_visit: 'clinical_site_visits',
    };

    const tableName = tableMap[mapping.source_type];
    if (!tableName) return false;

    const { data } = await supabase
      .from(tableName)
      .select('id')
      .eq('id', mapping.source_id)
      .maybeSingle();

    return !!data;
  } catch {
    return false;
  }
}

async function logSyncRun(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  logData: Record<string, any>
): Promise<void> {
  try {
    await supabase.from('calendar_sync_log').insert(logData);
  } catch (err) {
    console.error('[cron/calendar-sync] Failed to log sync run:', err);
  }
}
