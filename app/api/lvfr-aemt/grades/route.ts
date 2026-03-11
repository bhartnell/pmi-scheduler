import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole, isAgencyRole, canEditLVFR } from '@/lib/permissions';
import { logRecordAccess, checkFerpaRelease } from '@/lib/ferpa';
import { filterGradeForAgency } from '@/lib/ferpa-filter';

// ---------------------------------------------------------------------------
// GET /api/lvfr-aemt/grades
//
// List grades. Students see own; instructors see all or filtered.
// Agency roles see with FERPA check; observer gets empty (use /summary).
// Query: ?student_id=...&assessment_id=...&category=...
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const supabase = getSupabaseAdmin();
  const studentId = request.nextUrl.searchParams.get('student_id');
  const assessmentId = request.nextUrl.searchParams.get('assessment_id');
  const category = request.nextUrl.searchParams.get('category');

  // Agency observer: no individual grades — use /summary for aggregates
  if (user.role === 'agency_observer') {
    logRecordAccess({
      userEmail: user.email, userRole: user.role,
      dataType: 'grades', action: 'view',
      route: '/api/lvfr-aemt/grades',
      details: { result: 'cohort_aggregates_only' },
    }).catch(() => {});
    return NextResponse.json({ grades: [], message: 'Use /api/lvfr-aemt/grades/summary for cohort aggregates' });
  }

  let query = supabase
    .from('lvfr_aemt_grades')
    .select(`
      id, student_id, assessment_id, date_taken, score_percent, passed,
      questions_correct, questions_total, source, imported_at, created_at,
      assessment:lvfr_aemt_assessments(title, category, day_number, date, pass_score, question_count),
      student:students!lvfr_aemt_grades_student_id_fkey(id, first_name, last_name, email, ferpa_agency_release, ferpa_release_agency)
    `)
    .order('created_at', { ascending: false });

  // Student: own grades only
  if (user.role === 'student') {
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .ilike('email', user.email)
      .single();

    if (!student) {
      return NextResponse.json({ grades: [] });
    }
    query = query.eq('student_id', student.id);
  } else if (studentId) {
    query = query.eq('student_id', studentId);
  }

  if (assessmentId) {
    query = query.eq('assessment_id', assessmentId);
  }

  const { data: grades, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let filteredGrades: any[] = grades || [];

  // Filter by category (from joined assessment)
  if (category) {
    filteredGrades = filteredGrades.filter((g) => {
      return g.assessment?.category === category;
    });
  }

  // Agency liaison: FERPA filter per student
  if (user.role === 'agency_liaison') {
    const userAgency = (user as unknown as Record<string, unknown>).agency_affiliation as string | null || null;
    filteredGrades = filteredGrades.filter((g) => {
      const student = g.student as { ferpa_agency_release?: boolean; ferpa_release_agency?: string | null } | null;
      if (!student) return false;
      return checkFerpaRelease(
        { ferpa_agency_release: student.ferpa_agency_release, ferpa_release_agency: student.ferpa_release_agency },
        userAgency
      );
    }).map((g) => filterGradeForAgency(g, user.role));

    logRecordAccess({
      userEmail: user.email, userRole: user.role,
      dataType: 'grades', action: studentId ? 'view' : 'bulk_view',
      route: '/api/lvfr-aemt/grades',
      details: { student_id: studentId, count: filteredGrades.length },
    }).catch(() => {});
  }

  return NextResponse.json({ grades: filteredGrades });
}

// ---------------------------------------------------------------------------
// POST /api/lvfr-aemt/grades
//
// Manual grade entry. Instructor+ only. Agency roles denied.
// Body: { student_id, assessment_id, score_percent, questions_correct?,
//         questions_total?, date_taken? }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (isAgencyRole(user.role)) {
    return NextResponse.json({ error: 'Agency roles are read-only' }, { status: 403 });
  }
  if (!canEditLVFR(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json();
  const { student_id, assessment_id, score_percent, questions_correct, questions_total, date_taken } = body;

  if (!student_id || !assessment_id || score_percent == null) {
    return NextResponse.json(
      { error: 'student_id, assessment_id, and score_percent are required' },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  // Lookup assessment pass_score
  const { data: assessment } = await supabase
    .from('lvfr_aemt_assessments')
    .select('pass_score')
    .eq('id', assessment_id)
    .single();

  const passScore = assessment?.pass_score ?? 80;
  const passed = score_percent >= passScore;

  const { data: grade, error } = await supabase
    .from('lvfr_aemt_grades')
    .upsert(
      {
        student_id,
        assessment_id,
        date_taken: date_taken || new Date().toISOString().split('T')[0],
        score_percent,
        passed,
        questions_correct: questions_correct || null,
        questions_total: questions_total || null,
        source: 'manual',
      },
      { onConflict: 'student_id,assessment_id' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  logRecordAccess({
    userEmail: user.email,
    userRole: user.role,
    studentId: student_id,
    dataType: 'grades',
    action: 'modify',
    route: '/api/lvfr-aemt/grades',
    details: { assessment_id, score_percent, passed, source: 'manual' },
  }).catch(() => {});

  return NextResponse.json({ success: true, grade });
}
