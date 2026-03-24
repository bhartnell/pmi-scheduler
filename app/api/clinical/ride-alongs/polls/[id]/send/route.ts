import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import { sendEmail } from '@/lib/email';

const APP_URL = process.env.NEXTAUTH_URL || 'https://pmiparamedic.tools';

// POST /api/clinical/ride-alongs/polls/[id]/send — send poll link to students
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { mode } = body; // 'all' or 'non_responders'

    // Get poll
    const { data: poll, error: pollError } = await supabase
      .from('ride_along_polls')
      .select('*')
      .eq('id', id)
      .single();

    if (pollError || !poll) {
      return NextResponse.json(
        { success: false, error: 'Poll not found' },
        { status: 404 }
      );
    }

    if (!poll.cohort_id) {
      return NextResponse.json(
        { success: false, error: 'Poll has no cohort assigned' },
        { status: 400 }
      );
    }

    // Get all active students in cohort
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, first_name, last_name, email')
      .eq('cohort_id', poll.cohort_id)
      .eq('status', 'active');

    if (studentsError) throw studentsError;

    if (!students || students.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No active students found in this cohort' },
        { status: 404 }
      );
    }

    let recipientStudents = students;

    // If mode is non_responders, filter out students who already submitted
    if (mode === 'non_responders') {
      const studentIds = students.map(s => s.id);

      let availQuery = supabase
        .from('ride_along_availability')
        .select('student_id')
        .in('student_id', studentIds);

      if (poll.cohort_id) availQuery = availQuery.eq('cohort_id', poll.cohort_id);

      const { data: responded } = await availQuery;
      const respondedIds = new Set((responded || []).map(r => r.student_id));

      recipientStudents = students.filter(s => !respondedIds.has(s.id));

      if (recipientStudents.length === 0) {
        return NextResponse.json({
          success: true,
          sent: 0,
          message: 'All students have already responded',
        });
      }
    }

    const pollUrl = `${APP_URL}/ride-along-poll/${poll.token}`;
    const deadlineStr = poll.deadline
      ? new Date(poll.deadline).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : 'as soon as possible';

    // Send emails
    let sentCount = 0;
    let failedCount = 0;

    for (const student of recipientStudents) {
      if (!student.email) {
        failedCount++;
        continue;
      }

      const result = await sendEmail({
        to: student.email,
        subject: `EMT Ride-Along Availability — Please Submit by ${deadlineStr}`,
        template: 'general',
        data: {
          subject: `EMT Ride-Along Availability — Please Submit by ${deadlineStr}`,
          title: 'Ride-Along Availability',
          message: `Hi ${student.first_name},<br><br>Please submit your ride-along availability for the upcoming semester. Click the button below to fill out the form.<br><br><strong>Deadline:</strong> ${deadlineStr}`,
          actionUrl: pollUrl,
          actionText: 'Submit Your Availability',
        },
      });

      if (result.success) {
        sentCount++;
      } else {
        failedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      failed: failedCount,
      total: recipientStudents.length,
    });
  } catch (error) {
    console.error('Error sending ride-along poll emails:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send poll emails' },
      { status: 500 }
    );
  }
}
