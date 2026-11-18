import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { PIN_ACCEPTED_STATUSES, todayInOsceZone } from '@/lib/osce-event-pin';
import { decideStaffSession } from '@/lib/osce-staff-session';

const STAFF_AGENCY = 'Pima Medical Institute';

// GET - signed-in pmi.edu staff: get an evaluator identity for the event accepting
// evaluators today, no event code. Outside evaluators and signed-out users get
// { success:false } and keep the code path. Writes at most one walk-up row per
// (event, name); no scores, rosters or codes are returned or touched.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    if (!email) return NextResponse.json({ success: false, reason: 'signed_out' });

    const supabase = getSupabaseAdmin();
    const { data: user } = await supabase
      .from('lab_users')
      .select('name, email, role')
      .ilike('email', email)
      .maybeSingle();

    const { data: events, error } = await supabase
      .from('osce_events')
      .select('id, title, subtitle, start_date, end_date, status')
      .in('status', [...PIN_ACCEPTED_STATUSES]);
    if (error) return NextResponse.json({ success: false, reason: 'lookup_failed' }, { status: 500 });

    const decision = decideStaffSession({
      user: user ? { email: user.email, role: user.role } : null,
      events,
      today: todayInOsceZone(),
    });
    if (!decision.ok || !user) {
      return NextResponse.json({ success: false, reason: decision.ok ? 'not_staff' : decision.reason });
    }
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

    let evaluator: { name: string; role: string; source: 'observer' | 'walkup' };
    if (obs) {
      evaluator = { name: obs.name, role: obs.role || 'agency', source: 'observer' };
    } else {
      // Same row a walk-up gets, once per event + name.
      const { data: existing } = await supabase
        .from('osce_walkup_evaluators')
        .select('id')
        .eq('event_id', event.id)
        .ilike('name', user.name)
        .limit(1);
      if (!existing || existing.length === 0) {
        const { error: insErr } = await supabase
          .from('osce_walkup_evaluators')
          .insert({ event_id: event.id, name: user.name, agency: STAFF_AGENCY, role: 'faculty' });
        if (insErr) {
          console.error('staff-session walk-up insert failed:', insErr);
          return NextResponse.json({ success: false, reason: 'lookup_failed' }, { status: 500 });
        }
      }
      evaluator = { name: user.name, role: 'faculty', source: 'walkup' };
    }

    return NextResponse.json({
      success: true,
      event: { id: event.id, title: event.title },
      evaluator,
    });
  } catch (err) {
    console.error('staff-session error:', err);
    return NextResponse.json({ success: false, reason: 'lookup_failed' }, { status: 500 });
  }
}
