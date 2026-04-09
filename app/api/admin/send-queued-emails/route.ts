import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendSkillEvaluationEmail } from '@/lib/email';

function formatInstructorName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
}

export async function POST(request: NextRequest) {
  void request;
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();

    // Fetch all queued/pending evaluations that are complete
    const { data: evaluations, error } = await supabase
      .from('student_skill_evaluations')
      .select(`
        id, evaluation_type, result, notes, email_status, step_marks, created_at,
        student:students!student_skill_evaluations_student_id_fkey(id, first_name, last_name, email),
        skill_sheet:skill_sheets!student_skill_evaluations_skill_sheet_id_fkey(id, skill_name, steps:skill_sheet_steps(step_number, possible_points, is_critical, sub_items)),
        evaluator:lab_users!student_skill_evaluations_evaluator_id_fkey(id, name),
        lab_day:lab_days!student_skill_evaluations_lab_day_id_fkey(id, date, title)
      `)
      .in('email_status', ['queued', 'pending'])
      .eq('status', 'complete');

    if (error) {
      console.error('[send-queued-emails] Query error:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch evaluations' }, { status: 500 });
    }

    if (!evaluations || evaluations.length === 0) {
      return NextResponse.json({ success: true, total_found: 0, sent: 0, errors: 0, skipped: 0, message: 'No queued evaluations found' });
    }

    const totalFound = evaluations.length;
    let sent = 0;
    let errors = 0;
    let skipped = 0;
    const perLabDay: Record<string, { lab_day_title: string; date: string; sent: number; errors: number; skipped: number }> = {};

    for (const evaluation of evaluations) {
      try {
        const student = evaluation.student as any;
        const skillSheet = evaluation.skill_sheet as any;
        const evaluator = evaluation.evaluator as any;
        const labDay = evaluation.lab_day as any;

        const labDayKey = labDay?.id || 'unknown';
        if (!perLabDay[labDayKey]) {
          perLabDay[labDayKey] = {
            lab_day_title: labDay?.title || 'Unknown',
            date: labDay?.date || 'Unknown',
            sent: 0,
            errors: 0,
            skipped: 0,
          };
        }

        if (!student?.email) {
          // Mark as do_not_send if no email
          await supabase
            .from('student_skill_evaluations')
            .update({ email_status: 'do_not_send' })
            .eq('id', evaluation.id);
          skipped++;
          perLabDay[labDayKey].skipped++;
          continue;
        }

        // Calculate steps/points from step_marks
        const stepsArr = skillSheet?.steps || [];
        const rawMarks = (evaluation.step_marks || {}) as Record<string, unknown>;
        const isMultiPoint = stepsArr.some((s: any) =>
          (s.possible_points && s.possible_points > 1) || (s.sub_items && s.sub_items.length > 0)
        );
        const totalPossiblePoints = stepsArr.reduce((sum: number, s: any) => sum + (s.possible_points || 1), 0);
        const totalSteps = stepsArr.length;

        let passedSteps = 0;
        let earnedPoints = 0;
        const criticalSteps = stepsArr.filter((s: any) => s.is_critical);
        let criticalPassed = 0;

        for (const [key, val] of Object.entries(rawMarks)) {
          if (typeof val === 'string') {
            const step = stepsArr.find((s: any) => String(s.step_number) === key);
            if (val === 'pass') { passedSteps++; earnedPoints += step?.possible_points || 1; }
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

        // Send email
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
          perLabDay[labDayKey].sent++;
        } else {
          console.error('[send-queued-emails] Email send failed for evaluation:', evaluation.id, emailResult);
          errors++;
          perLabDay[labDayKey].errors++;
        }
      } catch (err) {
        console.error('[send-queued-emails] Error processing evaluation:', evaluation.id, err);
        errors++;
        const labDay = evaluation.lab_day as any;
        const labDayKey = labDay?.id || 'unknown';
        if (perLabDay[labDayKey]) {
          perLabDay[labDayKey].errors++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      total_found: totalFound,
      sent,
      errors,
      skipped,
      per_lab_day: perLabDay,
    });
  } catch (err) {
    console.error('[send-queued-emails] Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
