import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import { sendScenarioFeedbackEmail } from '@/lib/email';

function formatInstructorName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
}

/**
 * POST /api/lab-management/assessments/scenario/send-email
 * Send scenario feedback to all group members.
 * Body: { assessment_id: string } OR { lab_day_id: string } for batch
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { assessment_id, lab_day_id } = body;

    if (!assessment_id && !lab_day_id) {
      return NextResponse.json({ success: false, error: 'assessment_id or lab_day_id required' }, { status: 400 });
    }

    // Fetch assessments to send
    let query = supabase
      .from('scenario_assessments')
      .select(`
        id, lab_station_id, lab_day_id, cohort_id, rotation_number,
        team_lead_id, criteria_ratings, overall_comments, overall_score,
        email_status, status,
        graded_by,
        station:lab_stations!lab_station_id(id, station_number, custom_title, scenario_id,
          scenario:scenarios!lab_stations_scenario_id_fkey(id, title, category, patient_age, patient_sex, chief_complaint, dispatch_info, critical_actions)),
        team_lead:students!team_lead_id(id, first_name, last_name),
        evaluator:lab_users!scenario_assessments_graded_by_fkey(id, name),
        lab_day:lab_days!scenario_assessments_lab_day_id_fkey(id, date, title)
      `);

    if (assessment_id) {
      query = query.eq('id', assessment_id);
    } else {
      query = query.eq('lab_day_id', lab_day_id).eq('email_status', 'queued').eq('status', 'complete');
    }

    const { data: assessments, error: fetchError } = await query;

    if (fetchError || !assessments?.length) {
      return NextResponse.json({ success: true, sent: 0, message: 'No assessments to send' });
    }

    let sent = 0;
    let errors = 0;

    for (const assessment of assessments) {
      // Skip if not queued (for individual sends, allow any status except sent/do_not_send)
      if (assessment_id) {
        if (assessment.email_status === 'sent' || assessment.email_status === 'do_not_send') continue;
      }

      const station = assessment.station as any;
      const scenario = station?.scenario;
      const teamLead = assessment.team_lead as any;
      const evaluator = assessment.evaluator as any;
      const labDay = assessment.lab_day as any;

      const evalDate = labDay?.date
        ? new Date(labDay.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : undefined;

      // Build criteria ratings HTML
      const criteriaRatings = (assessment.criteria_ratings as any[]) || [];
      const ratingLabels: Record<string, string> = { S: 'Satisfactory', NI: 'Needs Improvement', U: 'Unsatisfactory' };
      const criteriaHtml = criteriaRatings
        .map(r => {
          let line = `${r.criteria_name || r.criteria_id}: <strong>${ratingLabels[r.rating] || r.rating || 'N/A'}</strong>`;
          // Add sub-item breakdown for SAMPLE/OPQRST/DCAP-BTLS
          if (r.sub_items && Array.isArray(r.sub_items) && r.sub_items.length > 0) {
            const got = r.sub_items.filter((s: any) => s.checked).map((s: any) => s.label);
            const missed = r.sub_items.filter((s: any) => !s.checked).map((s: any) => s.label);
            const total = r.sub_items.length;
            line += `<br><span style="margin-left:16px;font-size:12px;color:#6b7280;">${got.length}/${total} obtained`;
            if (got.length > 0) line += ` &mdash; Got: ${got.join(', ')}`;
            if (missed.length > 0) line += `. Missed: ${missed.join(', ')}`;
            line += '</span>';
          }
          return line;
        })
        .join('<br>');

      // Build critical actions HTML
      const criticalActions = scenario?.critical_actions;
      let criticalActionsHtml = '';
      if (criticalActions && Array.isArray(criticalActions)) {
        criticalActionsHtml = criticalActions.map((action: string, i: number) => {
          return `${action}`;
        }).join('<br>');
      }

      // Fetch all group members for the cohort who should receive the email
      // Get the group that this rotation's team members belong to
      const { data: groupMembers } = await supabase
        .from('lab_group_members')
        .select(`
          student:students!lab_group_members_student_id_fkey(id, first_name, last_name, email)
        `)
        .eq('cohort_id', assessment.cohort_id);

      // If we can't get group members, try to at least email the team lead
      const recipients: { email: string; firstName: string }[] = [];

      if (groupMembers) {
        for (const member of groupMembers) {
          const student = member.student as any;
          if (student?.email) {
            recipients.push({ email: student.email, firstName: student.first_name });
          }
        }
      }

      // Fallback: at least email team lead
      if (recipients.length === 0 && teamLead) {
        const { data: leadStudent } = await supabase
          .from('students')
          .select('email, first_name')
          .eq('id', teamLead.id)
          .single();
        if (leadStudent?.email) {
          recipients.push({ email: leadStudent.email, firstName: leadStudent.first_name });
        }
      }

      // Send to each recipient
      for (const recipient of recipients) {
        try {
          const result = await sendScenarioFeedbackEmail(recipient.email, {
            studentFirstName: recipient.firstName,
            scenarioTitle: scenario?.title || station?.custom_title || 'Scenario',
            patientAge: scenario?.patient_age || undefined,
            patientSex: scenario?.patient_sex || undefined,
            chiefComplaint: scenario?.chief_complaint || undefined,
            dispatchInfo: scenario?.dispatch_info || undefined,
            teamLeaderName: teamLead ? `${teamLead.first_name} ${teamLead.last_name}` : undefined,
            criteriaRatings: criteriaHtml || undefined,
            overallScore: `${assessment.overall_score || 0}/${criteriaRatings.length}`,
            criticalActions: criticalActionsHtml || undefined,
            comments: assessment.overall_comments || undefined,
            evaluatorName: evaluator?.name ? formatInstructorName(evaluator.name) : 'Instructor',
            date: evalDate,
          });
          if (result.success) sent++;
          else errors++;
        } catch {
          errors++;
        }
      }

      // Update assessment email_status
      await supabase
        .from('scenario_assessments')
        .update({ email_status: 'sent' })
        .eq('id', assessment.id);
    }

    return NextResponse.json({ success: true, sent, errors });
  } catch (error) {
    console.error('Error sending scenario emails:', error);
    return NextResponse.json({ success: false, error: 'Failed to send emails' }, { status: 500 });
  }
}
