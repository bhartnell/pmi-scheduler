/**
 * Google Calendar Event Sync Library
 *
 * Core library for creating, updating, and deleting Google Calendar events
 * for lab assignments, lab day roles, and shift signups.
 *
 * All high-level functions are fire-and-forget (never throw).
 * Calendar sync is best-effort — failures never block primary operations.
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { refreshAccessToken } from '@/lib/calendar-availability';

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const TIMEZONE = 'America/Phoenix';

// Google Calendar color IDs
const COLOR_LAB_STATION = '9';   // Blueberry
const COLOR_LAB_ROLE = '7';      // Peacock
const COLOR_SHIFT = '1';         // Lavender
const COLOR_SITE_VISIT = '10';   // Basil (green)
const COLOR_COVERAGE = '11';     // Tomato (red)

// ─── Token & Preferences ─────────────────────────────────────────────

/**
 * Get a valid Google access token for a user.
 * Returns null if user not connected, scope insufficient, or refresh fails.
 * On 401/invalid_grant, clears the connection in DB.
 */
export async function getAccessTokenForUser(email: string): Promise<string | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: user } = await supabase
      .from('lab_users')
      .select('google_refresh_token, google_calendar_connected, google_calendar_scope')
      .ilike('email', email)
      .single();

    if (!user?.google_calendar_connected || !user?.google_refresh_token) {
      return null;
    }

    // Require 'events' scope for calendar write operations
    if (user.google_calendar_scope !== 'events') {
      return null;
    }

    const accessToken = await refreshAccessToken(user.google_refresh_token);

    if (!accessToken) {
      // Token refresh failed — likely revoked. Clear connection.
      await supabase
        .from('lab_users')
        .update({
          google_calendar_connected: false,
          google_refresh_token: null,
          google_calendar_scope: 'freebusy',
        })
        .ilike('email', email);
      return null;
    }

    return accessToken;
  } catch (err) {
    console.error(`[gcal] Error getting access token for ${email}:`, err);
    return null;
  }
}

type SyncType = 'sync_lab_assignments' | 'sync_lab_roles' | 'sync_shifts' | 'sync_site_visits';

/**
 * Check if calendar sync is enabled for a specific sync type.
 * Default: enabled (opt-out model).
 */
export async function shouldSyncForUser(email: string, syncType: SyncType): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('user_preferences')
      .select('preferences')
      .ilike('user_email', email)
      .single();

    if (!data?.preferences?.calendar_sync) {
      return true; // Default: enabled
    }

    const setting = data.preferences.calendar_sync[syncType];
    return setting !== false; // Explicitly false = disabled, anything else = enabled
  } catch {
    return true; // Default: enabled on error
  }
}

// ─── Google Calendar API Primitives ──────────────────────────────────

interface CalendarEventParams {
  summary: string;
  description?: string;
  startDateTime: string; // ISO 8601
  endDateTime: string;   // ISO 8601
  colorId?: string;
}

/**
 * Create a Google Calendar event. Returns the event ID or null.
 */
export async function createGoogleEvent(
  accessToken: string,
  params: CalendarEventParams
): Promise<string | null> {
  try {
    const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: params.summary,
        description: params.description || '',
        start: { dateTime: params.startDateTime, timeZone: TIMEZONE },
        end: { dateTime: params.endDateTime, timeZone: TIMEZONE },
        colorId: params.colorId,
        reminders: { useDefault: true },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[gcal] Create event failed (${response.status}):`, errorText);
      return null;
    }

    const data = await response.json();
    return data.id || null;
  } catch (err) {
    console.error('[gcal] Error creating event:', err);
    return null;
  }
}

/**
 * Update an existing Google Calendar event. Returns true on success.
 */
export async function updateGoogleEvent(
  accessToken: string,
  eventId: string,
  params: Partial<CalendarEventParams>
): Promise<boolean> {
  try {
    const body: Record<string, unknown> = {};
    if (params.summary) body.summary = params.summary;
    if (params.description !== undefined) body.description = params.description;
    if (params.startDateTime) body.start = { dateTime: params.startDateTime, timeZone: TIMEZONE };
    if (params.endDateTime) body.end = { dateTime: params.endDateTime, timeZone: TIMEZONE };
    if (params.colorId) body.colorId = params.colorId;

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[gcal] Update event failed (${response.status}):`, errorText);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[gcal] Error updating event:', err);
    return false;
  }
}

/**
 * Delete a Google Calendar event. Returns true on success.
 * Treats 404 (already deleted) as success.
 */
export async function deleteGoogleEvent(
  accessToken: string,
  eventId: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (response.status === 404 || response.status === 410) {
      // Already deleted — treat as success
      return true;
    }

    if (!response.ok) {
      console.error(`[gcal] Delete event failed (${response.status})`);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[gcal] Error deleting event:', err);
    return false;
  }
}

// ─── Mapping Table CRUD ──────────────────────────────────────────────

interface EventMapping {
  id: string;
  user_email: string;
  google_event_id: string;
  source_type: string;
  source_id: string;
  lab_day_id?: string;
  shift_id?: string;
  event_summary?: string;
}

export async function storeEventMapping(mapping: {
  user_email: string;
  google_event_id: string;
  source_type: string;
  source_id: string;
  lab_day_id?: string;
  shift_id?: string;
  event_summary?: string;
}): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('google_calendar_events')
      .upsert(mapping, { onConflict: 'user_email,source_type,source_id' });

    if (error) {
      console.error('[gcal] Error storing event mapping:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[gcal] Error storing event mapping:', err);
    return false;
  }
}

export async function getEventMapping(
  userEmail: string,
  sourceType: string,
  sourceId: string
): Promise<EventMapping | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('google_calendar_events')
      .select('*')
      .ilike('user_email', userEmail)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .single();

    return data || null;
  } catch {
    return null;
  }
}

export async function deleteEventMapping(
  userEmail: string,
  sourceType: string,
  sourceId: string
): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('google_calendar_events')
      .delete()
      .ilike('user_email', userEmail)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId);

    return !error;
  } catch {
    return false;
  }
}

export async function getEventMappingsByLabDay(labDayId: string): Promise<EventMapping[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('google_calendar_events')
      .select('*')
      .eq('lab_day_id', labDayId);

    return data || [];
  } catch {
    return [];
  }
}

export async function getEventMappingsByShift(shiftId: string): Promise<EventMapping[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('google_calendar_events')
      .select('*')
      .eq('shift_id', shiftId);

    return data || [];
  } catch {
    return [];
  }
}

// ─── Helper: Build datetime strings ──────────────────────────────────

function buildDateTimes(
  date: string,
  startTime?: string,
  endTime?: string
): { startDateTime: string; endDateTime: string } {
  const start = startTime || '08:00';
  const end = endTime || '17:00';
  return {
    startDateTime: `${date}T${start}:00`,
    endDateTime: `${date}T${end}:00`,
  };
}

// ─── High-Level Sync Functions ───────────────────────────────────────

// --- Lab Station Assignments ---

interface StationAssignmentParams {
  userEmail: string;
  stationId: string;
  stationNumber: number;
  labDayId: string;
  labDayTitle: string;
  labDayDate: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  scenarioTitle?: string;
}

/**
 * Create a Google Calendar event for a station assignment.
 */
export async function syncLabStationAssignment(params: StationAssignmentParams): Promise<void> {
  try {
    if (!(await shouldSyncForUser(params.userEmail, 'sync_lab_assignments'))) return;

    const accessToken = await getAccessTokenForUser(params.userEmail);
    if (!accessToken) return;

    const { startDateTime, endDateTime } = buildDateTimes(
      params.labDayDate,
      params.startTime,
      params.endTime
    );

    const summary = `PMI Lab: ${params.labDayTitle} — Stn ${params.stationNumber}`;
    const descParts = [`Station ${params.stationNumber}`];
    if (params.scenarioTitle) descParts.push(`Scenario: ${params.scenarioTitle}`);
    if (params.location) descParts.push(`Location: ${params.location}`);
    descParts.push('', 'Created by PMI EMS Scheduler');

    const eventId = await createGoogleEvent(accessToken, {
      summary,
      description: descParts.join('\n'),
      startDateTime,
      endDateTime,
      colorId: COLOR_LAB_STATION,
    });

    if (eventId) {
      await storeEventMapping({
        user_email: params.userEmail,
        google_event_id: eventId,
        source_type: 'station_assignment',
        source_id: params.stationId,
        lab_day_id: params.labDayId,
        event_summary: summary,
      });
    }
  } catch (err) {
    console.error('[gcal] Error syncing station assignment:', err);
  }
}

/**
 * Remove a Google Calendar event for a station assignment.
 */
export async function removeLabStationAssignment(params: {
  userEmail: string;
  stationId: string;
}): Promise<void> {
  try {
    const mapping = await getEventMapping(
      params.userEmail,
      'station_assignment',
      params.stationId
    );
    if (!mapping) return;

    const accessToken = await getAccessTokenForUser(params.userEmail);
    if (accessToken) {
      await deleteGoogleEvent(accessToken, mapping.google_event_id);
    }

    await deleteEventMapping(params.userEmail, 'station_assignment', params.stationId);
  } catch (err) {
    console.error('[gcal] Error removing station assignment:', err);
  }
}

// --- Lab Day Roles ---

interface LabDayRoleParams {
  userEmail: string;
  roleId: string;
  roleName: string; // 'Lab Lead', 'Roamer', 'Observer'
  labDayId: string;
  labDayTitle: string;
  labDayDate: string;
  startTime?: string;
  endTime?: string;
  location?: string;
}

/**
 * Create a Google Calendar event for a lab day role (lead, roamer, observer).
 */
export async function syncLabDayRole(params: LabDayRoleParams): Promise<void> {
  try {
    if (!(await shouldSyncForUser(params.userEmail, 'sync_lab_roles'))) return;

    const accessToken = await getAccessTokenForUser(params.userEmail);
    if (!accessToken) return;

    const { startDateTime, endDateTime } = buildDateTimes(
      params.labDayDate,
      params.startTime,
      params.endTime
    );

    const summary = `PMI Lab: ${params.labDayTitle} — ${params.roleName}`;
    const descParts = [`Role: ${params.roleName}`];
    if (params.location) descParts.push(`Location: ${params.location}`);
    descParts.push('', 'Created by PMI EMS Scheduler');

    const eventId = await createGoogleEvent(accessToken, {
      summary,
      description: descParts.join('\n'),
      startDateTime,
      endDateTime,
      colorId: COLOR_LAB_ROLE,
    });

    if (eventId) {
      await storeEventMapping({
        user_email: params.userEmail,
        google_event_id: eventId,
        source_type: 'lab_day_role',
        source_id: params.roleId,
        lab_day_id: params.labDayId,
        event_summary: summary,
      });
    }
  } catch (err) {
    console.error('[gcal] Error syncing lab day role:', err);
  }
}

/**
 * Remove a Google Calendar event for a lab day role.
 */
export async function removeLabDayRole(params: {
  userEmail: string;
  roleId: string;
}): Promise<void> {
  try {
    const mapping = await getEventMapping(
      params.userEmail,
      'lab_day_role',
      params.roleId
    );
    if (!mapping) return;

    const accessToken = await getAccessTokenForUser(params.userEmail);
    if (accessToken) {
      await deleteGoogleEvent(accessToken, mapping.google_event_id);
    }

    await deleteEventMapping(params.userEmail, 'lab_day_role', params.roleId);
  } catch (err) {
    console.error('[gcal] Error removing lab day role:', err);
  }
}

// --- Lab Day Bulk Operations ---

/**
 * Update all calendar events linked to a lab day (when date/time/title changes).
 */
export async function updateLabDayEvents(
  labDayId: string,
  updates: {
    title?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
  }
): Promise<void> {
  try {
    const mappings = await getEventMappingsByLabDay(labDayId);
    if (mappings.length === 0) return;

    for (const mapping of mappings) {
      try {
        const accessToken = await getAccessTokenForUser(mapping.user_email);
        if (!accessToken) continue;

        const patchParams: Partial<CalendarEventParams> = {};

        if (updates.date || updates.startTime || updates.endTime) {
          // Need the current date if not being updated
          const supabase = getSupabaseAdmin();
          const { data: labDay } = await supabase
            .from('lab_days')
            .select('date, start_time, end_time')
            .eq('id', labDayId)
            .single();

          const date = updates.date || labDay?.date;
          if (date) {
            const { startDateTime, endDateTime } = buildDateTimes(
              date,
              updates.startTime || labDay?.start_time,
              updates.endTime || labDay?.end_time
            );
            patchParams.startDateTime = startDateTime;
            patchParams.endDateTime = endDateTime;
          }
        }

        if (updates.title && mapping.event_summary) {
          // Replace old title portion in summary
          const oldTitle = mapping.event_summary.split(' — ')[0].replace('PMI Lab: ', '');
          patchParams.summary = mapping.event_summary.replace(oldTitle, updates.title);
        }

        if (Object.keys(patchParams).length > 0) {
          await updateGoogleEvent(accessToken, mapping.google_event_id, patchParams);

          // Update mapping summary if changed
          if (patchParams.summary) {
            const supabase = getSupabaseAdmin();
            await supabase
              .from('google_calendar_events')
              .update({ event_summary: patchParams.summary, updated_at: new Date().toISOString() })
              .eq('id', mapping.id);
          }
        }
      } catch (err) {
        console.error(`[gcal] Error updating event for ${mapping.user_email}:`, err);
      }
    }
  } catch (err) {
    console.error('[gcal] Error updating lab day events:', err);
  }
}

/**
 * Delete all calendar events linked to a lab day.
 */
export async function deleteLabDayEvents(labDayId: string): Promise<void> {
  try {
    const mappings = await getEventMappingsByLabDay(labDayId);
    if (mappings.length === 0) return;

    const supabase = getSupabaseAdmin();

    for (const mapping of mappings) {
      try {
        const accessToken = await getAccessTokenForUser(mapping.user_email);
        if (accessToken) {
          await deleteGoogleEvent(accessToken, mapping.google_event_id);
        }
      } catch (err) {
        console.error(`[gcal] Error deleting event for ${mapping.user_email}:`, err);
      }
    }

    // Bulk delete all mappings for this lab day
    await supabase
      .from('google_calendar_events')
      .delete()
      .eq('lab_day_id', labDayId);
  } catch (err) {
    console.error('[gcal] Error deleting lab day events:', err);
  }
}

// --- Shift Signups ---

interface ShiftSignupParams {
  userEmail: string;
  signupId: string;
  shiftId: string;
  shiftTitle: string;
  shiftDate: string;
  startTime?: string;
  endTime?: string;
  department?: string;
  location?: string;
}

/**
 * Create a Google Calendar event for a confirmed shift signup.
 */
export async function syncShiftSignup(params: ShiftSignupParams): Promise<void> {
  try {
    if (!(await shouldSyncForUser(params.userEmail, 'sync_shifts'))) return;

    const accessToken = await getAccessTokenForUser(params.userEmail);
    if (!accessToken) return;

    const { startDateTime, endDateTime } = buildDateTimes(
      params.shiftDate,
      params.startTime,
      params.endTime
    );

    const summary = `PMI Shift: ${params.shiftTitle}`;
    const descParts = [];
    if (params.department) descParts.push(`Department: ${params.department}`);
    if (params.location) descParts.push(`Location: ${params.location}`);
    descParts.push('', 'Created by PMI EMS Scheduler');

    const eventId = await createGoogleEvent(accessToken, {
      summary,
      description: descParts.join('\n'),
      startDateTime,
      endDateTime,
      colorId: COLOR_SHIFT,
    });

    if (eventId) {
      await storeEventMapping({
        user_email: params.userEmail,
        google_event_id: eventId,
        source_type: 'shift_signup',
        source_id: params.signupId,
        shift_id: params.shiftId,
        event_summary: summary,
      });
    }
  } catch (err) {
    console.error('[gcal] Error syncing shift signup:', err);
  }
}

/**
 * Remove a Google Calendar event for a shift signup withdrawal.
 */
export async function removeShiftSignup(params: {
  userEmail: string;
  signupId: string;
}): Promise<void> {
  try {
    const mapping = await getEventMapping(
      params.userEmail,
      'shift_signup',
      params.signupId
    );
    if (!mapping) return;

    const accessToken = await getAccessTokenForUser(params.userEmail);
    if (accessToken) {
      await deleteGoogleEvent(accessToken, mapping.google_event_id);
    }

    await deleteEventMapping(params.userEmail, 'shift_signup', params.signupId);
  } catch (err) {
    console.error('[gcal] Error removing shift signup:', err);
  }
}

/**
 * Cancel all calendar events for a cancelled shift.
 */
export async function cancelShiftEvents(shiftId: string): Promise<void> {
  try {
    const mappings = await getEventMappingsByShift(shiftId);
    if (mappings.length === 0) return;

    const supabase = getSupabaseAdmin();

    for (const mapping of mappings) {
      try {
        const accessToken = await getAccessTokenForUser(mapping.user_email);
        if (accessToken) {
          await deleteGoogleEvent(accessToken, mapping.google_event_id);
        }
      } catch (err) {
        console.error(`[gcal] Error cancelling shift event for ${mapping.user_email}:`, err);
      }
    }

    // Bulk delete all mappings for this shift
    await supabase
      .from('google_calendar_events')
      .delete()
      .eq('shift_id', shiftId);
  } catch (err) {
    console.error('[gcal] Error cancelling shift events:', err);
  }
}

// --- Coverage Tag ---

/**
 * Update all calendar events for a lab day with [COVERAGE NEEDED] tag.
 * When coverage is needed, prepend the tag. When filled, remove it.
 */
export async function updateCoverageTag(
  labDayId: string,
  needsCoverage: boolean
): Promise<void> {
  try {
    const mappings = await getEventMappingsByLabDay(labDayId);
    if (mappings.length === 0) return;

    const TAG = '[COVERAGE NEEDED] ';

    for (const mapping of mappings) {
      try {
        const accessToken = await getAccessTokenForUser(mapping.user_email);
        if (!accessToken) continue;

        const currentSummary = mapping.event_summary || '';
        let newSummary: string;

        if (needsCoverage) {
          // Add tag if not already present
          newSummary = currentSummary.startsWith(TAG)
            ? currentSummary
            : TAG + currentSummary;
        } else {
          // Remove tag
          newSummary = currentSummary.startsWith(TAG)
            ? currentSummary.slice(TAG.length)
            : currentSummary;
        }

        if (newSummary !== currentSummary) {
          await updateGoogleEvent(accessToken, mapping.google_event_id, {
            summary: newSummary,
            colorId: needsCoverage ? COLOR_COVERAGE : undefined,
          });

          // Update mapping summary
          const supabase = getSupabaseAdmin();
          await supabase
            .from('google_calendar_events')
            .update({ event_summary: newSummary, updated_at: new Date().toISOString() })
            .eq('id', mapping.id);
        }
      } catch (err) {
        console.error(`[gcal] Error updating coverage tag for ${mapping.user_email}:`, err);
      }
    }
  } catch (err) {
    console.error('[gcal] Error updating coverage tags:', err);
  }
}

// --- Site Visits ---

interface SiteVisitSyncParams {
  visitorEmail: string;
  visitId: string;
  siteName: string;
  visitDate: string;
  visitTime?: string;
  cohortName?: string;
  departments?: string[];
  comments?: string;
}

/**
 * Create a Google Calendar event for a clinical site visit.
 */
export async function syncSiteVisit(params: SiteVisitSyncParams): Promise<void> {
  try {
    if (!(await shouldSyncForUser(params.visitorEmail, 'sync_site_visits'))) return;

    const accessToken = await getAccessTokenForUser(params.visitorEmail);
    if (!accessToken) return;

    // Site visits are typically 1-2 hours; default to a 2-hour block
    const startTimeStr = params.visitTime || '09:00';
    const [hours, minutes] = startTimeStr.split(':').map(Number);
    const endHours = Math.min(hours + 2, 23);
    const endTimeStr = `${String(endHours).padStart(2, '0')}:${String(minutes || 0).padStart(2, '0')}`;

    const { startDateTime, endDateTime } = buildDateTimes(
      params.visitDate,
      startTimeStr,
      endTimeStr
    );

    const summary = `PMI Site Visit: ${params.siteName}`;
    const descParts = [`Clinical Site Visit — ${params.siteName}`];
    if (params.cohortName) descParts.push(`Cohort: ${params.cohortName}`);
    if (params.departments?.length) descParts.push(`Departments: ${params.departments.join(', ')}`);
    if (params.comments) descParts.push(`Notes: ${params.comments}`);
    descParts.push('', 'Created by PMI EMS Scheduler');

    const eventId = await createGoogleEvent(accessToken, {
      summary,
      description: descParts.join('\n'),
      startDateTime,
      endDateTime,
      colorId: COLOR_SITE_VISIT,
    });

    if (eventId) {
      await storeEventMapping({
        user_email: params.visitorEmail,
        google_event_id: eventId,
        source_type: 'site_visit',
        source_id: params.visitId,
        event_summary: summary,
      });
    }
  } catch (err) {
    console.error('[gcal] Error syncing site visit:', err);
  }
}

/**
 * Update a Google Calendar event for a clinical site visit.
 */
export async function updateSiteVisit(params: SiteVisitSyncParams): Promise<void> {
  try {
    const mapping = await getEventMapping(
      params.visitorEmail,
      'site_visit',
      params.visitId
    );

    if (!mapping) {
      // No existing event — create one
      await syncSiteVisit(params);
      return;
    }

    const accessToken = await getAccessTokenForUser(params.visitorEmail);
    if (!accessToken) return;

    const startTimeStr = params.visitTime || '09:00';
    const [hours, minutes] = startTimeStr.split(':').map(Number);
    const endHours = Math.min(hours + 2, 23);
    const endTimeStr = `${String(endHours).padStart(2, '0')}:${String(minutes || 0).padStart(2, '0')}`;

    const { startDateTime, endDateTime } = buildDateTimes(
      params.visitDate,
      startTimeStr,
      endTimeStr
    );

    const summary = `PMI Site Visit: ${params.siteName}`;
    const descParts = [`Clinical Site Visit — ${params.siteName}`];
    if (params.cohortName) descParts.push(`Cohort: ${params.cohortName}`);
    if (params.departments?.length) descParts.push(`Departments: ${params.departments.join(', ')}`);
    if (params.comments) descParts.push(`Notes: ${params.comments}`);
    descParts.push('', 'Created by PMI EMS Scheduler');

    await updateGoogleEvent(accessToken, mapping.google_event_id, {
      summary,
      description: descParts.join('\n'),
      startDateTime,
      endDateTime,
    });

    // Update mapping
    const supabase = getSupabaseAdmin();
    await supabase
      .from('google_calendar_events')
      .update({ event_summary: summary, updated_at: new Date().toISOString() })
      .eq('id', mapping.id);
  } catch (err) {
    console.error('[gcal] Error updating site visit:', err);
  }
}

/**
 * Remove a Google Calendar event for a clinical site visit.
 */
export async function removeSiteVisit(params: {
  visitorEmail: string;
  visitId: string;
}): Promise<void> {
  try {
    const mapping = await getEventMapping(
      params.visitorEmail,
      'site_visit',
      params.visitId
    );
    if (!mapping) return;

    const accessToken = await getAccessTokenForUser(params.visitorEmail);
    if (accessToken) {
      await deleteGoogleEvent(accessToken, mapping.google_event_id);
    }

    await deleteEventMapping(params.visitorEmail, 'site_visit', params.visitId);
  } catch (err) {
    console.error('[gcal] Error removing site visit:', err);
  }
}
