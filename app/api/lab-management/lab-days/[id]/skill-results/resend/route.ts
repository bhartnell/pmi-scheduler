import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendSkillEvaluationEmail } from '@/lib/email';

function formatInstructorName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const { id: labDayId } = await params;
    const body = await request.json();
    const { student_id, evaluation_ids } = body as { student_id?: string; evaluation_ids?: string[] };

    // Three callable modes:
    //   1. student_id provided        → resend for that student only
    //   2. evaluation_ids[] provided  → resend the specific evaluations
    //   3. neither provided           → "resend all unsent" for the lab
    //      day (used by the "Resend Results Emails" button on the
    //      lab day page). The query below already excludes
    //      email_status='sent' so this won't re-send anything that
    //      already went out.

    const supabase = getSupabaseAdmin();

    // Build query for evaluations to resend
    let query = supabase
      .from('student_skill_evaluations')
      .select(`
        id, evaluation_type, result, notes, email_status, step_marks, created_at,
        student:students!student_skill_evaluations_student_id_fkey(id, first_name, last_name, email),
        skill_sheet:skill_sheets!student_skill_evaluations_skill_sheet_id_fkey(id, skill_name, source, steps:skill_sheet_steps(step_number, is_critical, possible_points, sub_items)),
        evaluator:lab_users!student_skill_evaluations_evaluator_id_fkey(id, name),
        lab_day:lab_days!student_skill_evaluations_lab_day_id_fkey(id, date, title)
      `)
      .eq('lab_day_id', labDayId)
      .eq('status', 'complete')
      .neq('email_status', 'sent');

    if (student_id) {
      query = query.eq('student_id', student_id);
    } else if (evaluation_ids) {
      query = query.in('id', evaluation_ids);
    }

    const { data: evaluations, error } = await query;

    if (error) {
      console.error('[skill-results/resend] Query error:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch evaluations' }, { status: 500 });
    }

    if (!evaluations || evaluations.length === 0) {
      return NextResponse.json({ success: true, sent: 0, errors: 0, message: 'No evaluations to send' });
    }

    let sent = 0;
    let errors = 0;
    let skippedNoEmail = 0;
    const noEmailNames: string[] = [];

    for (const evaluation of evaluations) {
      try {
        const student = evaluation.student as any;
        const skillSheet = evaluation.skill_sheet as any;
        const evaluator = evaluation.evaluator as any;
        const labDay = evaluation.lab_day as any;

        if (!student?.email) {
          // No email on file — tally separately from real errors so
          // the UI can show "Sent X, skipped Y (no email)" instead
          // of conflating the two. Mark do_not_send so subsequent
          // "Resend all" passes don't re-try the same row.
          await supabase
            .from('student_skill_evaluations')
            .update({ email_status: 'do_not_send' })
            .eq('id', evaluation.id);
          skippedNoEmail++;
          const name = `${student?.first_name ?? ''} ${student?.last_name ?? ''}`.trim();
          if (name) noEmailNames.push(name);
          continue;
        }

        if (evaluation.email_status === 'do_not_send') {
          continue;
        }

        // Calculate steps/points from step_marks
        const stepsArr = skillSheet?.steps || [];
        const rawMarks = (evaluation.step_marks || {}) as Record<string, unknown>;
        const isMultiPoint = stepsArr.some((s: any) =>
          (s.possible_points && s.possible_points > 1) || (s.sub_items && s.sub_items.length > 0)
        );
        const effPts = (s: any) => (s.sub_items && s.sub_items.length > 0) ? s.sub_items.length : (s.possible_points || 1);
        const totalPossiblePoints = stepsArr.reduce((sum: number, s: any) => sum + effPts(s), 0);
        const totalSteps = stepsArr.length;

        let passedSteps = 0;
        let earnedPoints = 0;
        const criticalSteps = stepsArr.filter((s: any) => s.is_critical);
        let criticalPassed = 0;

        for (const [key, val] of Object.entries(rawMarks)) {
          if (typeof val === 'string') {
            const step = stepsArr.find((s: any) => String(s.step_number) === key);
            if (val === 'pass') { passedSteps++; earnedPoints += step ? effPts(step) : 1; }
            if (step?.is_critical && val === 'pass') criticalPassed++;
          } else if (typeof val === 'object' && val !== null) {
            const obj = val as { completed?: boolean; points?: number };
            earnedPoints += obj.points || 0;
            if (obj.completed) passedSteps++;
            const step = stepsArr.find((s: any) => String(s.step_number) === key);
            if (step?.is_critical && obj.completed) criticalPassed++;
          }
        }

        // Format date
        const evalDate = labDay?.date
          ? new Date(labDay.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          : new Date(evaluation.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        // Send email. Scope NREMT guard to this lab day specifically
        // — see /api/skill-sheets/evaluations/send-email for context.
        const emailResult = await sendSkillEvaluationEmail(student.email, {
          evaluationId: evaluation.id,
          studentFirstName: student.first_name,
          skillName: skillSheet?.skill_name || 'Skill Evaluation',
          evaluationType: evaluation.evaluation_type,
          result: evaluation.result,
          stepsCompleted: isMultiPoint
            ? `${earnedPoints}/${totalPossiblePoints} points (${totalPossiblePoints > 0 ? Math.round((earnedPoints / totalPossiblePoints) * 100) : 0}%)`
            : (totalSteps > 0 ? `${passedSteps}/${totalSteps}` : undefined),
          criticalSteps: criticalSteps.length > 0 ? `${criticalPassed}/${criticalSteps.length}` : undefined,
          notes: evaluation.notes || undefined,
          evaluatorName: evaluator?.name ? formatInstructorName(evaluator.name) : 'Instructor',
          date: evalDate,
          labDayId,
        });

        if (emailResult.success) {
          await supabase
            .from('student_skill_evaluations')
            .update({ email_status: 'sent' })
            .eq('id', evaluation.id);
          sent++;
        } else {
          errors++;
        }
      } catch (err) {
        console.error('[skill-results/resend] Error sending evaluation:', evaluation.id, err);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      errors,
      skipped_no_email: skippedNoEmail,
      no_email_names: noEmailNames.length > 0 ? noEmailNames : undefined,
    });
  } catch (err) {
    console.error('[skill-results/resend] Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
