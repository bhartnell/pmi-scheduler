import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

/**
 * /api/scheduling/manual-hours
 *
 * Reviewer-entered hours for part-time instructors whose work doesn't fit
 * the shift_signups flow (Gannon's class block + prep, Matt's online
 * classes, ad-hoc teaching by any part-timer).
 *
 * GET    → list rows for a given user_id (or all part-timers if the
 *          caller is admin+). Filterable by date window.
 * POST   → create a row. Accepts an optional recurrence block to expand
 *          the entry into N weekly copies (Gannon's semester class
 *          block becomes ~15 rows in one request).
 * DELETE → remove a row by id.
 *
 * Write gated to lead_instructor+, matching the RLS policy on
 * manual_hour_logs.
 */

const VALID_TYPES = new Set(['class', 'lab', 'prep', 'online', 'other']);

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const supabase = getSupabaseAdmin();
    const sp = request.nextUrl.searchParams;
    const userId = sp.get('user_id');
    const startDate = sp.get('start_date');
    const endDate = sp.get('end_date');

    // Non-admins can only see their own rows.
    const canSeeAll = hasMinRole(user.role, 'lead_instructor');
    const effectiveUserId = canSeeAll ? userId : user.id;

    let q = supabase
      .from('manual_hour_logs')
      .select(
        `id, user_id, logged_by, date, duration_minutes, entry_type, notes, created_at,
         user:lab_users!manual_hour_logs_user_id_fkey(id, name, email),
         logger:lab_users!manual_hour_logs_logged_by_fkey(id, name, email)`
      )
      .order('date', { ascending: false });

    if (effectiveUserId) q = q.eq('user_id', effectiveUserId);
    if (startDate) q = q.gte('date', startDate);
    if (endDate) q = q.lte('date', endDate);

    const { data, error } = await q;
    if (error) {
      console.error('[manual-hours GET] error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, logs: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST — create a single row, or expand a weekly recurrence into N rows.
// ---------------------------------------------------------------------------
//
// Body:
//   {
//     user_id: string,
//     date: "YYYY-MM-DD",
//     duration_minutes: number,
//     entry_type: 'class' | 'lab' | 'prep' | 'online' | 'other',
//     notes?: string,
//     // Optional recurrence — expands the single entry into weekly copies
//     // up to and including end_date. Biweekly when every_other_week=true.
//     recurrence?: {
//       end_date: "YYYY-MM-DD",
//       every_other_week?: boolean,
//     }
//   }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    if (!hasMinRole(user.role, 'lead_instructor')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { user_id, date, duration_minutes, entry_type, notes, recurrence } =
      body as {
        user_id?: string;
        date?: string;
        duration_minutes?: number;
        entry_type?: string;
        notes?: string;
        recurrence?: { end_date?: string; every_other_week?: boolean };
      };

    if (!user_id || !date || !duration_minutes) {
      return NextResponse.json(
        { error: 'user_id, date, and duration_minutes are required' },
        { status: 400 }
      );
    }
    if (duration_minutes <= 0 || duration_minutes > 24 * 60) {
      return NextResponse.json(
        { error: 'duration_minutes must be between 1 and 1440' },
        { status: 400 }
      );
    }
    const type = (entry_type ?? 'class').toLowerCase();
    if (!VALID_TYPES.has(type)) {
      return NextResponse.json(
        { error: 'entry_type must be one of class, lab, prep, online, other' },
        { status: 400 }
      );
    }

    // Expand the recurrence (if any) into explicit dates.
    const dates: string[] = [date];
    if (recurrence?.end_date) {
      const step = recurrence.every_other_week ? 14 : 7;
      const start = new Date(date + 'T12:00:00');
      const end = new Date(recurrence.end_date + 'T12:00:00');
      if (end.getTime() >= start.getTime()) {
        for (
          let d = new Date(start.getTime() + step * 86_400_000);
          d.getTime() <= end.getTime();
          d = new Date(d.getTime() + step * 86_400_000)
        ) {
          dates.push(d.toISOString().slice(0, 10));
        }
      }
      // Cap runaway expansions (shouldn't happen with a sensible end_date).
      if (dates.length > 120) {
        return NextResponse.json(
          { error: 'Recurrence expanded to > 120 rows; please narrow the range.' },
          { status: 400 }
        );
      }
    }

    const supabase = getSupabaseAdmin();
    const rows = dates.map((d) => ({
      user_id,
      logged_by: user.id,
      date: d,
      duration_minutes,
      entry_type: type,
      notes: notes?.trim() || null,
    }));

    const { data, error } = await supabase
      .from('manual_hour_logs')
      .insert(rows)
      .select('id, date, duration_minutes, entry_type, notes');

    if (error) {
      console.error('[manual-hours POST] error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      inserted: data?.length ?? 0,
      logs: data ?? [],
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — remove a row by id.
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    if (!hasMinRole(user.role, 'lead_instructor')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('manual_hour_logs')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
