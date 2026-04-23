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
// POST — create a single row, or expand into N rows via one of two modes.
// ---------------------------------------------------------------------------
//
// Mode A (weekly recurrence):
//   { user_id, date, duration_minutes, entry_type, notes?,
//     recurrence: { end_date, every_other_week? } }
//
// Mode B (cohort-linked recurrence):
//   { user_id, duration_minutes, entry_type, notes?,
//     cohort_link: { cohort_id, day_number } }
//
//   This is the Gannon mode: his class block recurs on the cohort's
//   Day 1 (Thursday for PM14, Monday for the May cohort), not on a
//   fixed weekday. The server looks up every non-cancelled lab_day
//   for that cohort with the matching day_number and logs one entry
//   per date. Far more accurate than manually picking a weekday.
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
    const {
      user_id,
      date,
      duration_minutes,
      entry_type,
      notes,
      recurrence,
      cohort_link,
    } = body as {
      user_id?: string;
      date?: string;
      duration_minutes?: number;
      entry_type?: string;
      notes?: string;
      recurrence?: { end_date?: string; every_other_week?: boolean };
      cohort_link?: { cohort_id?: string; day_number?: number };
    };

    if (!user_id || !duration_minutes) {
      return NextResponse.json(
        { error: 'user_id and duration_minutes are required' },
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

    const supabase = getSupabaseAdmin();
    let dates: string[] = [];

    // ─── Mode B: cohort-linked expansion ─────────────────────────────────
    if (cohort_link?.cohort_id && cohort_link.day_number != null) {
      const dn = Number(cohort_link.day_number);
      if (!Number.isFinite(dn) || dn < 1 || dn > 7) {
        return NextResponse.json(
          { error: 'cohort_link.day_number must be an integer 1-7' },
          { status: 400 }
        );
      }
      const { data: labDays, error: ldErr } = await supabase
        .from('lab_days')
        .select('date, day_number')
        .eq('cohort_id', cohort_link.cohort_id)
        .eq('day_number', dn)
        .order('date', { ascending: true });
      if (ldErr) {
        console.error('[manual-hours POST] cohort lookup error', ldErr);
        return NextResponse.json({ error: ldErr.message }, { status: 500 });
      }
      dates = (labDays ?? []).map((r: { date: string }) => r.date);
      if (dates.length === 0) {
        return NextResponse.json(
          {
            error:
              'No lab days found for that cohort + day_number. Generate the cohort schedule first.',
          },
          { status: 400 }
        );
      }
    } else {
      // ─── Mode A: explicit date + optional weekly recurrence ─────────────
      if (!date) {
        return NextResponse.json(
          {
            error:
              'Either date (with optional recurrence) or cohort_link is required',
          },
          { status: 400 }
        );
      }
      dates = [date];
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
      }
    }

    if (dates.length > 120) {
      return NextResponse.json(
        {
          error:
            'Expansion would create > 120 rows; narrow the range or pick a smaller cohort window.',
        },
        { status: 400 }
      );
    }

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
      console.error('[manual-hours POST] insert error', error);
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
