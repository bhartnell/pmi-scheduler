import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createNotification } from '@/lib/notifications';
import { sendEmail } from '@/lib/email';

/**
 * GET /api/cron/compliance-reminders
 *
 * Daily cron (13:00 UTC / 6:00 AM MST) that:
 *  1. Checks for overdue compliance audits → notifies admins
 *  2. Checks for audits due within 7 days → notifies admins
 *  3. Checks for audits never run → notifies admins
 *  4. Updates is_overdue flag in compliance_audits
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  try {
    // 1. Fetch all compliance audits
    const { data: audits, error: auditsError } = await supabase
      .from('compliance_audits')
      .select('*')
      .order('audit_type', { ascending: true });

    if (auditsError) {
      console.error('[COMPLIANCE CRON] Error fetching audits:', auditsError);
      return NextResponse.json({ success: false, error: auditsError.message }, { status: 500 });
    }

    if (!audits || audits.length === 0) {
      return NextResponse.json({ success: true, message: 'No audits configured' });
    }

    // 2. Categorize audits
    const overdue: typeof audits = [];
    const dueSoon: typeof audits = [];
    const neverRun: typeof audits = [];

    for (const audit of audits) {
      // Update is_overdue flag
      const isOverdue = audit.next_due_at ? new Date(audit.next_due_at) <= now : false;
      if (isOverdue !== audit.is_overdue) {
        await supabase
          .from('compliance_audits')
          .update({ is_overdue: isOverdue })
          .eq('id', audit.id);
      }

      if (isOverdue) {
        overdue.push(audit);
      } else if (audit.next_due_at) {
        const dueDate = new Date(audit.next_due_at);
        if (dueDate <= sevenDaysFromNow) {
          dueSoon.push(audit);
        }
      }

      if (!audit.last_completed_at) {
        neverRun.push(audit);
      }
    }

    // 3. Get admin emails
    const { data: admins } = await supabase
      .from('lab_users')
      .select('email')
      .in('role', ['admin', 'superadmin'])
      .eq('is_active', true);

    const adminEmails = (admins || []).map(a => a.email);

    if (adminEmails.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active admins to notify',
        stats: { overdue: overdue.length, dueSoon: dueSoon.length, neverRun: neverRun.length },
      });
    }

    let notificationCount = 0;

    // 4. Send overdue notifications
    if (overdue.length > 0) {
      const overdueNames = overdue.map(a => a.audit_type).join(', ');
      for (const email of adminEmails) {
        await createNotification({
          userEmail: email,
          title: `${overdue.length} Compliance Audit${overdue.length > 1 ? 's' : ''} Overdue`,
          message: `The following audits are past due: ${overdueNames}. Please run or log these audits.`,
          type: 'compliance_due',
          category: 'system',
          linkUrl: '/admin/compliance',
          referenceType: 'compliance_audit',
        });
        notificationCount++;
      }
    }

    // 5. Send due-soon notifications
    if (dueSoon.length > 0) {
      const dueSoonNames = dueSoon.map(a => {
        const daysUntil = Math.ceil((new Date(a.next_due_at).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        return `${a.audit_type} (${daysUntil}d)`;
      }).join(', ');

      for (const email of adminEmails) {
        await createNotification({
          userEmail: email,
          title: `${dueSoon.length} Compliance Audit${dueSoon.length > 1 ? 's' : ''} Due Soon`,
          message: `Audits due within 7 days: ${dueSoonNames}`,
          type: 'compliance_due',
          category: 'system',
          linkUrl: '/admin/compliance',
          referenceType: 'compliance_audit',
        });
        notificationCount++;
      }
    }

    // 6. Send never-run notification (once weekly — only on Mondays)
    if (neverRun.length > 0 && now.getDay() === 1) {
      const neverRunNames = neverRun.map(a => a.audit_type).join(', ');
      for (const email of adminEmails) {
        await createNotification({
          userEmail: email,
          title: `${neverRun.length} Audit${neverRun.length > 1 ? 's' : ''} Never Run`,
          message: `These audits have never been completed: ${neverRunNames}`,
          type: 'compliance_due',
          category: 'system',
          linkUrl: '/admin/compliance',
          referenceType: 'compliance_audit',
        });
        notificationCount++;
      }
    }

    // 7. Send email summary to first admin if there are overdue audits
    if (overdue.length > 0 && adminEmails.length > 0) {
      const overdueList = overdue.map(a => `• ${a.audit_type} (due: ${a.next_due_at ? new Date(a.next_due_at).toLocaleDateString() : 'N/A'})`).join('\n');
      try {
        await sendEmail({
          to: adminEmails[0],
          subject: `⚠️ ${overdue.length} Compliance Audit${overdue.length > 1 ? 's' : ''} Overdue`,
          template: 'general',
          data: {
            title: 'Compliance Audits Overdue',
            message: `The following compliance audits are overdue and require attention:\n\n${overdueList}\n\nPlease log into the admin panel to run or record these audits.`,
            actionUrl: `${process.env.NEXTAUTH_URL || 'https://pmiparamedic.tools'}/admin/compliance`,
            actionText: 'View Compliance Dashboard',
          },
        });
      } catch (emailErr) {
        console.error('[COMPLIANCE CRON] Email send error:', emailErr);
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        total: audits.length,
        overdue: overdue.length,
        dueSoon: dueSoon.length,
        neverRun: neverRun.length,
      },
      notifications_sent: notificationCount,
    });
  } catch (err) {
    console.error('[COMPLIANCE CRON] Unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
