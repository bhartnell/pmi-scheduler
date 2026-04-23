import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

/**
 * POST /api/scheduling/unavailable-days
 *
 * Admin-only setter for lab_users.unavailable_weekdays. Takes an array
 * of JS-weekday numbers (0=Sun, 6=Sat) the user is never available
 * to work.
 *
 * Body: { user_id: string, weekdays: number[] | null }
 *   weekdays = []     → clear the setting (user has no weekly restriction)
 *   weekdays = [2,3]  → Tue + Wed blocked (Gannon's full-time job)
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
    const { user_id, weekdays } = body as {
      user_id?: string;
      weekdays?: number[] | null;
    };

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    let normalized: number[] | null = null;
    if (Array.isArray(weekdays)) {
      const validated = weekdays
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
      normalized = validated.length > 0 ? Array.from(new Set(validated)).sort() : [];
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('lab_users')
      .update({
        unavailable_weekdays:
          normalized == null || normalized.length === 0 ? null : normalized,
      })
      .eq('id', user_id)
      .select('id, unavailable_weekdays')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
