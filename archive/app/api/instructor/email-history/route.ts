import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';
import type { EmailTemplate } from '@/lib/email';

/**
 * GET /api/instructor/email-history
 *
 * Returns the authenticated instructor's email history from email_log.
 * Supports pagination via ?limit=N&offset=N query params.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const { user } = auth;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const supabase = getSupabaseAdmin();

    // Fetch emails sent TO this instructor
    const { data: emails, error, count } = await supabase
      .from('email_log')
      .select('id, to_email, subject, template, status, error, resend_id, created_at, sent_at', { count: 'exact' })
      .ilike('to_email', user.email)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[email-history] Query error:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch email history' }, { status: 500 });
    }

    // Also get pending evaluations for the "Resend Pending Results" feature
    // These are evaluations where this instructor was the evaluator and email wasn't sent
    const { data: pendingEvals, error: pendingError } = await supabase
      .from('student_skill_evaluations')
      .select('id, evaluation_type, result, email_status, created_at, student:students!student_skill_evaluations_student_id_fkey(first_name, last_name), skill_sheet:skill_sheets!student_skill_evaluations_skill_sheet_id_fkey(skill_name), lab_day:lab_days!student_skill_evaluations_lab_day_id_fkey(id, date)')
      .eq('evaluator_id', user.id)
      .eq('status', 'complete')
      .in('email_status', ['pending', 'failed', 'queued'])
      .order('created_at', { ascending: false })
      .limit(50);

    if (pendingError) {
      console.error('[email-history] Pending evals error:', pendingError);
    }

    return NextResponse.json({
      success: true,
      emails: emails ?? [],
      total: count ?? 0,
      pending_evaluations: pendingEvals ?? [],
    });
  } catch (err) {
    console.error('[email-history] Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/instructor/email-history
 *
 * Resend a specific failed email by ID, or resend all pending evaluation results.
 *
 * Body:
 *   { action: 'resend_email', email_id: string }
 *   { action: 'resend_pending_results' }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const { user } = auth;
    const body = await request.json();
    const { action } = body as { action: string };

    const supabase = getSupabaseAdmin();

    if (action === 'resend_email') {
      const { email_id } = body as { email_id: string };
      if (!email_id) {
        return NextResponse.json({ success: false, error: 'email_id required' }, { status: 400 });
      }

      // Fetch the original email log entry (must belong to this user)
      const { data: emailLog, error } = await supabase
        .from('email_log')
        .select('id, to_email, subject, template, status')
        .eq('id', email_id)
        .ilike('to_email', user.email)
        .single();

      if (error || !emailLog) {
        return NextResponse.json({ success: false, error: 'Email not found or not yours' }, { status: 404 });
      }

      // Re-send using the general template with original subject
      const result = await sendEmail({
        to: emailLog.to_email,
        subject: emailLog.subject,
        template: (emailLog.template || 'general') as EmailTemplate,
        data: {
          subject: emailLog.subject,
          title: 'Resent Notification',
          message: `This is a resend of a previous notification: "${emailLog.subject}". Please check your portal for details.`,
        },
      });

      return NextResponse.json({
        success: result.success,
        error: result.error,
        message: result.success ? 'Email resent successfully' : 'Failed to resend email',
      });
    }

    if (action === 'resend_pending_results') {
      // Find all pending/failed evaluations where this instructor was the evaluator
      const { data: pendingEvals, error } = await supabase
        .from('student_skill_evaluations')
        .select('id, lab_day:lab_days!student_skill_evaluations_lab_day_id_fkey(id)')
        .eq('evaluator_id', user.id)
        .eq('status', 'complete')
        .in('email_status', ['pending', 'failed', 'queued']);

      if (error) {
        console.error('[email-history] Pending evals query error:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch pending evaluations' }, { status: 500 });
      }

      if (!pendingEvals || pendingEvals.length === 0) {
        return NextResponse.json({ success: true, sent: 0, errors: 0, message: 'No pending evaluations to send' });
      }

      // Group by lab_day_id and call the existing resend endpoint logic
      const byLabDay: Record<string, string[]> = {};
      for (const ev of pendingEvals) {
        const labDay = ev.lab_day as any;
        const labDayId = labDay?.id;
        if (labDayId) {
          if (!byLabDay[labDayId]) byLabDay[labDayId] = [];
          byLabDay[labDayId].push(ev.id);
        }
      }

      let totalSent = 0;
      let totalErrors = 0;

      for (const [labDayId, evalIds] of Object.entries(byLabDay)) {
        try {
          const baseUrl = request.headers.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
          const host = request.headers.get('host') || 'localhost:3000';
          const resendUrl = `${baseUrl}://${host}/api/lab-management/lab-days/${labDayId}/skill-results/resend`;

          const res = await fetch(resendUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              cookie: request.headers.get('cookie') || '',
            },
            body: JSON.stringify({ evaluation_ids: evalIds }),
          });

          const data = await res.json();
          totalSent += data.sent ?? 0;
          totalErrors += data.errors ?? 0;
        } catch (err) {
          console.error(`[email-history] Resend error for lab day ${labDayId}:`, err);
          totalErrors += evalIds.length;
        }
      }

      return NextResponse.json({
        success: true,
        sent: totalSent,
        errors: totalErrors,
        message: `Sent ${totalSent} email(s), ${totalErrors} error(s)`,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('[email-history] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
