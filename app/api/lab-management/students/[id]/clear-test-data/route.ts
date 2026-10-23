import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import { logAuditEvent } from '@/lib/audit';

/**
 * POST /api/lab-management/students/[id]/clear-test-data
 *
 * Admin action for a test student (students.is_test): clears its
 * pre-internship self-assessment submission and exam signups so it can be
 * re-run clean for the next QA pass. Refuses on any non-test student, and
 * never touches the students row itself (STUDENT VIEW 4/4 item e).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();
    const { data: student, error: sErr } = await supabase
      .from('students')
      .select('id, email, first_name, last_name, is_test')
      .eq('id', id)
      .single();
    if (sErr || !student) {
      return NextResponse.json({ success: false, error: 'Student not found' }, { status: 404 });
    }
    if (!student.is_test) {
      return NextResponse.json(
        { success: false, error: 'This action is for test students only.' },
        { status: 403 }
      );
    }

    const { count: signupsCleared, error: signupsErr } = await supabase
      .from('exam_signups')
      .delete({ count: 'exact' })
      .eq('student_id', id);
    if (signupsErr) throw signupsErr;

    // preinternship_responses is keyed by lab_users.id, not students.id (see
    // lib/preinternship-server.ts) — a test student only has a lab_users row
    // if it has already saved a self-assessment at least once.
    let responseCleared = false;
    if (student.email) {
      const { data: labUser } = await supabase
        .from('lab_users')
        .select('id')
        .ilike('email', student.email)
        .maybeSingle();
      if (labUser) {
        const { data: deleted, error: respErr } = await supabase
          .from('preinternship_responses')
          .update({ deleted_at: new Date().toISOString() })
          .eq('user_id', labUser.id)
          .is('deleted_at', null)
          .select('id');
        if (respErr) throw respErr;
        responseCleared = (deleted?.length ?? 0) > 0;
      }
    }

    await logAuditEvent({
      user: { id: user.id, email: user.email, role: user.role },
      action: 'delete',
      resourceType: 'student',
      resourceId: id,
      resourceDescription: `Cleared test data for ${student.first_name} ${student.last_name} (self-assessment: ${responseCleared ? 'cleared' : 'none to clear'}; exam signups cleared: ${signupsCleared ?? 0})`,
    }).catch(() => {});

    return NextResponse.json({ success: true, responseCleared, signupsCleared: signupsCleared ?? 0 });
  } catch (error) {
    console.error('Error clearing test data:', error);
    return NextResponse.json({ success: false, error: 'Failed to clear test data' }, { status: 500 });
  }
}
