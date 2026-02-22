import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase';

interface Recipient {
  email: string;
  name?: string;
}

interface SendEmailRequest {
  to: Recipient[];
  subject: string;
  body: string; // HTML body
  plainText?: string; // Optional plain text version
  replyTo?: string;
  pollId?: string;
  internshipId?: string;
}

// Create a MIME email message
function createMimeMessage(
  from: string,
  fromName: string,
  to: Recipient[],
  subject: string,
  htmlBody: string,
  plainText?: string,
  replyTo?: string
): string {
  const boundary = `boundary_${Date.now()}`;

  // Format recipients
  const toAddresses = to.map(r => r.name ? `"${r.name}" <${r.email}>` : r.email).join(', ');

  let message = [
    `From: "${fromName}" <${from}>`,
    `To: ${toAddresses}`,
    `Subject: ${subject}`,
    replyTo ? `Reply-To: ${replyTo}` : '',
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    plainText || htmlBody.replace(/<[^>]*>/g, ''), // Strip HTML for plain text
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    htmlBody,
    '',
    `--${boundary}--`,
  ].filter(line => line !== '').join('\r\n');

  // Base64 URL-safe encode
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.accessToken) {
      return NextResponse.json({
        success: false,
        error: 'No email access. Please sign out and sign in again to grant email permissions.',
        needsReauth: true
      }, { status: 403 });
    }

    const body: SendEmailRequest = await request.json();
    const { to, subject, body: htmlBody, plainText, replyTo, pollId, internshipId } = body;

    if (!to || to.length === 0 || !subject || !htmlBody) {
      return NextResponse.json({
        success: false,
        error: 'Recipients, subject, and body are required'
      }, { status: 400 });
    }

    // Create MIME message
    const rawMessage = createMimeMessage(
      session.user.email,
      session.user.name || 'PMI Scheduler',
      to,
      subject,
      htmlBody,
      plainText,
      replyTo
    );

    // Send via Gmail API
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: rawMessage }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Gmail API error:', errorData);

      if (response.status === 401) {
        return NextResponse.json({
          success: false,
          error: 'Email access expired. Please sign out and sign in again.',
          needsReauth: true
        }, { status: 403 });
      }

      return NextResponse.json({
        success: false,
        error: errorData.error?.message || 'Failed to send email'
      }, { status: 500 });
    }

    const result = await response.json();

    // Log notifications for each recipient
    try {
      const notificationLogs = to.map(recipient => ({
        type: 'email',
        recipient_email: recipient.email,
        recipient_name: recipient.name || null,
        subject: subject,
        email_body: htmlBody,
        poll_id: pollId || null,
        internship_id: internshipId || null,
        status: 'sent',
        sent_by_email: session.user?.email || '',
        sent_by_name: session.user?.name || null,
      }));

      await supabase.from('notifications_log').insert(notificationLogs);
    } catch (logError) {
      console.error('Error logging notifications:', logError);
    }

    return NextResponse.json({
      success: true,
      messageId: result.id,
      recipientCount: to.length,
    });
  } catch (error: any) {
    console.error('Error sending email:', error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Failed to send email'
    }, { status: 500 });
  }
}
