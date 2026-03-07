import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// Characters for session code generation — excludes 0/O/1/I/L to avoid ambiguity
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

/**
 * Generate a random session code.
 */
function generateSessionCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

/**
 * Generate a unique session code, checking against the database for collisions.
 */
async function generateUniqueCode(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  maxAttempts = 10
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateSessionCode();
    const { data } = await supabase
      .from('case_sessions')
      .select('id')
      .eq('session_code', code)
      .limit(1)
      .maybeSingle();

    if (!data) {
      return code;
    }
  }
  throw new Error('Failed to generate a unique session code after multiple attempts');
}

// ---------------------------------------------------------------------------
// Helper — resolve current user from session email
// ---------------------------------------------------------------------------
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
// POST /api/case-sessions — Create a new classroom session
//
// Requires instructor+ role.
// Body: { case_id, cohort_id?, settings? }
// Returns: { session_code, session_id, qr_url }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !hasMinRole(currentUser.role, 'instructor')) {
      return NextResponse.json(
        { error: 'Instructor access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { case_id, cohort_id, settings } = body;

    if (!case_id) {
      return NextResponse.json(
        { error: 'case_id is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Verify the case exists and is accessible
    const { data: caseStudy, error: caseError } = await supabase
      .from('case_studies')
      .select('id, title')
      .eq('id', case_id)
      .eq('is_active', true)
      .single();

    if (caseError || !caseStudy) {
      return NextResponse.json(
        { error: 'Case study not found' },
        { status: 404 }
      );
    }

    // If cohort_id provided, verify it exists
    if (cohort_id) {
      const { data: cohort, error: cohortError } = await supabase
        .from('cohorts')
        .select('id')
        .eq('id', cohort_id)
        .single();

      if (cohortError || !cohort) {
        return NextResponse.json(
          { error: 'Cohort not found' },
          { status: 404 }
        );
      }
    }

    // Generate unique session code
    const sessionCode = await generateUniqueCode(supabase);

    // Merge user settings with defaults
    const defaultSettings = {
      show_leaderboard: true,
      show_results_live: false,
      anonymous: false,
      time_limit: null,
      allow_hints: true,
      speed_bonus: false,
      joined_students: [],
    };

    const mergedSettings = { ...defaultSettings, ...(settings || {}) };

    // Create the session
    const { data: newSession, error: insertError } = await supabase
      .from('case_sessions')
      .insert({
        case_id,
        session_code: sessionCode,
        instructor_email: session.user.email,
        cohort_id: cohort_id || null,
        status: 'waiting',
        current_phase: 0,
        current_question: 0,
        settings: mergedSettings,
      })
      .select('id, session_code')
      .single();

    if (insertError) {
      console.error('Error creating session:', insertError);
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    const qrUrl = `https://www.pmiparamedic.tools/cases/session/${sessionCode}/join`;

    return NextResponse.json(
      {
        success: true,
        session_id: newSession.id,
        session_code: newSession.session_code,
        qr_url: qrUrl,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating case session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
