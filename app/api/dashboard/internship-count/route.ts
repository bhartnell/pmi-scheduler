import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole, type Role } from '@/lib/permissions';

/**
 * GET /api/dashboard/internship-count
 *
 * Lightweight count endpoint for the Overview and Program Snapshot
 * widgets. Returns the number of PM students currently in an active
 * internship phase (pre-internship through extended — NOT completed),
 * excluding withdrawn students.
 *
 * Gated to lead_instructor+ since this aggregates across cohorts.
 * Returns zeros for lower roles instead of 403 so the widget can
 * silently hide the tile without an error toast.
 */
export async function GET() {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    if (!hasMinRole(user.role as Role, 'lead_instructor')) {
      return NextResponse.json({
        success: true,
        counts: { active: 0, by_phase: {} },
      });
    }

    const supabase = getSupabaseAdmin();

    // Only current, non-completed, non-withdrawn internships.
    const { data, error } = await supabase
      .from('student_internships')
      .select(
        `current_phase,
         students!inner(status)`
      )
      .neq('students.status', 'withdrawn')
      .in('current_phase', [
        'pre_internship',
        'phase_1_mentorship',
        'phase_2_evaluation',
        'extended',
      ]);

    if (error) {
      console.error('[internship-count] query error', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const byPhase: Record<string, number> = {};
    for (const row of data ?? []) {
      const phase = (row as { current_phase: string }).current_phase;
      byPhase[phase] = (byPhase[phase] ?? 0) + 1;
    }

    return NextResponse.json({
      success: true,
      counts: {
        active: (data ?? []).length,
        by_phase: byPhase,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
