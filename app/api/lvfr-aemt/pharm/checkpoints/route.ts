import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { scoreCheckpoint, getBlankedFields } from '@/lib/pharm-scoring';
import { logRecordAccess } from '@/lib/ferpa';

// ---------------------------------------------------------------------------
// GET /api/lvfr-aemt/pharm/checkpoints
//
// List student's checkpoint history. Students see own; instructors see all.
// Query: ?student_id=... (optional, instructor only)
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const supabase = getSupabaseAdmin();
  const studentId = request.nextUrl.searchParams.get('student_id');

  let query = supabase
    .from('lvfr_aemt_pharm_checkpoints')
    .select('*')
    .order('created_at', { ascending: false });

  if (user.role === 'student') {
    // Students see own checkpoints only — need to find their student record
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .ilike('email', user.email)
      .single();

    if (!student) {
      return NextResponse.json({ checkpoints: [] });
    }
    query = query.eq('student_id', student.id);
  } else if (studentId && hasMinRole(user.role, 'instructor')) {
    query = query.eq('student_id', studentId);
  }

  const { data: checkpoints, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ checkpoints: checkpoints || [] });
}

// ---------------------------------------------------------------------------
// POST /api/lvfr-aemt/pharm/checkpoints
//
// Submit a completed checkpoint for scoring.
// Body: { difficulty_level, responses: [{ medication_id, answers: { field: value } }] }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const body = await request.json();
  const { difficulty_level, responses } = body;

  if (!difficulty_level || !responses || !Array.isArray(responses)) {
    return NextResponse.json(
      { error: 'difficulty_level and responses array are required' },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  // Get the student record
  const { data: student } = await supabase
    .from('students')
    .select('id')
    .ilike('email', user.email)
    .single();

  // Fetch all medications for scoring
  const { data: medications } = await supabase
    .from('lvfr_aemt_medications')
    .select('*');

  if (!medications || medications.length === 0) {
    return NextResponse.json({ error: 'No medications found' }, { status: 500 });
  }

  // Determine which fields are blanked based on difficulty
  // Use checkpoint_blanks from the first medication as the template
  const blanksTemplate = medications[0].checkpoint_blanks || [];
  const blankedFields = getBlankedFields(blanksTemplate, difficulty_level);

  // Score the checkpoint
  const result = scoreCheckpoint(responses, medications, blankedFields);

  // Save to database
  const medicationsTested = responses.map((r: { medication_id: string }) => r.medication_id);

  const { data: checkpoint, error } = await supabase
    .from('lvfr_aemt_pharm_checkpoints')
    .insert({
      student_id: student?.id || null,
      practitioner_email: user.email,
      checkpoint_date: new Date().toISOString().split('T')[0],
      difficulty_level,
      medications_tested: medicationsTested,
      responses: { answers: responses, blanked_fields: blankedFields },
      score_percent: result.totalScore,
      passed: result.passed,
      completed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log access
  logRecordAccess({
    userEmail: user.email,
    userRole: user.role,
    studentId: student?.id,
    dataType: 'pharm',
    action: 'modify',
    route: '/api/lvfr-aemt/pharm/checkpoints',
    details: { difficulty_level, score: result.totalScore, passed: result.passed },
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    checkpoint,
    scoring: {
      totalScore: result.totalScore,
      passed: result.passed,
      perMedication: result.perMedication,
      blankedFields,
    },
  });
}
