import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAgencyRole, canEditLVFR } from '@/lib/permissions';
import { logRecordAccess } from '@/lib/ferpa';

// ---------------------------------------------------------------------------
// POST /api/lvfr-aemt/skills/attempts
//
// Log a skill attempt for a student. Instructor+ only.
// Body: { student_id, skill_id, result: 'pass'|'fail', notes?, date? }
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
  const { student_id, skill_id, result, notes, date } = body;

  if (!student_id || !skill_id || !result) {
    return NextResponse.json({ error: 'student_id, skill_id, and result are required' }, { status: 400 });
  }
  if (!['pass', 'fail'].includes(result)) {
    return NextResponse.json({ error: 'result must be "pass" or "fail"' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Verify student exists
  const { data: student } = await supabase
    .from('students')
    .select('id')
    .eq('id', student_id)
    .single();
  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }

  // Fetch skill for min_practice_attempts
  const { data: skill } = await supabase
    .from('lvfr_aemt_skills')
    .select('id, min_practice_attempts')
    .eq('id', skill_id)
    .single();
  if (!skill) {
    return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
  }

  // Get current status or create
  const { data: existingStatus } = await supabase
    .from('lvfr_aemt_skill_status')
    .select('*')
    .eq('student_id', student_id)
    .eq('skill_id', skill_id)
    .single();

  const currentAttempts = existingStatus?.total_attempts || 0;
  const newAttemptNumber = currentAttempts + 1;
  const attemptDate = date || new Date().toISOString().split('T')[0];

  // Find evaluator lab_users id
  const { data: evaluator } = await supabase
    .from('lab_users')
    .select('id')
    .ilike('email', user.email)
    .single();

  // Create attempt record
  const { data: attempt, error: attemptError } = await supabase
    .from('lvfr_aemt_skill_attempts')
    .insert({
      student_id,
      skill_id,
      attempt_number: newAttemptNumber,
      date: attemptDate,
      evaluator_id: evaluator?.id || null,
      result,
      notes: notes || null,
    })
    .select()
    .single();

  if (attemptError) {
    return NextResponse.json({ error: attemptError.message }, { status: 500 });
  }

  // Compute new status
  const minAttempts = skill.min_practice_attempts || 1;
  let newStatus: string;

  if (result === 'pass' && newAttemptNumber >= minAttempts) {
    newStatus = 'satisfactory';
  } else if (result === 'pass') {
    newStatus = 'in_progress';
  } else {
    // fail
    newStatus = existingStatus?.status === 'satisfactory' ? 'needs_remediation' : 'in_progress';
  }

  // Upsert skill status
  const statusData: Record<string, unknown> = {
    student_id,
    skill_id,
    status: newStatus,
    total_attempts: newAttemptNumber,
    last_attempt_date: attemptDate,
  };
  if (newStatus === 'satisfactory') {
    statusData.completed_date = attemptDate;
  }

  const { error: statusError } = await supabase
    .from('lvfr_aemt_skill_status')
    .upsert(statusData, { onConflict: 'student_id,skill_id' });

  if (statusError) {
    return NextResponse.json({ error: statusError.message }, { status: 500 });
  }

  // Log access
  logRecordAccess({
    userEmail: user.email, userRole: user.role,
    dataType: 'skills', action: 'modify',
    route: '/api/lvfr-aemt/skills/attempts',
    details: { student_id, skill_id, result, attempt_number: newAttemptNumber },
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    attempt,
    newStatus,
    totalAttempts: newAttemptNumber,
  });
}
