import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

/**
 * /api/scheduling/recurring-unavailability
 *
 * Recurring unavailability templates (recurring_unavailability_templates) —
 * sibling of /api/scheduling/recurring-availability, but for the opposite
 * signal, and with a NULLABLE end_date for open-ended patterns ("unavailable
 * every Wed until I turn it off"), which recurring_availability_templates
 * doesn't support.
 *
 * Unlike recurring-availability, this does NOT eagerly expand into
 * instructor_unavailability rows for open-ended templates (end_date null —
 * there's no bound to expand to). The picker
 * (app/api/lab-management/instructor-availability) reads active templates
 * directly for weekday/date-range matches instead. A date-bounded template
 * (end_date set) is expanded the same way recurring-availability does, so
 * a bounded pattern shows up identically whichever table the picker checks
 * first — this keeps both read paths correct without relying on expansion
 * alone for the open-ended case.
 *
 * GET  → list templates, optionally ?instructor_id filter
 * POST → create (+ expand if date-bounded)
 * DELETE ?id → deactivate a template + clean up any rows it expanded
 *
 * Lead_instructor+ for all writes.
 */

const MS_PER_WEEK = 7 * 86_400_000;

function expandDates(
  weekdays: number[],
  startDate: string,
  endDate: string,
  frequency: 'weekly' | 'biweekly'
): string[] {
  const start = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  if (end.getTime() < start.getTime()) return [];

  const weekOf = (d: Date) => Math.floor((d.getTime() - start.getTime()) / MS_PER_WEEK);

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

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const instructorId = request.nextUrl.searchParams.get('instructor_id');

    let q = supabase
      .from('recurring_unavailability_templates')
      .select(
        `id, instructor_id, created_by, weekdays, start_time, end_time,
         is_all_day, frequency, start_date, end_date, reason, notes,
         is_active, created_at, updated_at,
         instructor:lab_users!recurring_unavailability_templates_instructor_id_fkey(id, name, email)`
      )
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (instructorId) q = q.eq('instructor_id', instructorId);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, templates: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    if (!hasMinRole(user.role, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
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
      reason,
      notes,
    } = body as {
      instructor_id?: string;
      weekdays?: number[];
      start_time?: string;
      end_time?: string;
      is_all_day?: boolean;
      frequency?: string;
      start_date?: string;
      end_date?: string | null;
      reason?: string;
      notes?: string;
    };

    if (!instructor_id || !start_date) {
      return NextResponse.json(
        { success: false, error: 'instructor_id and start_date are required' },
        { status: 400 }
      );
    }
    if (!Array.isArray(weekdays) || weekdays.length === 0) {
      return NextResponse.json(
        { success: false, error: 'weekdays must be a non-empty array of 0-6' },
        { status: 400 }
      );
    }
    const cleanedWeekdays = Array.from(
      new Set(weekdays.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))
    ).sort();
    if (cleanedWeekdays.length === 0) {
      return NextResponse.json({ success: false, error: 'weekdays invalid' }, { status: 400 });
    }
    const freq = (frequency ?? 'weekly').toLowerCase();
    if (!['weekly', 'biweekly'].includes(freq)) {
      return NextResponse.json(
        { success: false, error: 'frequency must be weekly or biweekly' },
        { status: 400 }
      );
    }
    if (!is_all_day && (!start_time || !end_time)) {
      return NextResponse.json(
        { success: false, error: 'start_time and end_time are required unless is_all_day' },
        { status: 400 }
      );
    }
    if (end_date && end_date < start_date) {
      return NextResponse.json(
        { success: false, error: 'end_date must be on or after start_date' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: template, error: tplErr } = await supabase
      .from('recurring_unavailability_templates')
      .insert({
        instructor_id,
        created_by: user.id,
        weekdays: cleanedWeekdays,
        start_time: is_all_day ? null : start_time,
        end_time: is_all_day ? null : end_time,
        is_all_day: !!is_all_day,
        frequency: freq,
        start_date,
        end_date: end_date || null,
        reason: reason?.trim() || null,
        notes: notes?.trim() || null,
        is_active: true,
      })
      .select('id, start_date, end_date, weekdays, frequency')
      .single();

    if (tplErr) {
      console.error('[recurring-unavailability POST] template insert', tplErr);
      return NextResponse.json({ success: false, error: tplErr.message }, { status: 500 });
    }

    // Open-ended (no end_date) templates are NOT expanded — the picker
    // reads active templates directly for those. Only a date-bounded
    // template gets expanded into explicit instructor_unavailability rows.
    let insertedRows = 0;
    let expandedDates: string[] = [];
    if (end_date) {
      expandedDates = expandDates(cleanedWeekdays, start_date, end_date, freq as 'weekly' | 'biweekly');
      if (expandedDates.length > 500) {
        return NextResponse.json(
          { success: false, error: 'Template would create > 500 unavailability rows; narrow the date range.' },
          { status: 400 }
        );
      }
      if (expandedDates.length > 0) {
        const rows = expandedDates.map((d) => ({
          instructor_id,
          start_date: d,
          end_date: d,
          start_time: is_all_day ? null : start_time,
          end_time: is_all_day ? null : end_time,
          is_all_day: !!is_all_day,
          reason: reason?.trim() || null,
          notes: notes?.trim() || null,
          source_template_id: template.id,
        }));
        const { error: unavailErr, data: unavailData } = await supabase
          .from('instructor_unavailability')
          .insert(rows)
          .select('id');
        if (unavailErr) {
          console.error('[recurring-unavailability POST] unavailability insert', unavailErr);
          return NextResponse.json({ success: false, error: unavailErr.message }, { status: 500 });
        }
        insertedRows = unavailData?.length ?? 0;
      }
    }

    return NextResponse.json({
      success: true,
      template,
      expanded_dates: expandedDates,
      inserted_rows: insertedRows,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    if (!hasMinRole(user.role, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    await supabase.from('instructor_unavailability').delete().eq('source_template_id', id);

    const { error } = await supabase
      .from('recurring_unavailability_templates')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
