import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendOsceInviteEmail } from '@/lib/email';

const ROLE_LABELS: Record<string, string> = {
  md: 'Medical Director',
  faculty: 'Faculty',
  agency: 'Agency Representative',
};

function formatDateRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
  const startDate = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  if (start === end) return startDate.toLocaleDateString('en-US', opts);
  if (startDate.getFullYear() === endDate.getFullYear() && startDate.getMonth() === endDate.getMonth()) {
    return `${startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}–${endDate.getDate()}, ${endDate.getFullYear()}`;
  }
  return `${startDate.toLocaleDateString('en-US', opts)} – ${endDate.toLocaleDateString('en-US', opts)}`;
}

// POST - Admin: send (or resend) the OSCE evaluator invite email for one or
// more guest tokens. This is the actual "send" action — every call here
// dispatches a real email via Resend to the address stored on the token.
//
// Body: { token_ids: string[] }
// Returns per-token results so the UI can show exactly who succeeded/failed
// without the whole batch failing together.
export async function POST(req: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const tokenIds: string[] = Array.isArray(body.token_ids) ? body.token_ids : [];

    if (tokenIds.length === 0) {
      return NextResponse.json({ success: false, error: 'token_ids is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const origin = new URL(req.url).origin;

    const { data: tokens, error: tokenError } = await supabase
      .from('osce_guest_tokens')
      .select('*')
      .in('id', tokenIds);

    if (tokenError) throw tokenError;
    if (!tokens || tokens.length === 0) {
      return NextResponse.json({ success: false, error: 'No matching tokens found' }, { status: 404 });
    }

    // Pre-fetch the distinct events referenced so we don't re-query per token.
    const eventIds = [...new Set(tokens.map(t => t.event_id).filter(Boolean))];
    const { data: events } = eventIds.length
      ? await supabase
          .from('osce_events')
          .select('id, title, subtitle, location, start_date, end_date, event_pin')
          .in('id', eventIds)
      : { data: [] };
    const eventById = new Map((events || []).map(e => [e.id, e]));

    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const t of tokens) {
      if (!t.email) {
        results.push({ id: t.id, success: false, error: 'No email address on file for this evaluator' });
        continue;
      }
      const event = t.event_id ? eventById.get(t.event_id) : null;
      if (!event) {
        results.push({ id: t.id, success: false, error: 'Token is not linked to an OSCE event' });
        continue;
      }

      const inviteLink = `${origin}/osce-scoring/enter?token=${t.token}`;

      const sendResult = await sendOsceInviteEmail(t.email, {
        evaluatorName: t.evaluator_name,
        eventTitle: event.title,
        eventSubtitle: event.subtitle,
        eventDates: formatDateRange(event.start_date, event.end_date),
        eventLocation: event.location,
        eventPin: event.event_pin,
        roleLabel: t.evaluator_role ? ROLE_LABELS[t.evaluator_role] || t.evaluator_role : null,
        inviteLink,
      });

      if (sendResult.success) {
        await supabase
          .from('osce_guest_tokens')
          .update({
            invited_at: new Date().toISOString(),
            invite_send_count: (t.invite_send_count || 0) + 1,
            invite_last_error: null,
          })
          .eq('id', t.id);
        results.push({ id: t.id, success: true });
      } else {
        await supabase
          .from('osce_guest_tokens')
          .update({ invite_last_error: sendResult.error || 'Unknown error' })
          .eq('id', t.id);
        results.push({ id: t.id, success: false, error: sendResult.error || 'Send failed' });
      }
    }

    const sentCount = results.filter(r => r.success).length;
    return NextResponse.json({
      success: true,
      results,
      sent: sentCount,
      failed: results.length - sentCount,
    });
  } catch (err) {
    console.error('Error sending OSCE invites:', err);
    return NextResponse.json({ success: false, error: 'Failed to send invites' }, { status: 500 });
  }
}
