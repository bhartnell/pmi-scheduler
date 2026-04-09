import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendSkillEvaluationEmail } from '@/lib/email';

const BATCH_SIZE = 20;
const DELAY_MS = 500;

function formatInstructorName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
}

function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && email.includes('@') && email.length > 3;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    // Parse optional offset for pagination
    let offset = 0;
    try {
      const body = await request.json();
      offset = body?.offset ?? 0;
    } catch {
      // No body is fine — default offset 0
    }

    const supabase = getSupabaseAdmin();

    // Fetch queued/pending evaluations — limited to BATCH_SIZE
    const { data: evaluations, error, count } = await supabase
      .from('student_skill_evaluations')
      .select(`
        id, evaluation_type, result, notes, email_status, step_marks, created_at,
        student:students!student_skill_evaluations_student_id_fkey(id, first_name, last_name, email),
        skill_sheet:skill_sheets!student_skill_evaluations_skill_sheet_id_fkey(id, skill_name, steps:skill_sheet_steps(step_number, possible_points, is_critical, sub_items)),
        evaluator:lab_users!student_skill_evaluations_evaluator_id_fkey(id, name),
        lab_day:lab_days!student_skill_evaluations_lab_day_id_fkey(id, date, title)
      `, { count: 'exact' })
      .in('email_status', ['queued', 'pending'])
      .eq('status', 'complete')
      .order('created_at', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error('[send-queued-emails] Query error:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch evaluations' }, { status: 500 });
    }

    const totalRemaining = count ?? 0;

    if (!evaluations || evaluations.length === 0) {
      return NextResponse.json({
        success: true,
        total_remaining: 0,
        batch_size: 0,
        sent: 0,
        errors: 0,
        skipped: 0,
        has_more: false,
        next_offset: null,
        message: 'No queued evaluations found',
        log: [],
      });
    }

    const batchSize = evaluations.length;
    let sent = 0;
    let errors = 0;
    let skipped = 0;
    const log: Array<{
      eval_id: string;
      student_email: string;
      student_name: string;
      skill: string;
      lab_day: string;
      status: 'sent' | 'skipped' | 'error' | 'stopped';
      reason?: string;
      timestamp: string;
    }> = [];

    for (let i = 0; i < evaluations.length; i++) {
      const evaluation = evaluations[i];
      const student = evaluation.student as any;
      const skillSheet = evaluation.skill_sheet as any;
      const evaluator = evaluation.evaluator as any;
      const labDay = evaluation.lab_day as any;

      const studentName = student ? `${student.last_name}, ${student.first_name}` : 'Unknown';
      const studentEmail = student?.email ?? '';
      const skillName = skillSheet?.skill_name || 'Unknown Skill';
      const labDayLabel = labDay ? `${labDay.title || 'Untitled'} (${labDay.date})` : 'No lab day';

      // Check email validity
      if (!isValidEmail(studentEmail)) {
        await supabase
          .from('student_skill_evaluations')
          .update({ email_status: 'do_not_send' })
          .eq('id', evaluation.id);
        skipped++;
        log.push({
          eval_id: evaluation.id,
          student_email: studentEmail || '(none)',
          student_name: studentName,
          skill: skillName,
          lab_day: labDayLabel,
          status: 'skipped',
          reason: 'Invalid or missing email address',
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      try {
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

        const evalDate = labDay?.date
          ? new Date(labDay.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          : new Date(evaluation.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        // Send email with rate limiting
        const emailResult = await sendSkillEvaluationEmail(studentEmail, {
          evaluationId: evaluation.id,
          studentFirstName: student.first_name,
          skillName,
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
          log.push({
            eval_id: evaluation.id,
            student_email: studentEmail,
            student_name: studentName,
            skill: skillName,
            lab_day: labDayLabel,
            status: 'sent',
            timestamp: new Date().toISOString(),
          });
        } else {
          // On Resend API error: STOP the batch, do not retry
          errors++;
          log.push({
            eval_id: evaluation.id,
            student_email: studentEmail,
            student_name: studentName,
            skill: skillName,
            lab_day: labDayLabel,
            status: 'error',
            reason: `Email send failed: ${JSON.stringify(emailResult)}`,
            timestamp: new Date().toISOString(),
          });

          // Log remaining as stopped
          for (let j = i + 1; j < evaluations.length; j++) {
            const remaining = evaluations[j];
            const remStudent = remaining.student as any;
            const remSkill = remaining.skill_sheet as any;
            const remLabDay = remaining.lab_day as any;
            log.push({
              eval_id: remaining.id,
              student_email: remStudent?.email ?? '(none)',
              student_name: remStudent ? `${remStudent.last_name}, ${remStudent.first_name}` : 'Unknown',
              skill: remSkill?.skill_name || 'Unknown',
              lab_day: remLabDay ? `${remLabDay.title || 'Untitled'} (${remLabDay.date})` : 'No lab day',
              status: 'stopped',
              reason: 'Batch stopped due to previous error',
              timestamp: new Date().toISOString(),
            });
          }

          // Return immediately — batch stopped
          return NextResponse.json({
            success: false,
            error: 'Batch stopped due to email send failure',
            total_remaining: totalRemaining,
            batch_size: batchSize,
            sent,
            errors,
            skipped,
            stopped_at_index: i,
            has_more: true,
            next_offset: offset,  // Retry from same offset since failed ones aren't updated
            log,
          });
        }

        // Rate limit: 500ms delay between sends
        if (i < evaluations.length - 1) {
          await sleep(DELAY_MS);
        }
      } catch (err) {
        // On unexpected error: STOP the batch
        errors++;
        log.push({
          eval_id: evaluation.id,
          student_email: studentEmail,
          student_name: studentName,
          skill: skillName,
          lab_day: labDayLabel,
          status: 'error',
          reason: `Exception: ${err instanceof Error ? err.message : String(err)}`,
          timestamp: new Date().toISOString(),
        });

        return NextResponse.json({
          success: false,
          error: `Batch stopped due to exception: ${err instanceof Error ? err.message : String(err)}`,
          total_remaining: totalRemaining,
          batch_size: batchSize,
          sent,
          errors,
          skipped,
          stopped_at_index: i,
          has_more: true,
          next_offset: offset,
          log,
        });
      }
    }

    // Calculate if there are more batches
    const processedInBatch = sent + skipped;
    const hasMore = totalRemaining > processedInBatch;

    return NextResponse.json({
      success: true,
      total_remaining: totalRemaining - processedInBatch,
      batch_size: batchSize,
      sent,
      errors,
      skipped,
      has_more: hasMore,
      next_offset: hasMore ? 0 : null, // Always 0 since processed items change status
      log,
    });
  } catch (err) {
    console.error('[send-queued-emails] Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
