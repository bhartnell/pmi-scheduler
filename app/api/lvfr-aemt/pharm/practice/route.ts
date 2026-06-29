import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { scoreCheckpoint, getBlankedFields } from '@/lib/pharm-scoring';
import { headers } from 'next/headers';

// ---------------------------------------------------------------------------
// GET /api/lvfr-aemt/pharm/practice
//
// Return the medication list for the unauthenticated practice quiz.
// No auth required — medication data is educational/public knowledge.
// ---------------------------------------------------------------------------
export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data: medications, error } = await supabase
    .from('lvfr_aemt_medications')
    .select('*')
    .order('generic_name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ medications: medications || [] });
}

// ---------------------------------------------------------------------------
// POST /api/lvfr-aemt/pharm/practice
//
// Submit a practice checkpoint (no login required).
// Body: { student_name, student_identifier, difficulty_level, responses }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  let body: {
    student_name?: unknown;
    student_identifier?: unknown;
    difficulty_level?: unknown;
    responses?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { student_name, student_identifier, difficulty_level, responses } = body;

  // Validate inputs
  if (
    typeof student_name !== 'string' || student_name.trim().length < 2 || student_name.trim().length > 100
  ) {
    return NextResponse.json({ error: 'student_name must be 2–100 characters' }, { status: 400 });
  }
  if (
    typeof student_identifier !== 'string' || student_identifier.trim().length < 1 || student_identifier.trim().length > 50
  ) {
    return NextResponse.json({ error: 'student_identifier is required (max 50 chars)' }, { status: 400 });
  }
  if (typeof difficulty_level !== 'number' || ![1, 2, 3].includes(difficulty_level)) {
    return NextResponse.json({ error: 'difficulty_level must be 1, 2, or 3' }, { status: 400 });
  }
  if (!Array.isArray(responses) || responses.length === 0) {
    return NextResponse.json({ error: 'responses array is required' }, { status: 400 });
  }

  // Get IP for abuse monitoring (best-effort)
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  const supabase = getSupabaseAdmin();

  // Fetch medications for scoring
  const { data: medications } = await supabase
    .from('lvfr_aemt_medications')
    .select('*');

  if (!medications || medications.length === 0) {
    return NextResponse.json({ error: 'No medications configured' }, { status: 500 });
  }

  // Score the submission using the same logic as authenticated checkpoints
  const blanksTemplate = medications[0].checkpoint_blanks || [];
  const blankedFields = getBlankedFields(blanksTemplate, difficulty_level);
  const result = scoreCheckpoint(
    responses as Array<{ medication_id: string; answers: Record<string, string | string[]> }>,
    medications,
    blankedFields
  );

  // Persist the session
  const { data: session, error: insertError } = await supabase
    .from('lvfr_aemt_pharm_practice_sessions')
    .insert({
      student_name: student_name.trim(),
      student_identifier: student_identifier.trim(),
      difficulty_level,
      score_percent: result.totalScore,
      passed: result.passed,
      responses: { answers: responses, blanked_fields: blankedFields },
      ip_address: ip,
    })
    .select('id')
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    session_id: session?.id,
    scoring: {
      totalScore: result.totalScore,
      passed: result.passed,
      perMedication: result.perMedication,
      blankedFields,
    },
  });
}
