import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { sendSkillEvaluationEmail } from '@/lib/email';

function formatInstructorName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('id, name, role')
      .ilike('email', session.user.email)
      .single();

    if (!currentUser || !hasMinRole(currentUser.role, 'instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { lab_day_id, evaluation_ids } = await request.json();

    if (!lab_day_id && !evaluation_ids) {
      return NextResponse.json({ success: false, error: 'lab_day_id or evaluation_ids required' }, { status: 400 });
    }

    // Build query for queued evaluations
    let query = supabase
      .from('student_skill_evaluations')
      .select(`
        id, evaluation_type, result, notes, email_status, flagged_items, step_marks, created_at,
        student:students!student_skill_evaluations_student_id_fkey(id, first_name, last_name, email),
        skill_sheet:skill_sheets!student_skill_evaluations_skill_sheet_id_fkey(id, skill_name, source, steps:skill_sheet_steps(step_number, is_critical, possible_points, sub_items)),
        evaluator:lab_users!student_skill_evaluations_evaluator_id_fkey(id, name),
        lab_day:lab_days!student_skill_evaluations_lab_day_id_fkey(id, date, title)
      `)
      .eq('email_status', 'queued');

    if (lab_day_id) {
      query = query.eq('lab_day_id', lab_day_id);
    } else if (evaluation_ids) {
      query = query.in('id', evaluation_ids);
    }

    const { data: evaluations, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json({ success: false, error: 'Failed to fetch evaluations' }, { status: 500 });
    }

    if (!evaluations || evaluations.length === 0) {
      return NextResponse.json({ success: true, sent: 0, skipped: 0, errors: 0, message: 'No queued evaluations found' });
    }

    // Count excluded evaluations for reporting
    let doNotSendCount = 0;
    let finalCount = 0;
    if (lab_day_id) {
      const { count: dnsCount } = await supabase
        .from('student_skill_evaluations')
        .select('id', { count: 'exact', head: true })
        .eq('lab_day_id', lab_day_id)
        .eq('email_status', 'do_not_send');
      doNotSendCount = dnsCount || 0;

      const { count: fCount } = await supabase
        .from('student_skill_evaluations')
        .select('id', { count: 'exact', head: true })
        .eq('lab_day_id', lab_day_id)
        .eq('evaluation_type', 'final_competency');
      finalCount = fCount || 0;
    }

    let sent = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    // Process in batches of 5 for rate limiting
    for (let i = 0; i < evaluations.length; i += 5) {
      const batch = evaluations.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(async (evaluation) => {
          const student = evaluation.student as any;
          if (!student?.email) {
            // Mark as do_not_send so it won't keep showing up in queue
            await supabase
              .from('student_skill_evaluations')
              .update({ email_status: 'do_not_send' })
              .eq('id', evaluation.id);
            skipped++;
            return;
          }

          const skillSheet = evaluation.skill_sheet as any;
          const evaluator = evaluation.evaluator as any;
          const labDay = evaluation.lab_day as any;

          const totalSteps = skillSheet?.steps?.length || 0;
          const rawMarks = (evaluation.step_marks || {}) as Record<string, unknown>;
          const stepsArr = skillSheet?.steps || [];
          const isMultiPoint = stepsArr.some((s: any) => (s.possible_points && s.possible_points > 1) || (s.sub_items && s.sub_items.length > 0));
          const effPts = (s: any) => (s.sub_items && s.sub_items.length > 0) ? s.sub_items.length : (s.possible_points || 1);
          const totalPossiblePoints = stepsArr.reduce((sum: number, s: any) => sum + effPts(s), 0);

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

          const evalDate = labDay?.date
            ? new Date(labDay.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
            : new Date(evaluation.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

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
          });

          if (emailResult.success) {
            await supabase
              .from('student_skill_evaluations')
              .update({ email_status: 'sent' })
              .eq('id', evaluation.id);
            sent++;
          } else {
            errors++;
            errorDetails.push(`${student.first_name} ${student.last_name}: ${emailResult.error}`);
          }
        })
      );

      // Check for unhandled rejections
      results.forEach(r => {
        if (r.status === 'rejected') {
          errors++;
          errorDetails.push(r.reason?.message || 'Unknown error');
        }
      });
    }

    return NextResponse.json({
      success: true,
      sent,
      skipped,
      errors,
      doNotSendCount,
      finalCount,
      errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
    });
  } catch (error) {
    console.error('Error in batch email send:', error);
    return NextResponse.json({ success: false, error: 'Failed to send batch emails' }, { status: 500 });
  }
}
