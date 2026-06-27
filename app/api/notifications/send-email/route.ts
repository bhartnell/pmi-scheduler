import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { requireAuth } from '@/lib/api-auth';
import { wrapInEmailTemplate } from '@/lib/email-templates';

const FROM_EMAIL = process.env.EMAIL_FROM || 'PMI Paramedic Tools <notifications@pmiparamedic.tools>';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { to, subject, body: htmlBody } = body;

    if (!Array.isArray(to) || to.length === 0) {
      return NextResponse.json({ success: false, error: 'to array is required' }, { status: 400 });
    }
    if (!subject || !htmlBody) {
      return NextResponse.json({ success: false, error: 'subject and body are required' }, { status: 400 });
    }
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ success: false, error: 'Email service not configured' }, { status: 503 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const preferencesUrl = `${process.env.NEXTAUTH_URL || 'https://pmiparamedic.tools'}/settings?tab=notifications`;
    const fullHtml = wrapInEmailTemplate(htmlBody, preferencesUrl);

    let recipientCount = 0;
    const errors: string[] = [];

    for (const recipient of to) {
      const email = typeof recipient === 'string' ? recipient : recipient?.email;
      if (!email) continue;

      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject,
        html: fullHtml,
      });

      if (error) {
        errors.push(`${email}: ${error.message}`);
      } else {
        recipientCount++;
      }
    }

    return NextResponse.json({
      success: true,
      recipientCount,
      ...(errors.length > 0 && { errors }),
    });
  } catch (error) {
    console.error('Error sending notification email:', error);
    return NextResponse.json({ success: false, error: 'Failed to send email' }, { status: 500 });
  }
}
