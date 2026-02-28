import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

/**
 * GET /api/peer-evaluations
 * - Students: returns evaluations they have given and evaluations they have received
 * - Instructors/Admins: returns all evaluations, optionally filtered by lab_day_id
 *
 * Query params:
 *   ?lab_day_id=<uuid>   - filter by lab day (instructor)
 *   ?view=given          - student: evaluations given by this student
 *   ?view=received       - student: evaluations received by this student
 *
 * POST /api/peer-evaluations
 * Submit a peer evaluation.
 * Body: { lab_day_id?, evaluated_student_id, is_self_eval?, communication_score, teamwork_score, leadership_score, comments? }
 */

async function getCurrentLabUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

async function getStudentRecord(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('students')
    .select('id, first_name, last_name, email, cohort_id')
    .ilike('email', email)
    .single();
  return data;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const labUser = await getCurrentLabUser(session.user.email);
    if (!labUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const labDayId = searchParams.get('lab_day_id');
    const view = searchParams.get('view'); // 'given' | 'received'

    const isInstructor = hasMinRole(labUser.role, 'instructor');

    // --- Instructor / Admin view ---
    if (isInstructor) {
      let query = supabase
        .from('peer_evaluations')
        .select(`
          id,
          lab_day_id,
          is_self_eval,
          communication_score,
          teamwork_score,
          leadership_score,
          comments,
          created_at,
          evaluator:students!peer_evaluations_evaluator_id_fkey(id, first_name, last_name),
          evaluated:students!peer_evaluations_evaluated_id_fkey(id, first_name, last_name),
          lab_day:lab_days!peer_evaluations_lab_day_id_fkey(id, date, title)
        `)
        .order('created_at', { ascending: false });

      if (labDayId) {
        query = query.eq('lab_day_id', labDayId);
      }

      const { data: evaluations, error } = await query;
      if (error) throw error;

      return NextResponse.json({ success: true, evaluations: evaluations || [] });
    }

    // --- Student view ---
    if (labUser.role !== 'student') {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const student = await getStudentRecord(session.user.email);
    if (!student) {
      return NextResponse.json(
        { success: false, error: 'Student record not found. Contact your instructor.' },
        { status: 404 }
      );
    }

    if (view === 'given') {
      // Evaluations this student has submitted
      const { data: given, error } = await supabase
        .from('peer_evaluations')
        .select(`
          id,
          lab_day_id,
          is_self_eval,
          communication_score,
          teamwork_score,
          leadership_score,
          comments,
          created_at,
          evaluated:students!peer_evaluations_evaluated_id_fkey(id, first_name, last_name),
          lab_day:lab_days!peer_evaluations_lab_day_id_fkey(id, date, title)
        `)
        .eq('evaluator_id', student.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return NextResponse.json({ success: true, evaluations: given || [] });
    }

    if (view === 'received') {
      // Evaluations this student has received (anonymized - no evaluator info)
      const { data: received, error } = await supabase
        .from('peer_evaluations')
        .select(`
          id,
          lab_day_id,
          is_self_eval,
          communication_score,
          teamwork_score,
          leadership_score,
          comments,
          created_at,
          lab_day:lab_days!peer_evaluations_lab_day_id_fkey(id, date, title)
        `)
        .eq('evaluated_id', student.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return NextResponse.json({ success: true, evaluations: received || [] });
    }

    // Default: return both given and received
    const [givenRes, receivedRes] = await Promise.all([
      supabase
        .from('peer_evaluations')
        .select(`
          id,
          lab_day_id,
          is_self_eval,
          communication_score,
          teamwork_score,
          leadership_score,
          comments,
          created_at,
          evaluated:students!peer_evaluations_evaluated_id_fkey(id, first_name, last_name),
          lab_day:lab_days!peer_evaluations_lab_day_id_fkey(id, date, title)
        `)
        .eq('evaluator_id', student.id)
        .order('created_at', { ascending: false }),

      supabase
        .from('peer_evaluations')
        .select(`
          id,
          lab_day_id,
          is_self_eval,
          communication_score,
          teamwork_score,
          leadership_score,
          comments,
          created_at,
          lab_day:lab_days!peer_evaluations_lab_day_id_fkey(id, date, title)
        `)
        .eq('evaluated_id', student.id)
        .order('created_at', { ascending: false }),
    ]);

    if (givenRes.error) throw givenRes.error;
    if (receivedRes.error) throw receivedRes.error;

    return NextResponse.json({
      success: true,
      given: givenRes.data || [],
      received: receivedRes.data || [],
      student: {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        cohort_id: student.cohort_id,
      },
    });
  } catch (error) {
    console.error('Error fetching peer evaluations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch evaluations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const labUser = await getCurrentLabUser(session.user.email);
    if (!labUser || labUser.role !== 'student') {
      return NextResponse.json(
        { success: false, error: 'Only students can submit peer evaluations' },
        { status: 403 }
      );
    }

    const student = await getStudentRecord(session.user.email);
    if (!student) {
      return NextResponse.json(
        { success: false, error: 'Student record not found. Contact your instructor.' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      lab_day_id,
      evaluated_student_id,
      is_self_eval = false,
      communication_score,
      teamwork_score,
      leadership_score,
      comments,
    } = body;

    // Validate required fields
    if (!evaluated_student_id) {
      return NextResponse.json(
        { success: false, error: 'evaluated_student_id is required' },
        { status: 400 }
      );
    }

    const scores = [communication_score, teamwork_score, leadership_score];
    for (const score of scores) {
      if (score === undefined || score === null || score < 1 || score > 5) {
        return NextResponse.json(
          { success: false, error: 'All three scores (communication, teamwork, leadership) must be between 1 and 5' },
          { status: 400 }
        );
      }
    }

    // Self-eval: evaluator and evaluated are the same student
    const effectiveEvaluatedId = is_self_eval ? student.id : evaluated_student_id;

    // Prevent evaluating someone outside the student's cohort (basic integrity check)
    if (!is_self_eval) {
      const { data: evaluatedStudent } = await supabase
        .from('students')
        .select('id, cohort_id')
        .eq('id', effectiveEvaluatedId)
        .single();

      if (!evaluatedStudent) {
        return NextResponse.json(
          { success: false, error: 'Evaluated student not found' },
          { status: 404 }
        );
      }
    }

    // Check for duplicate eval (same evaluator + evaluated + lab_day)
    let duplicateQuery = supabase
      .from('peer_evaluations')
      .select('id')
      .eq('evaluator_id', student.id)
      .eq('evaluated_id', effectiveEvaluatedId);

    if (lab_day_id) {
      duplicateQuery = duplicateQuery.eq('lab_day_id', lab_day_id);
    }

    const { data: duplicate } = await duplicateQuery.maybeSingle();
    if (duplicate) {
      return NextResponse.json(
        { success: false, error: 'You have already submitted an evaluation for this student for this lab day' },
        { status: 409 }
      );
    }

    const { data: evaluation, error } = await supabase
      .from('peer_evaluations')
      .insert({
        lab_day_id: lab_day_id || null,
        evaluator_id: student.id,
        evaluated_id: effectiveEvaluatedId,
        is_self_eval,
        communication_score: Number(communication_score),
        teamwork_score: Number(teamwork_score),
        leadership_score: Number(leadership_score),
        comments: comments?.trim() || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, evaluation }, { status: 201 });
  } catch (error) {
    console.error('Error submitting peer evaluation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit evaluation' },
      { status: 500 }
    );
  }
}
