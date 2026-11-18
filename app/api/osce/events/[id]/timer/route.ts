import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import { logAuditEvent } from '@/lib/audit';
import { PHASE_CONFIG, applyAction, applyAdjustment, parseTimerState, timerKey, type TimerAction } from '@/lib/osce-timer';

export const dynamic = 'force-dynamic';

const ACTIONS: TimerAction[] = ['start_scenario', 'start_oral', 'pause', 'resume', 'reset'];
const UUID = /^[0-9a-f-]{36}$/i;

// Public like other evaluator reads (evaluators are code-authenticated, not signed in).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ success: false, error: 'bad id' }, { status: 400 });
  const { data } = await getSupabaseAdmin().from('system_settings').select('value').eq('key', timerKey(id)).maybeSingle();
  const res = NextResponse.json({
    success: true,
    state: parseTimerState(data?.value),
    server_now: new Date().toISOString(),
    config: PHASE_CONFIG,
  });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ success: false, error: 'bad id' }, { status: 400 });

  let body: { action?: string; seconds?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const isAdjust = body.action === 'adjust' || body.action === 'set_remaining';
  if (!isAdjust && (!body.action || !ACTIONS.includes(body.action as TimerAction))) {
    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const key = timerKey(id);
  const { data } = await supabase.from('system_settings').select('value').eq('key', key).maybeSingle();
  const now = new Date().toISOString();
  const current = parseTimerState(data?.value);
  let applied: ReturnType<typeof applyAdjustment> = null;
  let next: ReturnType<typeof applyAction>;
  if (isAdjust) {
    if (typeof body.seconds !== 'number') return NextResponse.json({ success: false, error: 'seconds required' }, { status: 400 });
    applied = applyAdjustment(current, body.action as 'adjust' | 'set_remaining', body.seconds, now);
    if (!applied) return NextResponse.json({ success: false, error: 'No running or paused phase to adjust' }, { status: 409 });
    next = applied.state;
  } else {
    next = applyAction(current, body.action as TimerAction, now);
  }
  if (!next) return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  next.updated_by = auth.user.email;
  next.updated_at = now;

  const { error } = await supabase
    .from('system_settings')
    .upsert({ key, value: JSON.stringify(next), updated_at: now }, { onConflict: 'key' });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  if (applied) {
    const fmt = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
    await logAuditEvent({
      user: { email: auth.user.email, role: auth.user.role },
      action: 'update',
      resourceType: 'osce_timer',
      resourceId: id,
      resourceDescription: `OSCE timer (${current.phase}${current.paused_at ? ', paused' : ''}) ${body.action === 'adjust' ? `adjusted ${applied.requested_sec >= 0 ? '+' : ''}${applied.requested_sec}s` : `set to ${fmt(applied.requested_sec)}`}: remaining ${fmt(applied.before_sec)} -> ${fmt(applied.after_sec)}${applied.clamped ? ' (clamped)' : ''}`,
    });
  }
  return NextResponse.json({
    success: true,
    state: next,
    server_now: now,
    ...(applied ? { applied: { before_sec: applied.before_sec, after_sec: applied.after_sec, clamped: applied.clamped } } : {}),
  });
}
