import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole, isAgencyRole } from '@/lib/permissions';
import { logRecordAccess, checkFerpaRelease } from '@/lib/ferpa';

// ---------------------------------------------------------------------------
// GET /api/lvfr-aemt/skills/[studentId]
//
// All skills with detailed attempt history for a specific student.
// Auth: instructor+, agency_liaison (FERPA check), student (own only)
// ---------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const supabase = getSupabaseAdmin();

  // Student: own only
  if (user.role === 'student') {
    const { data: ownStudent } = await supabase
      .from('students')
      .select('id')
      .ilike('email', user.email)
      .single();
    if (!ownStudent || ownStudent.id !== studentId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
  } else if (user.role === 'agency_observer') {
    return NextResponse.json({ error: 'Use /api/lvfr-aemt/skills/summary for cohort data' }, { status: 403 });
  } else if (user.role === 'agency_liaison') {
    const { data: student } = await supabase
      .from('students')
      .select('id, ferpa_agency_release, ferpa_release_agency')
      .eq('id', studentId)
      .single();
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }
    const userAgency = (user as unknown as Record<string, unknown>).agency_affiliation as string | null || null;
    if (!checkFerpaRelease(student, userAgency)) {
      return NextResponse.json({ error: 'FERPA release not granted' }, { status: 403 });
    }
    logRecordAccess({
      userEmail: user.email, userRole: user.role,
      dataType: 'skills', action: 'view',
      route: `/api/lvfr-aemt/skills/${studentId}`,
      details: { student_id: studentId },
    }).catch(() => {});
  } else if (!hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  // Fetch all skills
  const { data: skills } = await supabase
    .from('lvfr_aemt_skills')
    .select('*')
    .order('category')
    .order('name');

  // Fetch statuses for this student
  const { data: statuses } = await supabase
    .from('lvfr_aemt_skill_status')
    .select('*')
    .eq('student_id', studentId);

  // Fetch all attempts for this student
  const { data: attempts } = await supabase
    .from('lvfr_aemt_skill_attempts')
    .select(`
      id, skill_id, attempt_number, date, result, notes, created_at,
      evaluator:lab_users!lvfr_aemt_skill_attempts_evaluator_id_fkey(name)
    `)
    .eq('student_id', studentId)
    .order('date', { ascending: false })
    .order('attempt_number', { ascending: false });

  // Build status map
  const statusMap = new Map<string, Record<string, unknown>>();
  for (const s of statuses || []) {
    statusMap.set(s.skill_id, s);
  }

  // Group attempts by skill
  const attemptsBySkill = new Map<string, typeof attempts>();
  for (const a of attempts || []) {
    if (!attemptsBySkill.has(a.skill_id)) {
      attemptsBySkill.set(a.skill_id, []);
    }
    attemptsBySkill.get(a.skill_id)!.push(a);
  }

  // Combine into response
  const skillDetails = (skills || []).map(skill => ({
    ...skill,
    status: statusMap.get(skill.id) || {
      status: 'not_started',
      total_attempts: 0,
      last_attempt_date: null,
      completed_date: null,
    },
    attempts: attemptsBySkill.get(skill.id) || [],
  }));

  // Fetch student info
  const { data: studentInfo } = await supabase
    .from('students')
    .select('id, first_name, last_name')
    .eq('id', studentId)
    .single();

  return NextResponse.json({
    student: studentInfo,
    skills: skillDetails,
    summary: {
      total: (skills || []).length,
      satisfactory: (statuses || []).filter(s => s.status === 'satisfactory').length,
      in_progress: (statuses || []).filter(s => s.status === 'in_progress').length,
      needs_remediation: (statuses || []).filter(s => s.status === 'needs_remediation').length,
      not_started: (skills || []).length - (statuses || []).length,
    },
  });
}
