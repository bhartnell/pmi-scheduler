import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { parseDateSafe } from '@/lib/utils';

async function getCallerRole(email: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', email)
    .single();
  return data?.role ?? null;
}

// GET - Fetch closeout checklist and documents for an internship
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const callerRole = await getCallerRole(session.user.email);
    if (!callerRole || !hasMinRole(callerRole, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Fetch the internship record
    const { data: internship, error: internshipError } = await supabase
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

    if (internshipError || !internship) {
      return NextResponse.json({ success: false, error: 'Internship not found' }, { status: 404 });
    }

    // Fetch clinical hours from student_clinical_hours (if available)
    let totalHours = 0;
    const requiredHours = 480;
    if (internship.student_id) {
      const { data: hoursRecord } = await supabase
        .from('student_clinical_hours')
        .select('total_hours')
        .eq('student_id', internship.student_id)
        .maybeSingle();
      if (hoursRecord?.total_hours) {
        totalHours = hoursRecord.total_hours;
      }
    }

    // Fetch closeout documents
    const { data: documents, error: docsError } = await supabase
      .from('closeout_documents')
      .select('*')
      .eq('internship_id', id)
      .order('uploaded_at', { ascending: false });

    if (docsError) {
      console.error('Error fetching closeout documents:', docsError.message);
    }

    // Build checklist
    const checklist = [
      {
        key: 'shifts_completed',
        label: 'All required shifts completed',
        auto_checked: totalHours >= requiredHours,
        manual_override: false,
        details: `${totalHours}/${requiredHours} hours`,
      },
      {
        key: 'final_eval_submitted',
        label: 'Final evaluation submitted',
        auto_checked: !!(internship.phase_2_eval_completed || internship.internship_completion_date),
        manual_override: false,
        details: internship.internship_completion_date
          ? `Completed ${parseDateSafe(internship.internship_completion_date).toLocaleDateString()}`
          : internship.phase_2_eval_completed
          ? 'Phase 2 eval completed'
          : '',
      },
      {
        key: 'preceptor_signoff',
        label: 'Preceptor sign-off received',
        auto_checked: !!(internship.phase_2_eval_completed),
        manual_override: false,
        details: internship.phase_2_eval_scheduled
          ? `Eval scheduled ${parseDateSafe(internship.phase_2_eval_scheduled).toLocaleDateString()}`
          : '',
      },
      {
        key: 'hours_verified',
        label: 'Clinical hours verified',
        auto_checked: totalHours >= requiredHours,
        manual_override: false,
        details: `${totalHours} total hours logged`,
      },
      {
        key: 'snhd_field_docs',
        label: 'SNHD field docs submitted',
        auto_checked: !!(internship.snhd_field_docs_submitted_at),
        manual_override: false,
        details: internship.snhd_field_docs_submitted_at
          ? `Submitted ${parseDateSafe(internship.snhd_field_docs_submitted_at).toLocaleDateString()}`
          : '',
      },
      {
        key: 'snhd_course_completion',
        label: 'SNHD course completion submitted',
        auto_checked: !!(internship.snhd_course_completion_submitted_at),
        manual_override: false,
        details: internship.snhd_course_completion_submitted_at
          ? `Submitted ${parseDateSafe(internship.snhd_course_completion_submitted_at).toLocaleDateString()}`
          : '',
      },
      {
        key: 'written_exam',
        label: 'Written exam passed',
        auto_checked: !!(internship.written_exam_passed),
        manual_override: false,
        details: internship.written_exam_date
          ? `Passed ${parseDateSafe(internship.written_exam_date).toLocaleDateString()}`
          : '',
      },
      {
        key: 'psychomotor_exam',
        label: 'Psychomotor exam passed',
        auto_checked: !!(internship.psychomotor_exam_passed),
        manual_override: false,
        details: internship.psychomotor_exam_date
          ? `Passed ${parseDateSafe(internship.psychomotor_exam_date).toLocaleDateString()}`
          : '',
      },
    ];

    return NextResponse.json({
      success: true,
      checklist,
      documents: documents || [],
      completed_at: internship.completed_at || null,
      completed_by: internship.completed_by || null,
    });
  } catch (error) {
    console.error('Error fetching closeout data:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch closeout data' }, { status: 500 });
  }
}

// POST - Mark internship as officially complete
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const callerRole = await getCallerRole(session.user.email);
    if (!callerRole || !hasMinRole(callerRole, 'admin')) {
      return NextResponse.json({ success: false, error: 'Forbidden - admin role required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { checklist } = body;

    // Validate all required checklist items are checked
    if (Array.isArray(checklist)) {
      const unchecked = checklist.filter(
        (item: { auto_checked: boolean; manual_override: boolean }) =>
          !item.auto_checked && !item.manual_override
      );
      if (unchecked.length > 0) {
        const labels = unchecked.map((i: { label: string }) => i.label).join(', ');
        return NextResponse.json(
          { success: false, error: `Cannot complete: the following items are not yet done: ${labels}` },
          { status: 400 }
        );
      }
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('student_internships')
      .update({
        completed_at: now,
        completed_by: session.user.email,
        updated_at: now,
      })
      .eq('id', id)
      .select('id, completed_at, completed_by')
      .single();

    if (error) {
      console.error('Error marking internship complete:', error.message);
      return NextResponse.json({ success: false, error: 'Failed to mark internship complete' }, { status: 500 });
    }

    return NextResponse.json({ success: true, internship: data });
  } catch (error) {
    console.error('Error in closeout POST:', error);
    return NextResponse.json({ success: false, error: 'Failed to complete internship closeout' }, { status: 500 });
  }
}
