import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/audit';
import {
  SHARED_CALENDAR_WRITER_KEY,
  getSharedCalendarWriterEmail,
} from '@/lib/shared-calendar-writer';

/**
 * CAL 2/3c: status + control for the shared-calendar writer identity.
 *
 * GET  -> read-only. Who the writer is, whether that user's stored Google
 *         connection looks usable (flags only; NO token refresh is attempted, so
 *         viewing this never touches a refresh token), and the re-plan retry
 *         queue (pending count, last error). A missing queue table is reported,
 *         not an error.
 * PUT { email } -> set system_settings `system.shared_calendar_writer`. The email
 *         must belong to an active lab_users row. Audit-logged with old/new.
 */

type Status = {
  writerEmail: string;
  isDefault: boolean;
  sharedCalendarConfigured: boolean;
  connection: 'ok' | 'writer_not_connected' | 'no_user';
  connectionDetail: string;
  queue: {
    available: boolean;
    pending: number;
    lastError: string | null;
    lastErrorAt: string | null;
  };
};

async function buildStatus(): Promise<Status> {
  const supabase = getSupabaseAdmin();
  const writerEmail = await getSharedCalendarWriterEmail();

  const { data: setting } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', SHARED_CALENDAR_WRITER_KEY)
    .maybeSingle();
  const isDefault = !(setting?.value ?? '').trim();

  const { data: user } = await supabase
    .from('lab_users')
    .select('google_calendar_connected, google_refresh_token, google_calendar_scope')
    .ilike('email', writerEmail)
    .maybeSingle();

  let connection: Status['connection'] = 'ok';
  let connectionDetail = 'Connected with calendar write access.';
  if (!user) {
    connection = 'no_user';
    connectionDetail = 'No user with this email exists.';
  } else if (!user.google_calendar_connected || !user.google_refresh_token) {
    connection = 'writer_not_connected';
    connectionDetail = 'This user has not connected Google Calendar (or the connection was cleared).';
  } else if (user.google_calendar_scope !== 'events') {
    connection = 'writer_not_connected';
    connectionDetail = 'This user connected read-only access; they need to reconnect with calendar write access.';
  }

  const queue: Status['queue'] = { available: true, pending: 0, lastError: null, lastErrorAt: null };
  const { count, error: cErr } = await supabase
    .from('lab_day_event_replan_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (cErr) {
    queue.available = false;
  } else {
    queue.pending = count ?? 0;
    const { data: last } = await supabase
      .from('lab_day_event_replan_queue')
      .select('last_error, updated_at')
      .not('last_error', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    queue.lastError = last?.last_error ?? null;
    queue.lastErrorAt = last?.updated_at ?? null;
  }

  return {
    writerEmail,
    isDefault,
    sharedCalendarConfigured: !!process.env.SHARED_CALENDAR_ID,
    connection,
    connectionDetail,
    queue,
  };
}

export async function GET() {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json({ success: true, status: await buildStatus() });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to load status' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  let email = '';
  try {
    const body = await request.json();
    email = String(body?.email ?? '').trim().toLowerCase();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ success: false, error: 'A valid email is required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase
    .from('lab_users')
    .select('id, email, is_active')
    .ilike('email', email)
    .maybeSingle();
  if (!user || user.is_active === false) {
    return NextResponse.json(
      { success: false, error: 'No active user has that email' },
      { status: 400 }
    );
  }

  const previous = await getSharedCalendarWriterEmail();
  const { error } = await supabase
    .from('system_settings')
    .upsert(
      { key: SHARED_CALENDAR_WRITER_KEY, value: email, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  await logAuditEvent({
    user: { id: auth.user.id, email: auth.user.email, role: auth.user.role },
    action: 'update',
    resourceType: 'calendar_sync',
    resourceDescription: `Shared calendar writer changed from ${previous} to ${email}`,
    metadata: { previous, next: email },
  });

  return NextResponse.json({ success: true, status: await buildStatus() });
}
