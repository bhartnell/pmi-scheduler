import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// ---------------------------------------------------------------------------
// GET /api/skill-sheets/evaluations-by-lab-day?lab_day_id=UUID
//
// Returns all student_skill_evaluations for a given lab day, joined with
// skill_sheets (skill_name), students (first_name, last_name), and
// lab_users as evaluator (name).
// Requires instructor+ role.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !hasMinRole(currentUser.role, 'instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const labDayId = request.nextUrl.searchParams.get('lab_day_id');
    if (!labDayId) {
      return NextResponse.json(
        { success: false, error: 'lab_day_id query parameter is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: evaluations, error } = await supabase
      .from('student_skill_evaluations')
      .select(`
        id,
        evaluation_type,
        result,
        notes,
        flagged_items,
        step_details,
        created_at,
        skill_sheet:skill_sheets(id, skill_name),
        student:students(id, first_name, last_name),
        evaluator:lab_users!student_skill_evaluations_evaluator_id_fkey(id, name)
      `)
      .eq('lab_day_id', labDayId)
      .order('created_at', { ascending: false });

    if (error) {
      // Table may not exist yet
      if (error.message?.includes('does not exist')) {
        return NextResponse.json({ success: true, evaluations: [] });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      evaluations: evaluations || [],
    });
  } catch (err) {
    console.error('Error fetching evaluations by lab day:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
