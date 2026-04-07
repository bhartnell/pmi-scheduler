import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// ---------------------------------------------------------------------------
// GET /api/lab-management/lab-days/[id]/results-package
//
// Returns a print-friendly HTML page with all skill evaluation results for
// a given lab day. Designed for NREMT testing days (individual_testing mode).
// ---------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !hasMinRole(currentUser.role, 'instructor')) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const { id: labDayId } = await params;
    const supabase = getSupabaseAdmin();

    // 1. Fetch lab day details
    const { data: labDay, error: labDayError } = await supabase
      .from('lab_days')
      .select(`
        id, title, date, lab_mode, start_time, end_time,
        cohort:cohorts(id, cohort_number, program:programs(name, abbreviation))
      `)
      .eq('id', labDayId)
      .single();

    if (labDayError || !labDay) {
      return new NextResponse('Lab day not found', { status: 404 });
    }

    // 2. Fetch all evaluations for this lab day
    const { data: evaluations, error: evalError } = await supabase
      .from('student_skill_evaluations')
      .select(`
        id,
        evaluation_type,
        result,
        notes,
        created_at,
        attempt_number,
        status,
        skill_sheet:skill_sheets(id, skill_name),
        student:students(id, first_name, last_name),
        evaluator:lab_users!student_skill_evaluations_evaluator_id_fkey(id, name)
      `)
      .eq('lab_day_id', labDayId)
      .eq('status', 'complete')
      .order('created_at', { ascending: true });

    if (evalError) {
      console.error('Error fetching evaluations:', evalError);
      return new NextResponse('Error fetching evaluations', { status: 500 });
    }

    // 3. Group evaluations by student
    interface EvalRecord {
      id: string;
      evaluation_type: string;
      result: string;
      notes: string | null;
      created_at: string;
      attempt_number: number | null;
      status: string;
      skill_sheet: { id: string; skill_name: string } | null;
      student: { id: string; first_name: string; last_name: string } | null;
      evaluator: { id: string; name: string } | null;
    }

    const studentMap = new Map<string, {
      name: string;
      evals: EvalRecord[];
    }>();

    for (const ev of (evaluations || []) as unknown as EvalRecord[]) {
      if (!ev.student) continue;
      const sid = ev.student.id;
      if (!studentMap.has(sid)) {
        studentMap.set(sid, {
          name: `${ev.student.last_name}, ${ev.student.first_name}`,
          evals: [],
        });
      }
      studentMap.get(sid)!.evals.push(ev);
    }

    // Sort students alphabetically
    const students = Array.from(studentMap.entries()).sort((a, b) =>
      a[1].name.localeCompare(b[1].name)
    );

    // 4. Format date
    const labDate = labDay.date
      ? new Date(labDay.date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'Unknown Date';

    const cohortInfo = labDay.cohort as unknown as {
      id: string;
      cohort_number: number;
      program: { name: string; abbreviation: string };
    } | null;

    const programName = cohortInfo?.program?.name || 'Paramedic Program';
    const cohortNumber = cohortInfo?.cohort_number || '';

    // 5. Generate HTML
    const totalStudents = students.length;
    const passedAll = students.filter(([, s]) => {
      return s.evals.length > 0 && s.evals.every(e => e.result === 'pass');
    }).length;

    let studentSections = '';

    for (const [, student] of students) {
      const allPassed = student.evals.length > 0 && student.evals.every(e => e.result === 'pass');
      const overallResult = student.evals.length === 0
        ? 'NO EVALUATIONS'
        : allPassed
          ? 'PASS'
          : 'FAIL';

      const resultColor = overallResult === 'PASS' ? '#16a34a' : overallResult === 'FAIL' ? '#dc2626' : '#9ca3af';

      let skillRows = '';
      for (const ev of student.evals) {
        const skillName = ev.skill_sheet?.skill_name || 'Unknown Skill';
        const evalResult = ev.result || 'N/A';
        const examiner = ev.evaluator?.name || 'Unknown';
        const timestamp = ev.created_at
          ? new Date(ev.created_at).toLocaleString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })
          : '';
        const attempt = ev.attempt_number || 1;
        const resultBg = evalResult === 'pass' ? '#dcfce7' : evalResult === 'fail' ? '#fef2f2' : '#fef9c3';
        const resultText = evalResult === 'pass' ? '#166534' : evalResult === 'fail' ? '#991b1b' : '#854d0e';

        skillRows += `
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${skillName}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
              <span style="display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; background: ${resultBg}; color: ${resultText}; text-transform: uppercase;">${evalResult}</span>
            </td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${attempt}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${examiner}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">${timestamp}</td>
          </tr>`;

        if (ev.notes) {
          skillRows += `
          <tr>
            <td colspan="5" style="padding: 4px 12px 8px 24px; border-bottom: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; font-style: italic;">Notes: ${escapeHtml(ev.notes)}</td>
          </tr>`;
        }
      }

      studentSections += `
        <div style="page-break-inside: avoid; margin-bottom: 32px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 2px solid #1f2937; padding-bottom: 4px;">
            <h2 style="margin: 0; font-size: 18px; color: #1f2937;">${escapeHtml(student.name)}</h2>
            <span style="font-size: 16px; font-weight: 700; color: ${resultColor};">${overallResult}</span>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Skill</th>
                <th style="padding: 8px 12px; text-align: center; border-bottom: 2px solid #d1d5db;">Result</th>
                <th style="padding: 8px 12px; text-align: center; border-bottom: 2px solid #d1d5db;">Attempt</th>
                <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Examiner</th>
                <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Time</th>
              </tr>
            </thead>
            <tbody>
              ${skillRows || '<tr><td colspan="5" style="padding: 12px; text-align: center; color: #9ca3af;">No evaluations recorded</td></tr>'}
            </tbody>
          </table>
        </div>`;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Results Package — ${escapeHtml(labDay.title || 'Lab Day')} — ${labDate}</title>
  <style>
    @media print {
      body { margin: 0; padding: 20px; }
      .no-print { display: none !important; }
      .cover-page { page-break-after: always; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1f2937;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 20px;
      line-height: 1.5;
    }
    .print-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px 24px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      z-index: 1000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .print-btn:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>

  <!-- Cover Page -->
  <div class="cover-page" style="text-align: center; padding-top: 120px;">
    <h1 style="font-size: 32px; color: #1f2937; margin-bottom: 8px;">Skills Testing Results</h1>
    <p style="font-size: 20px; color: #4b5563; margin-bottom: 40px;">${escapeHtml(labDay.title || 'Lab Day')}</p>

    <div style="display: inline-block; text-align: left; font-size: 16px; color: #374151; line-height: 2;">
      <p><strong>Date:</strong> ${labDate}</p>
      <p><strong>Program:</strong> ${escapeHtml(programName)}</p>
      ${cohortNumber ? `<p><strong>Cohort:</strong> ${cohortNumber}</p>` : ''}
      <p><strong>Total Students Tested:</strong> ${totalStudents}</p>
      <p><strong>Passed All Skills:</strong> ${passedAll} of ${totalStudents}</p>
    </div>

    <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af;">
      Generated ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })} | PMI Paramedic Tools
    </div>
  </div>

  <!-- Student Results -->
  ${studentSections || '<p style="text-align: center; color: #9ca3af; padding: 40px;">No evaluations found for this lab day.</p>'}

  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center;">
    End of Results Package | ${totalStudents} student(s) | Generated ${new Date().toLocaleString('en-US')}
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error generating results package:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
