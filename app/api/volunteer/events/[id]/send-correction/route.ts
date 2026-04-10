import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';

interface SendCorrectionBody {
  subject: string;
  message: string;
  recipientEmails?: string[];
}

// POST /api/volunteer/events/[id]/send-correction
// Sends a "time correction" style email to registered volunteers for an event.
// Body: { subject, message, recipientEmails? }
// If recipientEmails is omitted, all registrations for the event receive it.
// The message body supports a literal "{Name}" placeholder which is replaced
// per-recipient with the registration's name before sending.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = (await request.json()) as SendCorrectionBody;

    if (!body?.subject || !body?.message) {
      return NextResponse.json(
        { success: false, error: 'subject and message are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Load the event
    const { data: event, error: eventErr } = await supabase
      .from('volunteer_events')
      .select('*')
      .eq('id', id)
      .single();

    if (eventErr) throw eventErr;
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Load registrations
    const { data: registrations, error: regErr } = await supabase
      .from('volunteer_registrations')
      .select('id, name, email, status')
      .eq('event_id', id);

    if (regErr) throw regErr;

    const allRegs = registrations || [];
    const targetRegs =
      body.recipientEmails && body.recipientEmails.length > 0
        ? allRegs.filter((r) => body.recipientEmails!.includes(r.email))
        : allRegs;

    if (targetRegs.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No matching recipients found' },
        { status: 400 }
      );
    }

    let sent = 0;
    let failed = 0;
    const errors: Array<{ email: string; error: string }> = [];

    for (const reg of targetRegs) {
      // Replace {Name} placeholder with this recipient's name, then convert
      // newlines to <br> for HTML rendering inside the general template.
      const personalized = body.message
        .replace(/\{Name\}/g, reg.name || 'there')
        .replace(/\r\n/g, '\n')
        .replace(/\n/g, '<br>');

      const result = await sendEmail({
        to: reg.email,
        subject: body.subject,
        template: 'general',
        data: {
          subject: body.subject,
          title: 'Event Time Correction',
          message: personalized,
        },
      });

      if (result.success) {
        sent++;
      } else {
        failed++;
        errors.push({ email: reg.email, error: result.error || 'Unknown error' });
      }
    }

    // Update audit columns on the event row
    const newCount = (event.correction_email_count || 0) + sent;
    await supabase
      .from('volunteer_events')
      .update({
        correction_email_sent_at: new Date().toISOString(),
        correction_email_count: newCount,
      })
      .eq('id', id);

    return NextResponse.json({ success: true, sent, failed, errors });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
