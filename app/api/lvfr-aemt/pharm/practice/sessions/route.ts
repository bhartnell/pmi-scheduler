import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// GET /api/lvfr-aemt/pharm/practice/sessions
//
// List recent practice sessions for instructors (admin/instructor+).
// Returns most recent 100 sessions, ordered by submission time.
// ---------------------------------------------------------------------------
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (!hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Instructor access required' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data: sessions, error } = await supabase
    .from('lvfr_aemt_pharm_practice_sessions')
    .select('id, student_name, student_identifier, difficulty_level, score_percent, passed, submitted_at')
    .order('submitted_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sessions: sessions || [] });
}
