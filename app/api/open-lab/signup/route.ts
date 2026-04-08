import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { session_id, student_name, student_email, program_level, what_to_work_on, requested_instructor_id } = body;

    // Validate required fields
    if (!session_id || !student_name || !student_email || !program_level || !what_to_work_on) {
      return NextResponse.json(
        { error: 'Missing required fields: session_id, student_name, student_email, program_level, what_to_work_on' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Verify session exists and is not cancelled
    const { data: session, error: sessionError } = await supabase
      .from('open_lab_sessions')
      .select('id, date, start_time, end_time, is_cancelled')
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.is_cancelled) {
      return NextResponse.json({ error: 'This session has been cancelled' }, { status: 400 });
    }

    // Try to auto-link student_user_id by matching email
    let studentUserId: string | null = null;
    const { data: labUser } = await supabase
      .from('lab_users')
      .select('id')
      .ilike('email', student_email)
      .single();

    if (labUser) {
      studentUserId = labUser.id;
    }

    // Insert signup
    const { data: signup, error: insertError } = await supabase
      .from('open_lab_signups')
      .insert({
        session_id,
        student_name,
        student_email,
        student_user_id: studentUserId,
        program_level,
        what_to_work_on,
        requested_instructor_id: requested_instructor_id || null,
        notification_sent: false,
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('Error creating signup:', insertError);
      return NextResponse.json({ error: 'Failed to create signup' }, { status: 500 });
    }

    // Send notification to requested instructor if applicable
    if (requested_instructor_id) {
      try {
        const { data: instructor } = await supabase
          .from('lab_users')
          .select('id, name, email')
          .eq('id', requested_instructor_id)
          .single();

        if (instructor?.email) {
          const sessionDate = new Date(session.date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });

          await sendEmail({
            to: instructor.email,
            subject: `Open Lab Request from ${student_name}`,
            template: 'general',
            data: {
              title: 'Open Lab Request',
              message: `${student_name} has signed up for Open Lab on ${sessionDate} and requested your assistance. They would like to work on: ${what_to_work_on}. This is a request only and does not commit you to attend.`,
              actionUrl: 'https://www.pmiparamedic.tools/admin/open-labs',
              actionText: 'View All Signups',
            },
          });

          // Update notification_sent
          await supabase
            .from('open_lab_signups')
            .update({ notification_sent: true })
            .eq('id', signup.id);

          signup.notification_sent = true;
        }
      } catch (emailErr) {
        console.error('Error sending instructor notification:', emailErr);
        // Don't fail the signup if email fails
      }
    }

    return NextResponse.json({ signup }, { status: 201 });
  } catch (err) {
    console.error('Open lab signup error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
