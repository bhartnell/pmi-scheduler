import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

/**
 * /api/scheduling/recurring-availability
 *
 * Recurring availability templates for part-timers with fixed weekly
 * patterns (Trevor: Thu + Fri every week + every other Wed). Admin
 * creates a template; server expands it into explicit
 * instructor_availability rows across the chosen date range so the
 * existing availability UIs + part-timer-status page see it without
 * any further changes.
 *
 * GET  → list templates, optionally ?user_id filter
 * POST → create + expand
 * DELETE ?id  → deactivate a template + clean up its generated rows
 *
 * Lead_instructor+ for all writes.
 */

// ---------------------------------------------------------------------------
// Expansion helper
// ---------------------------------------------------------------------------
function expandDates(
  weekdays: number[],
  startDate: string,
  endDate: string,
  frequency: 'weekly' | 'biweekly'
): string[] {
  const start = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  if (end.getTime() < start.getTime()) return [];

  // For biweekly we count weeks since the start — odd weeks are skipped.
  // Week 0 = the week containing the start_date.
  const MS_PER_WEEK = 7 * 86_400_000;
  const weekOf = (d: Date) => {
    const diff = d.getTime() - start.getTime();
    return Math.floor(diff / MS_PER_WEEK);
  };

  const out: string[] = [];
  for (
    let d = new Date(start.getTime());
    d.getTime() <= end.getTime();
    d = new Date(d.getTime() + 86_400_000)
  ) {
    const wd = d.getDay();
    if (!weekdays.includes(wd)) continue;
    if (frequency === 'biweekly' && weekOf(d) % 2 !== 0) continue;
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const userId = request.nextUrl.searchParams.get('user_id');

    let q = supabase
      .from('recurring_availability_templates')
      .select(
        `id, instructor_id, created_by, weekdays, start_time, end_time,
         is_all_day, frequency, start_date, end_date, notes, is_active,
         created_at, updated_at,
         instructor:lab_users!recurring_availability_templates_instructor_id_fkey(id, name, email)`
      )
      .order('created_at', { ascending: false });

    if (userId) q = q.eq('instructor_id', userId);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, templates: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST — create + expand
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
      instructor_id,
      weekdays,
      start_time,
      end_time,
      is_all_day,
      frequency,
      start_date,
      end_date,
      notes,
    } = body as {
      instructor_id?: string;
      weekdays?: number[];
      start_time?: string;
      end_time?: string;
      is_all_day?: boolean;
      frequency?: string;
      start_date?: string;
      end_date?: string;
      notes?: string;
    };

    if (!instructor_id || !start_date || !end_date) {
      return NextResponse.json(
        { error: 'instructor_id, start_date, and end_date are required' },
        { status: 400 }
      );
    }
    if (!Array.isArray(weekdays) || weekdays.length === 0) {
      return NextResponse.json(
        { error: 'weekdays must be a non-empty array of 0-6' },
        { status: 400 }
      );
    }
    const cleanedWeekdays = Array.from(
      new Set(
        weekdays
          .map((n) => Number(n))
          .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
      )
    ).sort();
    if (cleanedWeekdays.length === 0) {
      return NextResponse.json({ error: 'weekdays invalid' }, { status: 400 });
    }
    const freq = (frequency ?? 'weekly').toLowerCase();
    if (!['weekly', 'biweekly'].includes(freq)) {
      return NextResponse.json(
        { error: 'frequency must be weekly or biweekly' },
        { status: 400 }
      );
    }
    if (!is_all_day && (!start_time || !end_time)) {
      return NextResponse.json(
        { error: 'start_time and end_time are required unless is_all_day' },
        { status: 400 }
      );
    }
    if (!is_all_day && start_time! >= end_time!) {
      return NextResponse.json(
        { error: 'end_time must be after start_time' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Create the template
    const { data: template, error: tplErr } = await supabase
      .from('recurring_availability_templates')
      .insert({
        instructor_id,
        created_by: user.id,
        weekdays: cleanedWeekdays,
        start_time: is_all_day ? '00:00:00' : start_time,
        end_time: is_all_day ? '23:59:00' : end_time,
        is_all_day: !!is_all_day,
        frequency: freq,
        start_date,
        end_date,
        notes: notes?.trim() || null,
        is_active: true,
      })
      .select('id, start_date, end_date, weekdays, frequency')
      .single();

    if (tplErr) {
      console.error('[recurring-availability POST] template insert', tplErr);
      return NextResponse.json({ error: tplErr.message }, { status: 500 });
    }

    // Expand to dates and insert availability rows. Cap runaway
    // expansions at 500; weekly Thu+Fri for a year is ~104, so this
    // is only a fence against bad inputs.
    const dates = expandDates(
      cleanedWeekdays,
      start_date,
      end_date,
      freq as 'weekly' | 'biweekly'
    );
    if (dates.length > 500) {
      return NextResponse.json(
        {
          error:
            'Template would create > 500 availability rows; narrow the date range.',
        },
        { status: 400 }
      );
    }

    let insertedRows = 0;
    if (dates.length > 0) {
      const rows = dates.map((d) => ({
        instructor_id,
        date: d,
        start_time: is_all_day ? null : start_time,
        end_time: is_all_day ? null : end_time,
        is_all_day: !!is_all_day,
        notes: notes?.trim() || null,
        source_template_id: template.id,
      }));
      const { error: avErr, data: avData } = await supabase
        .from('instructor_availability')
        .insert(rows)
        .select('id');
      if (avErr) {
        console.error('[recurring-availability POST] availability insert', avErr);
        return NextResponse.json({ error: avErr.message }, { status: 500 });
      }
      insertedRows = avData?.length ?? 0;
    }

    return NextResponse.json({
      success: true,
      template,
      expanded_dates: dates,
      inserted_rows: insertedRows,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — deactivate template + clean up the availability rows it created.
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
    // Clean up expanded rows first.
    await supabase
      .from('instructor_availability')
      .delete()
      .eq('source_template_id', id);

    const { error } = await supabase
      .from('recurring_availability_templates')
      .update({ is_active: false, updated_at: new Date().toISOString() })
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
