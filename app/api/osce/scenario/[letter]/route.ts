import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import { todayInOsceZone } from '@/lib/osce-event-pin';
import { canReadScenario } from '@/lib/osce-scenario-access';
import { loadCaseNames } from '@/lib/osce-case-names';

// Scenario data for the OSCE scoring page. NOT public: answers only for a
// signed-in admin/instructor, or an evaluator session that proves it belongs to
// an event currently accepting evaluators (event id + event code or guest token,
// sent in headers x-osce-event-id / x-osce-code / x-osce-token, never in the URL).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ letter: string }> }
) {
  const { letter } = await params;

  if (!letter || letter.length !== 1) {
    return NextResponse.json({ error: 'Invalid scenario letter' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const auth = await requireAuth('instructor');
    const staffSession = !(auth instanceof NextResponse);

    if (!staffSession) {
      const eventId = req.headers.get('x-osce-event-id');
      const code = req.headers.get('x-osce-code');
      const tokenStr = req.headers.get('x-osce-token');
      let event = null;
      let token = null;
      if (eventId) {
        const { data: ev } = await supabase
          .from('osce_events')
          .select('id, status, start_date, end_date, event_pin')
          .eq('id', eventId)
          .maybeSingle();
        event = ev;
      }
      if (tokenStr) {
        const { data: tk } = await supabase
          .from('osce_guest_tokens')
          .select('event_id, valid_from, valid_until')
          .eq('token', tokenStr)
          .maybeSingle();
        token = tk;
      }
      if (!canReadScenario({ staffSession, eventId, code, event, token, today: todayInOsceZone(), now: new Date() })) {
        return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
      }
    }

    const { data, error } = await supabase
      .from('osce_scenarios')
      .select('scenario_letter, title, patient_name, patient_age, patient_gender, instructor_notes, chief_complaint, dispatch_text, critical_actions, vital_sign_progressions, expected_interventions, oral_board_domains, full_content')
      .eq('scenario_letter', letter.toUpperCase())
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    const names = await loadCaseNames(supabase);
    return NextResponse.json({ ...data, short_name: names[data.scenario_letter] ?? null });
  } catch (err) {
    console.error('Error fetching scenario:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
