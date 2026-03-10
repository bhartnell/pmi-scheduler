import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { EMAIL_COLORS, emailContentBox } from '@/lib/email-templates';
import { sendEmail } from '@/lib/email';

const APP_URL = process.env.NEXTAUTH_URL || 'https://pmiparamedic.tools';

/**
 * GET /api/cron/lvfr-weekly-report
 *
 * Vercel cron endpoint. Runs Sunday at 8 AM UTC.
 * Sends a weekly LVFR AEMT progress report to all agency_observer users.
 *
 * Auth: Bearer CRON_SECRET (standard Vercel cron pattern).
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[LVFR-WEEKLY-REPORT] Unauthorized cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  console.log('[LVFR-WEEKLY-REPORT] Cron started at', new Date().toISOString());

  const supabase = getSupabaseAdmin();

  try {
    // 1. Find all agency_observer and agency_liaison users
    const { data: agencyUsers, error: usersError } = await supabase
      .from('lab_users')
      .select('id, name, email, role, agency_affiliation')
      .in('role', ['agency_observer', 'agency_liaison']);

    if (usersError) {
      console.error('[LVFR-WEEKLY-REPORT] Failed to fetch agency users:', usersError.message);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    if (!agencyUsers || agencyUsers.length === 0) {
      console.log('[LVFR-WEEKLY-REPORT] No agency users found, skipping.');
      return NextResponse.json({ success: true, message: 'No agency users', sent: 0 });
    }

    // 2. Gather LVFR program data
    const { data: chapters } = await supabase
      .from('lvfr_aemt_chapters')
      .select('id, status');

    const totalChapters = chapters?.length || 0;
    const completedChapters = chapters?.filter(c => c.status === 'completed').length || 0;
    const progressPercent = totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0;

    // Course days
    const { data: days } = await supabase
      .from('lvfr_aemt_course_days')
      .select('id, day_number, date, status, has_exam, has_quiz, title')
      .order('day_number', { ascending: true });

    const totalDays = days?.length || 0;
    const completedDays = days?.filter(d => d.status === 'completed').length || 0;

    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    const upcomingDays = (days || [])
      .filter(d => d.date && d.date >= today && d.date <= nextWeek)
      .slice(0, 5);

    // Student stats
    const { data: lvfrCohorts } = await supabase
      .from('cohorts')
      .select('id')
      .or('cohort_number.ilike.%LVFR%,cohort_number.ilike.%AEMT%');

    const cohortIds = lvfrCohorts?.map(c => c.id) || [];
    let totalStudents = 0;
    let atRiskStudents: string[] = [];
    let avgGrade: number | null = null;

    if (cohortIds.length > 0) {
      const { data: students } = await supabase
        .from('students')
        .select('id, first_name, last_name, status')
        .in('cohort_id', cohortIds)
        .eq('status', 'active');

      totalStudents = students?.length || 0;

      if (totalStudents > 0) {
        const studentIds = students!.map(s => s.id);
        const { data: grades } = await supabase
          .from('lvfr_aemt_grades')
          .select('student_id, score_percent')
          .in('student_id', studentIds);

        if (grades && grades.length > 0) {
          const sum = grades.reduce((acc, g) => acc + (Number(g.score_percent) || 0), 0);
          avgGrade = Math.round(sum / grades.length);

          // Find at-risk students
          const studentAvgs = new Map<string, number[]>();
          for (const g of grades) {
            const arr = studentAvgs.get(g.student_id) || [];
            arr.push(Number(g.score_percent) || 0);
            studentAvgs.set(g.student_id, arr);
          }
          for (const [studentId, scores] of studentAvgs) {
            const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
            if (avg < 80) {
              const student = students!.find(s => s.id === studentId);
              if (student) {
                atRiskStudents.push(`${student.first_name} ${student.last_name} (${Math.round(avg)}%)`);
              }
            }
          }
        }
      }
    }

    // 3. Build email content
    const reportDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const upcomingWeekHtml = upcomingDays.length > 0
      ? upcomingDays.map(d =>
          `<tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid ${EMAIL_COLORS.gray[200]}; font-size: 14px;">Day ${d.day_number}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid ${EMAIL_COLORS.gray[200]}; font-size: 14px;">${d.date}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid ${EMAIL_COLORS.gray[200]}; font-size: 14px;">${d.title || '—'}${d.has_exam ? ' 📝' : ''}${d.has_quiz ? ' ❓' : ''}</td>
          </tr>`
        ).join('')
      : '<tr><td colspan="3" style="padding: 12px; text-align: center; color: #6b7280;">No classes scheduled this week</td></tr>';

    const atRiskHtml = atRiskStudents.length > 0
      ? `<div style="margin-top: 16px;">
          <h3 style="color: ${EMAIL_COLORS.error}; font-size: 16px; margin-bottom: 8px;">⚠️ Students Requiring Attention</h3>
          <ul style="margin: 0; padding-left: 20px;">
            ${atRiskStudents.map(s => `<li style="font-size: 14px; margin-bottom: 4px;">${s}</li>`).join('')}
          </ul>
        </div>`
      : '<p style="color: #10b981; font-size: 14px;">✅ All students are currently on track.</p>';

    const emailContent = `
      <h2 style="color: ${EMAIL_COLORS.primary}; font-size: 20px; margin-bottom: 4px;">LVFR AEMT Weekly Progress Report</h2>
      <p style="color: ${EMAIL_COLORS.gray[500]}; font-size: 14px; margin-top: 0;">${reportDate}</p>

      ${emailContentBox(`
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0;">
              <strong style="color: ${EMAIL_COLORS.gray[900]};">Course Progress</strong><br/>
              <span style="font-size: 24px; font-weight: bold; color: ${EMAIL_COLORS.accent};">${progressPercent}%</span>
              <span style="color: ${EMAIL_COLORS.gray[500]}; font-size: 14px;"> (${completedChapters}/${totalChapters} chapters)</span>
            </td>
            <td style="padding: 8px 0;">
              <strong style="color: ${EMAIL_COLORS.gray[900]};">Days Completed</strong><br/>
              <span style="font-size: 24px; font-weight: bold; color: ${EMAIL_COLORS.accent};">${completedDays}/${totalDays}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">
              <strong style="color: ${EMAIL_COLORS.gray[900]};">Students Enrolled</strong><br/>
              <span style="font-size: 24px; font-weight: bold; color: ${EMAIL_COLORS.accent};">${totalStudents}</span>
            </td>
            <td style="padding: 8px 0;">
              <strong style="color: ${EMAIL_COLORS.gray[900]};">Class Average</strong><br/>
              <span style="font-size: 24px; font-weight: bold; color: ${avgGrade && avgGrade >= 80 ? EMAIL_COLORS.success : EMAIL_COLORS.error};">${avgGrade != null ? `${avgGrade}%` : 'N/A'}</span>
            </td>
          </tr>
        </table>
      `)}

      <h3 style="color: ${EMAIL_COLORS.gray[900]}; font-size: 16px; margin-top: 24px;">📅 Upcoming Week</h3>
      <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
        <thead>
          <tr style="background-color: ${EMAIL_COLORS.gray[100]};">
            <th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: ${EMAIL_COLORS.gray[500]};">Day</th>
            <th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: ${EMAIL_COLORS.gray[500]};">Date</th>
            <th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: ${EMAIL_COLORS.gray[500]};">Content</th>
          </tr>
        </thead>
        <tbody>
          ${upcomingWeekHtml}
        </tbody>
      </table>

      ${atRiskHtml}

      <p style="color: ${EMAIL_COLORS.gray[500]}; font-size: 12px; margin-top: 24px;">
        This is an automated weekly report from the PMI Paramedic Tools LVFR AEMT module.
        Contact your program administrator to adjust reporting preferences.
      </p>
    `;

    // 4. Send to each agency user using the general template
    // The general template wraps with title + message, and sendEmail adds the outer email wrapper
    let sentCount = 0;
    let errorCount = 0;

    for (const agencyUser of agencyUsers) {
      try {
        await sendEmail({
          to: agencyUser.email,
          subject: `LVFR AEMT Weekly Report — ${reportDate}`,
          template: 'general',
          data: {
            title: 'LVFR AEMT Weekly Progress Report',
            message: emailContent,
            actionUrl: `${APP_URL}/lvfr-aemt`,
            actionText: 'View Dashboard',
          },
        });
        sentCount++;
      } catch (err) {
        console.error(`[LVFR-WEEKLY-REPORT] Failed to send to ${agencyUser.email}:`, err);
        errorCount++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[LVFR-WEEKLY-REPORT] Complete in ${duration}ms. Sent: ${sentCount}, Errors: ${errorCount}`);

    return NextResponse.json({
      success: true,
      sent: sentCount,
      errors: errorCount,
      duration_ms: duration,
    });
  } catch (error) {
    console.error('[LVFR-WEEKLY-REPORT] Unhandled error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
