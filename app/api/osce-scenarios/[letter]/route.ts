import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import { hasMinRole, type Role } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// GET /api/osce-scenarios/[letter]
//
// Returns a single OSCE scenario by letter (A, B, D, E, F).
// instructor_notes is only included for admin or lead_instructor roles.
// Requires authenticated user.
// ---------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ letter: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const { letter } = await params;
    const upperLetter = letter.toUpperCase();

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('osce_scenarios')
      .select('*')
      .eq('scenario_letter', upperLetter)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    // Hide instructor_notes unless user is admin or lead_instructor
    const canSeeInstructorNotes = hasMinRole(user.role as Role, 'lead_instructor');
    if (!canSeeInstructorNotes) {
      data.instructor_notes = null;
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('OSCE scenario fetch error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
