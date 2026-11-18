import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { PIN_ACCEPTED_STATUSES, todayInOsceZone } from '@/lib/osce-event-pin';
import { decideStaffSession } from '@/lib/osce-staff-session';

const STAFF_AGENCY = 'Pima Medical Institute';

// Signed-in pmi.edu staff: get an evaluator identity for the event accepting
// evaluators today, no event code. Outside evaluators and signed-out users get
// { success:false } and keep the code path.
//   GET  = lookup only: who they would be and for which event. Writes nothing.
//   POST = "Continue": same lookup, then writes at most one walk-up row per
//          (event, name) if they are not on the observer list.
// No scores, rosters or codes are returned or touched.
async function resolve(supabase: SupabaseClient, email: string) {
  const { data: user } = await supabase
    .from('lab_users')
    .select('name, email, role')
    .ilike('email', email)
    .maybeSingle();

  const { data: events, error } = await supabase
    .from('osce_events')
    .select('id, title, subtitle, start_date, end_date, status')
    .in('status', [...PIN_ACCEPTED_STATUSES]);
  if (error) return { fail: 'lookup_failed' as const };

  const decision = decideStaffSession({
    user: user ? { email: user.email, role: user.role } : null,
    events,
    today: todayInOsceZone(),
  });
  if (!decision.ok || !user) return { fail: decision.ok ? ('not_staff' as const) : decision.reason };
  const event = decision.event;

  // On the observer list for this event: use that entry's name and role.
  const { data: observers } = await supabase
    .from('osce_observers')
    .select('name, role, email, contact_email')
    .eq('event_id', event.id);
  const lower = email.toLowerCase();
  const obs = (observers || []).find(
    (o) => o.email?.toLowerCase() === lower || o.contact_email?.toLowerCase() === lower,
  );
  const evaluator: { name: string; role: string; source: 'observer' | 'walkup' } = obs
    ? { name: obs.name, role: obs.role || 'agency', source: 'observer' }
    : { name: user.name, role: 'faculty', source: 'walkup' };
  return { event: { id: event.id, title: event.title }, evaluator };
}

async function handle(commit: boolean) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    if (!email) return NextResponse.json({ success: false, reason: 'signed_out' });

    const supabase = getSupabaseAdmin();
    const r = await resolve(supabase, email);
    if ('fail' in r) {
      return NextResponse.json(
        { success: false, reason: r.fail },
        { status: r.fail === 'lookup_failed' ? 500 : 200 },
      );
    }

    if (commit && r.evaluator.source === 'walkup') {
      // Same row a walk-up gets, once per event + name.
      const { data: existing } = await supabase
        .from('osce_walkup_evaluators')
        .select('id')
        .eq('event_id', r.event.id)
        .ilike('name', r.evaluator.name)
        .limit(1);
      if (!existing || existing.length === 0) {
        const { error: insErr } = await supabase
          .from('osce_walkup_evaluators')
          .insert({ event_id: r.event.id, name: r.evaluator.name, agency: STAFF_AGENCY, role: 'faculty' });
        if (insErr) {
          console.error('staff-session walk-up insert failed:', insErr);
          return NextResponse.json({ success: false, reason: 'lookup_failed' }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ success: true, event: r.event, evaluator: r.evaluator });
  } catch (err) {
    console.error('staff-session error:', err);
    return NextResponse.json({ success: false, reason: 'lookup_failed' }, { status: 500 });
  }
}

export async function GET() {
  return handle(false);
}

export async function POST() {
  return handle(true);
}
