import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAccessTokenForUser } from '@/lib/google-calendar';

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const TIMEZONE = 'America/Phoenix';
const COLOR_OSCE = '5'; // Banana (yellow) for OSCE events

/**
 * POST - Admin: Send Google Calendar invites to observers
 *
 * For each time block (or specified blocks), creates ONE calendar event
 * on the admin's Google Calendar with all observers for that block as attendees.
 * Google automatically sends invite emails from the admin's @pmi.edu address.
 *
 * Body options:
 * - { action: 'send_all' } — Send invites for all blocks
 * - { action: 'send_blocks', block_ids: string[] } — Send for specific blocks
 * - { action: 'send_observer', observer_id: string } — Send/resend for one observer
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: eventId } = await params;
    const body = await request.json();
    const { action } = body;

    if (!action || !['send_all', 'send_blocks', 'send_observer'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Use send_all, send_blocks, or send_observer.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const adminEmail = auth.user.email;

    // Check admin's Google Calendar connection
    const accessToken = await getAccessTokenForUser(adminEmail);
    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Google Calendar not connected. Please connect your Google Calendar in Settings to send invites.',
          needs_calendar: true,
        },
        { status: 400 }
      );
    }

    // Get the event details
    const { data: event, error: eventError } = await supabase
      .from('osce_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Get all time blocks for this event
    const { data: allBlocks } = await supabase
      .from('osce_time_blocks')
      .select('*')
      .eq('event_id', eventId)
      .order('sort_order');

    if (!allBlocks || allBlocks.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No time blocks found for this event' },
        { status: 400 }
      );
    }

    // Determine which blocks to process
    let targetBlockIds: string[];
    if (action === 'send_all') {
      targetBlockIds = allBlocks.map((b) => b.id);
    } else if (action === 'send_blocks') {
      targetBlockIds = body.block_ids || [];
      if (!Array.isArray(targetBlockIds) || targetBlockIds.length === 0) {
        return NextResponse.json(
          { success: false, error: 'block_ids array is required for send_blocks action' },
          { status: 400 }
        );
      }
    } else {
      // send_observer — find which blocks this observer is in
      const observerId = body.observer_id;
      if (!observerId) {
        return NextResponse.json(
          { success: false, error: 'observer_id is required for send_observer action' },
          { status: 400 }
        );
      }
      const { data: obsBlocks } = await supabase
        .from('osce_observer_blocks')
        .select('block_id')
        .eq('observer_id', observerId);
      targetBlockIds = (obsBlocks || []).map((ob) => ob.block_id);
    }

    const targetBlocks = allBlocks.filter((b) => targetBlockIds.includes(b.id));
    const results: Array<{ block_id: string; label: string; status: string; attendees_count?: number; error?: string }> = [];

    for (const block of targetBlocks) {
      try {
        // Get observers for this block
        const { data: observerBlocks } = await supabase
          .from('osce_observer_blocks')
          .select('observer_id, osce_observers(id, name, email)')
          .eq('block_id', block.id);

        if (!observerBlocks || observerBlocks.length === 0) {
          results.push({ block_id: block.id, label: block.label, status: 'skipped', attendees_count: 0 });
          continue;
        }

        // If send_observer, filter to just that observer
        let filteredBlocks = observerBlocks;
        if (action === 'send_observer') {
          filteredBlocks = observerBlocks.filter(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (ob) => (ob.osce_observers as any)?.id === body.observer_id
          );
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const attendees = filteredBlocks.map((ob) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const obs = ob.osce_observers as any;
          return { email: obs.email, displayName: obs.name };
        }).filter((a) => a.email);

        if (attendees.length === 0) {
          results.push({ block_id: block.id, label: block.label, status: 'skipped', attendees_count: 0 });
          continue;
        }

        // Build calendar event
        const startDateTime = `${block.date}T${block.start_time}:00`;
        const endDateTime = `${block.date}T${block.end_time}:00`;

        const calendarEvent = {
          summary: `PMI Clinical Capstone — ${block.label}`,
          description: [
            event.title,
            event.subtitle ? `${event.subtitle}` : '',
            '',
            event.description || '',
            '',
            event.location ? `Location: ${event.location}` : '',
            '',
            `Public signup page: ${process.env.NEXTAUTH_URL || 'https://pmitools.me'}/osce/${event.slug}`,
          ].filter(Boolean).join('\n'),
          location: event.location || '',
          start: { dateTime: startDateTime, timeZone: TIMEZONE },
          end: { dateTime: endDateTime, timeZone: TIMEZONE },
          colorId: COLOR_OSCE,
          attendees,
          reminders: { useDefault: true },
          guestsCanModify: false,
          guestsCanInviteOthers: false,
          sendUpdates: 'all', // Google sends invite emails automatically
        };

        // Check if a calendar event already exists for this block
        const { data: existingMapping } = await supabase
          .from('google_calendar_events')
          .select('google_event_id')
          .eq('source_type', 'osce_block')
          .eq('source_id', block.id)
          .single();

        let googleEventId: string | null = null;

        if (existingMapping?.google_event_id) {
          // Update existing event (add/update attendees)
          if (action === 'send_observer') {
            // PATCH: add the observer as attendee to existing event
            // First get the current event to preserve existing attendees
            const getRes = await fetch(
              `${GOOGLE_CALENDAR_API}/calendars/primary/events/${existingMapping.google_event_id}`,
              {
                headers: { Authorization: `Bearer ${accessToken}` },
              }
            );

            if (getRes.ok) {
              const existingEvent = await getRes.json();
              const existingAttendees = existingEvent.attendees || [];
              // Merge: add new attendees that aren't already there
              const existingEmails = new Set(existingAttendees.map((a: { email: string }) => a.email.toLowerCase()));
              const newAttendees = attendees.filter((a) => !existingEmails.has(a.email.toLowerCase()));
              const mergedAttendees = [...existingAttendees, ...newAttendees];

              const patchRes = await fetch(
                `${GOOGLE_CALENDAR_API}/calendars/primary/events/${existingMapping.google_event_id}?sendUpdates=all`,
                {
                  method: 'PATCH',
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ attendees: mergedAttendees }),
                }
              );

              if (patchRes.ok) {
                googleEventId = existingMapping.google_event_id;
              }
            }
          } else {
            // Full update: replace attendees with all observers for this block
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const allObserverAttendees = observerBlocks.map((ob) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const obs = ob.osce_observers as any;
              return { email: obs.email, displayName: obs.name };
            }).filter((a) => a.email);

            const patchRes = await fetch(
              `${GOOGLE_CALENDAR_API}/calendars/primary/events/${existingMapping.google_event_id}?sendUpdates=all`,
              {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  ...calendarEvent,
                  attendees: allObserverAttendees,
                }),
              }
            );

            if (patchRes.ok) {
              googleEventId = existingMapping.google_event_id;
            }
          }
        } else {
          // Create new calendar event
          // For send_observer or send_all/send_blocks, always include ALL block observers
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const allObserverAttendees = observerBlocks.map((ob) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const obs = ob.osce_observers as any;
            return { email: obs.email, displayName: obs.name };
          }).filter((a) => a.email);

          const createRes = await fetch(
            `${GOOGLE_CALENDAR_API}/calendars/primary/events?sendUpdates=all`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                ...calendarEvent,
                attendees: allObserverAttendees,
              }),
            }
          );

          if (createRes.ok) {
            const created = await createRes.json();
            googleEventId = created.id;

            // Store the mapping
            if (googleEventId) {
              await supabase.from('google_calendar_events').insert({
                user_email: adminEmail,
                google_event_id: googleEventId,
                source_type: 'osce_block',
                source_id: block.id,
                event_summary: calendarEvent.summary,
              });
            }
          } else {
            const errText = await createRes.text();
            console.error(`[osce-cal] Failed to create event for block ${block.id}:`, errText);
            results.push({ block_id: block.id, label: block.label, status: 'error', error: `Google API error: ${createRes.status}` });
            continue;
          }
        }

        // Mark observers as invited
        if (googleEventId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const invitedObserverIds = (action === 'send_observer'
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? filteredBlocks.map((ob) => (ob.osce_observers as any)?.id)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            : observerBlocks.map((ob) => (ob.osce_observers as any)?.id)
          ).filter(Boolean);

          for (const obsId of invitedObserverIds) {
            await supabase
              .from('osce_observer_blocks')
              .update({ calendar_invite_sent_at: new Date().toISOString() })
              .eq('observer_id', obsId)
              .eq('block_id', block.id);
          }

          results.push({
            block_id: block.id,
            label: block.label,
            status: 'sent',
            attendees_count: action === 'send_observer' ? filteredBlocks.length : observerBlocks.length,
          });
        }
      } catch (blockError) {
        console.error(`[osce-cal] Error processing block ${block.id}:`, blockError);
        results.push({ block_id: block.id, label: block.label, status: 'error', error: 'Internal error' });
      }
    }

    const sentCount = results.filter((r) => r.status === 'sent').length;
    const errorCount = results.filter((r) => r.status === 'error').length;

    return NextResponse.json({
      success: true,
      message: `Calendar invites sent for ${sentCount} block(s)${errorCount > 0 ? `, ${errorCount} error(s)` : ''}`,
      results,
    });
  } catch (error) {
    console.error('Error sending calendar invites:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Admin: get invite status for all observers in this event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: eventId } = await params;
    const supabase = getSupabaseAdmin();
    const adminEmail = auth.user.email;

    // Check admin's calendar connection
    const accessToken = await getAccessTokenForUser(adminEmail);
    const calendarConnected = !!accessToken;

    // Get invite status per observer-block
    const { data: observerBlocks } = await supabase
      .from('osce_observer_blocks')
      .select('observer_id, block_id, calendar_invite_sent_at, osce_observers!inner(event_id)')
      .eq('osce_observers.event_id', eventId);

    const inviteStatus: Record<string, Record<string, string | null>> = {};
    if (observerBlocks) {
      for (const ob of observerBlocks) {
        if (!inviteStatus[ob.observer_id]) {
          inviteStatus[ob.observer_id] = {};
        }
        inviteStatus[ob.observer_id][ob.block_id] = ob.calendar_invite_sent_at;
      }
    }

    // Get existing Google Calendar event IDs for blocks
    const { data: blocks } = await supabase
      .from('osce_time_blocks')
      .select('id')
      .eq('event_id', eventId);

    const blockIds = (blocks || []).map((b) => b.id);
    const { data: calendarMappings } = await supabase
      .from('google_calendar_events')
      .select('source_id, google_event_id')
      .eq('source_type', 'osce_block')
      .in('source_id', blockIds.length > 0 ? blockIds : ['__none__']);

    const blockCalendarIds: Record<string, string> = {};
    if (calendarMappings) {
      for (const m of calendarMappings) {
        blockCalendarIds[m.source_id] = m.google_event_id;
      }
    }

    return NextResponse.json({
      success: true,
      calendar_connected: calendarConnected,
      invite_status: inviteStatus,
      block_calendar_ids: blockCalendarIds,
    });
  } catch (error) {
    console.error('Error fetching invite status:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
