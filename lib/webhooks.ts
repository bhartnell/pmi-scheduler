/**
 * Webhook utility library for outbound integration webhooks.
 *
 * Supports:
 * - HMAC-SHA256 payload signing
 * - Sending POST requests to subscriber URLs
 * - Logging delivery attempts to webhook_logs
 */

import crypto from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Available webhook events
// ---------------------------------------------------------------------------

export const WEBHOOK_EVENTS = [
  // Student events
  'student.created',
  'student.updated',
  // Lab events
  'lab_day.created',
  'lab_day.completed',
  // Shift events
  'shift.created',
  'shift.filled',
  // Attendance events
  'attendance.marked',
  // Grade events
  'grade.submitted',
  // Incident events
  'incident.reported',
  // Booking events
  'booking.created',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const WEBHOOK_EVENT_GROUPS: Record<string, WebhookEvent[]> = {
  'Students': ['student.created', 'student.updated'],
  'Lab Days': ['lab_day.created', 'lab_day.completed'],
  'Shifts': ['shift.created', 'shift.filled'],
  'Attendance': ['attendance.marked'],
  'Grades': ['grade.submitted'],
  'Incidents': ['incident.reported'],
  'Bookings': ['booking.created'],
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WebhookRecord {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  is_active: boolean;
  headers: Record<string, string>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// generateSignature
// ---------------------------------------------------------------------------

/**
 * Generate an HMAC-SHA256 signature for a webhook payload.
 * The receiving app can verify this to confirm the request is authentic.
 *
 * @param payload - Stringified JSON payload
 * @param secret  - Shared secret configured on the webhook
 * @returns hex-encoded HMAC-SHA256 signature (prefixed with "sha256=")
 */
export function generateSignature(payload: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  return `sha256=${hmac.digest('hex')}`;
}

// ---------------------------------------------------------------------------
// sendWebhookRequest
// ---------------------------------------------------------------------------

/**
 * Send a single webhook HTTP POST request and log the result.
 */
export async function sendWebhookRequest(
  webhook: WebhookRecord,
  event: string,
  payload: object
): Promise<{ success: boolean; status: number | null; body: string }> {
  const supabase = getSupabaseAdmin();
  const payloadString = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Event': event,
    'User-Agent': 'PMI-EMS-Scheduler/1.0',
    ...(webhook.headers || {}),
  };

  if (webhook.secret) {
    headers['X-Webhook-Signature'] = generateSignature(payloadString, webhook.secret);
  }

  let responseStatus: number | null = null;
  let responseBody = '';
  let success = false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000); // 10s timeout

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    responseStatus = response.status;
    responseBody = await response.text().catch(() => '');
    success = response.status >= 200 && response.status < 300;
  } catch (err) {
    responseBody = err instanceof Error ? err.message : 'Request failed';
    success = false;
  }

  // Log the delivery attempt
  try {
    await supabase.from('webhook_logs').insert({
      webhook_id: webhook.id,
      event,
      payload: { event, data: payload },
      response_status: responseStatus,
      response_body: responseBody.slice(0, 4000), // cap at 4KB
      success,
      retry_count: 0,
    });
  } catch (logErr) {
    console.error('Failed to log webhook delivery:', logErr);
  }

  return { success, status: responseStatus, body: responseBody };
}

// ---------------------------------------------------------------------------
// triggerWebhook
// ---------------------------------------------------------------------------

/**
 * Find all active webhooks subscribed to the given event and send the payload
 * to each. Non-blocking – errors are caught and logged.
 *
 * @param event   - The webhook event name (e.g. "student.created")
 * @param payload - The event data to send
 */
export async function triggerWebhook(event: string, payload: object): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();

    const { data: webhooks, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('is_active', true)
      .contains('events', [event]);

    if (error) {
      console.error('Failed to fetch webhooks for event:', event, error);
      return;
    }

    if (!webhooks || webhooks.length === 0) return;

    // Fire all webhook deliveries in parallel (best-effort)
    await Promise.allSettled(
      webhooks.map((webhook: WebhookRecord) => sendWebhookRequest(webhook, event, payload))
    );
  } catch (err) {
    console.error('triggerWebhook error:', err);
  }
}

// ---------------------------------------------------------------------------
// Sample payloads for testing
// ---------------------------------------------------------------------------

export const SAMPLE_PAYLOADS: Record<string, object> = {
  'student.created': {
    id: 'stu_00000000-0000-0000-0000-000000000001',
    first_name: 'Jane',
    last_name: 'Doe',
    cohort_id: 'coh_00000000-0000-0000-0000-000000000001',
    status: 'active',
  },
  'student.updated': {
    id: 'stu_00000000-0000-0000-0000-000000000001',
    first_name: 'Jane',
    last_name: 'Doe',
    changed_fields: ['status'],
    status: 'completed',
  },
  'lab_day.created': {
    id: 'lab_00000000-0000-0000-0000-000000000001',
    date: new Date().toISOString().split('T')[0],
    cohort_id: 'coh_00000000-0000-0000-0000-000000000001',
    location: 'Lab A',
  },
  'lab_day.completed': {
    id: 'lab_00000000-0000-0000-0000-000000000001',
    date: new Date().toISOString().split('T')[0],
    cohort_id: 'coh_00000000-0000-0000-0000-000000000001',
    completed_at: new Date().toISOString(),
  },
  'shift.created': {
    id: 'shf_00000000-0000-0000-0000-000000000001',
    date: new Date().toISOString().split('T')[0],
    start_time: '08:00',
    end_time: '16:00',
  },
  'shift.filled': {
    id: 'shf_00000000-0000-0000-0000-000000000001',
    instructor_email: 'instructor@pmi.edu',
    filled_at: new Date().toISOString(),
  },
  'attendance.marked': {
    student_id: 'stu_00000000-0000-0000-0000-000000000001',
    lab_day_id: 'lab_00000000-0000-0000-0000-000000000001',
    status: 'present',
    marked_by: 'instructor@pmi.edu',
  },
  'grade.submitted': {
    student_id: 'stu_00000000-0000-0000-0000-000000000001',
    scenario_id: 'scn_00000000-0000-0000-0000-000000000001',
    score: 92,
    submitted_by: 'instructor@pmi.edu',
  },
  'incident.reported': {
    id: 'inc_00000000-0000-0000-0000-000000000001',
    severity: 'minor',
    location: 'Lab A',
    reported_by: 'instructor@pmi.edu',
    reported_at: new Date().toISOString(),
  },
  'booking.created': {
    id: 'bkg_00000000-0000-0000-0000-000000000001',
    resource_type: 'equipment',
    resource_id: 'res_00000000-0000-0000-0000-000000000001',
    booked_by: 'instructor@pmi.edu',
    start_time: new Date().toISOString(),
  },
};
