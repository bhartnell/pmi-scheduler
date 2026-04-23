import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

/**
 * POST /api/scheduling/hours-target
 *
 * Sets lab_users.monthly_hours_target for a single user. Called from
 * the part-timer status page when an admin adjusts someone's target.
 *
 * Body: { user_id: string, target: number | null }
 *   target = null  → clear the target (no progress bar rendered)
 *   target = N     → per-user monthly goal, used by the progress bar
 *
 * Admin+/lead_instructor+ only.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    if (!hasMinRole(user.role, 'lead_instructor')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { user_id, target } = body as {
      user_id?: string;
      target?: number | null;
    };

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    const normalized: number | null =
      target == null
        ? null
        : typeof target === 'number' && target > 0 && target <= 400
        ? Math.round(target)
        : null;

    if (target != null && normalized == null) {
      return NextResponse.json(
        { error: 'target must be a positive integer ≤ 400, or null to clear' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('lab_users')
      .update({ monthly_hours_target: normalized })
      .eq('id', user_id)
      .select('id, monthly_hours_target')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user: data,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
