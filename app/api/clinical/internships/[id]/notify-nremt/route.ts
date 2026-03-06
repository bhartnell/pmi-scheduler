import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { createNotification } from '@/lib/notifications';
import { sendEmail } from '@/lib/email';
import { requireAuth } from '@/lib/api-auth';

const RYAN_EMAIL = 'ryan@pmi.edu';

async function getCallerRole(email: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', email)
    .single();
  return data?.role ?? null;
}

// POST - Send NREMT clearance notification to Ryan
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();

    const auth = await requireAuth('instructor');

    if (auth instanceof NextResponse) return auth;

    const { user, session } = auth;

    const callerRole = await getCallerRole(session.user.email);
    if (!callerRole || !hasMinRole(callerRole, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Fetch the internship with student info
    const { data: internship, error: fetchError } = await supabase
      .from('student_internships')
      .select(`
        *,
        students (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError || !internship) {
      return NextResponse.json({ success: false, error: 'Internship not found' }, { status: 404 });
    }

    const studentName = internship.students
      ? `${internship.students.first_name} ${internship.students.last_name}`
      : 'Unknown Student';

    // Mark as notified in the database
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    const { error: updateError } = await supabase
      .from('student_internships')
      .update({
        ryan_notified: true,
        ryan_notified_date: today,
        updated_at: now,
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating ryan_notified:', updateError.message);
      return NextResponse.json({ success: false, error: 'Failed to update notification status' }, { status: 500 });
    }

    // Create in-app notification for Ryan
    const notifResult = await createNotification({
      userEmail: RYAN_EMAIL,
      title: 'NREMT Clearance Review Needed',
      message: `${studentName} is ready for NREMT clearance review.`,
      type: 'clinical_hours',
      category: 'clinical',
      linkUrl: `/clinical/internships/${id}`,
      referenceType: 'student_internship',
      referenceId: id,
    });

    if (!notifResult.success) {
      console.error('Failed to create in-app notification for Ryan:', notifResult.error);
    }

    // Send email notification to Ryan
    try {
      await sendEmail({
        to: RYAN_EMAIL,
        subject: `[PMI] NREMT Clearance Review: ${studentName}`,
        template: 'general',
        data: {
          subject: `NREMT Clearance Review: ${studentName}`,
          title: 'NREMT Clearance Review Needed',
          message: `${studentName} has completed all required internship items and is ready for NREMT clearance review. Please review their internship record and mark them as cleared when approved.`,
          actionUrl: `${process.env.NEXTAUTH_URL || 'https://pmiparamedic.tools'}/clinical/internships/${id}`,
          actionText: 'Review Internship',
        },
      });
    } catch (emailError) {
      console.error('Failed to send NREMT notification email to Ryan:', emailError);
      // Don't fail the whole request if email fails - the in-app notification was created
    }

    return NextResponse.json({
      success: true,
      message: `Notification sent to Ryan for ${studentName}`,
    });
  } catch (error) {
    console.error('Error in notify-nremt POST:', error);
    return NextResponse.json({ success: false, error: 'Failed to send notification' }, { status: 500 });
  }
}
