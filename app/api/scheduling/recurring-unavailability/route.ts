import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import {
  expandWeekdayDates,
  todayDateStr,
  addWeeksToDateStr,
  GENERATION_WINDOW_WEEKS,
} from '@/lib/recurring-template-expansion';

/**
 * /api/scheduling/recurring-unavailability
 *
 * Recurring unavailability templates — the negative counterpart to
 * /api/scheduling/recurring-availability. Self-scoped like
 * /api/scheduling/unavailability: a plain `instructor`-role user may
 * create/view/delete only their OWN templates; `lead_instructor`+ may
 * manage any instructor's (coordinator use).
 *
 * Supports both flavors from the migration: bounded (end_date set) and
 * open-ended ("until turned off", end_date NULL). On create, the
 * template is expanded into concrete instructor_unavailability rows
 * up to min(end_date, today + GENERATION_WINDOW_WEEKS) — an
 * open-ended template only gets rows out to the rolling-window
 * horizon at creation time; the checkpoint-4 cron keeps extending it
 * forward on schedule as long as is_active stays true. A bounded
 * template's remaining rows past the initial expansion (if its
 * end_date is further out than the horizon) are likewise topped up by
 * that same cron run over time — this route never expands past the
 * horizon in one shot, mirroring the cron's own step size so a single
 * template can't flood the table in one create.
 *
 * GET    ?instructor_id=  — list own (default) or, for lead_instructor+,
 *                            any instructor's templates.
 * POST                    — create + expand.
 * DELETE ?id=             — deactivate a template + remove the
 *                            instructor_unavailability rows it
 *                            generated (self-scoped, same as above).
 */

interface RecurringUnavailabilityBody {
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
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const requestedInstructorId = request.nextUrl.searchParams.get('instructor_id');
    let instructorId = user.id;
    if (requestedInstructorId && requestedInstructorId !== user.id) {
      if (!hasMinRole(user.role, 'lead_instructor')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      instructorId = requestedInstructorId;
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('recurring_unavailability_templates')
      .select(
        `id, instructor_id, created_by, weekdays, start_time, end_time,
         is_all_day, frequency, start_date, end_date, reason, notes,
         is_active, created_at, updated_at,
         instructor:lab_users!recurring_unavailability_templates_instructor_id_fkey(id, name, email)`
      )
      .eq('instructor_id', instructorId)
      .order('created_at', { ascending: false });

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

    const body = (await request.json()) as RecurringUnavailabilityBody;
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
    } = body;

    let targetInstructorId = user.id;
    if (instructor_id && instructor_id !== user.id) {
      if (!hasMinRole(user.role, 'lead_instructor')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      targetInstructorId = instructor_id;
    }

    if (!start_date) {
      return NextResponse.json({ error: 'start_date is required' }, { status: 400 });
    }
    if (end_date && end_date < start_date) {
      return NextResponse.json(
        { error: 'end_date must be on or after start_date' },
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
    const allDay = is_all_day !== false;
    if (!allDay && (!start_time || !end_time)) {
      return NextResponse.json(
        { error: 'start_time and end_time are required unless is_all_day' },
        { status: 400 }
      );
    }
    if (!allDay && start_time! >= end_time!) {
      return NextResponse.json(
        { error: 'end_time must be after start_time' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: template, error: tplErr } = await supabase
      .from('recurring_unavailability_templates')
      .insert({
        instructor_id: targetInstructorId,
        created_by: user.id,
        weekdays: cleanedWeekdays,
        start_time: allDay ? null : start_time,
        end_time: allDay ? null : end_time,
        is_all_day: allDay,
        frequency: freq,
        start_date,
        end_date: end_date || null,
        reason: reason?.trim() || null,
        notes: notes?.trim() || null,
        is_active: true,
      })
      .select('id, instructor_id, start_date, end_date, weekdays, frequency, is_all_day, start_time, end_time, reason')
      .single();

    if (tplErr) {
      console.error('[recurring-unavailability POST] template insert', tplErr);
      return NextResponse.json({ error: tplErr.message }, { status: 500 });
    }

    // Expand now, up to min(end_date, rolling-window horizon). An
    // open-ended template (end_date null) or one whose end_date is
    // further out than the horizon relies on the checkpoint-4 cron to
    // keep generating rows as time passes — this mirrors the cron's
    // own step size so a single create can't flood the table.
    const horizon = addWeeksToDateStr(todayDateStr(), GENERATION_WINDOW_WEEKS);
    const expansionEnd = end_date && end_date < horizon ? end_date : horizon;
    const dates = expandWeekdayDates(
      cleanedWeekdays,
      start_date,
      expansionEnd,
      freq as 'weekly' | 'biweekly'
    );

    if (dates.length > 500) {
      return NextResponse.json(
        {
          error: 'Template would create > 500 unavailability rows in one expansion; narrow the pattern.',
        },
        { status: 400 }
      );
    }

    let insertedRows = 0;
    if (dates.length > 0) {
      const rows = dates.map((d) => ({
        instructor_id: targetInstructorId,
        created_by: user.id,
        start_date: d,
        end_date: d,
        start_time: allDay ? null : start_time,
        end_time: allDay ? null : end_time,
        is_all_day: allDay,
        reason: reason?.trim() || null,
        notes: notes?.trim() || null,
        source_template_id: template.id,
      }));
      const { error: uaErr, data: uaData } = await supabase
        .from('instructor_unavailability')
        .insert(rows)
        .select('id');
      if (uaErr) {
        console.error('[recurring-unavailability POST] unavailability insert', uaErr);
        return NextResponse.json({ error: uaErr.message }, { status: 500 });
      }
      insertedRows = uaData?.length ?? 0;
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
// DELETE — deactivate template + clean up the rows it generated.
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: existing, error: fetchErr } = await supabase
      .from('recurring_unavailability_templates')
      .select('id, instructor_id')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (
      existing.instructor_id !== user.id &&
      !hasMinRole(user.role, 'lead_instructor')
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Clean up expanded rows first.
    await supabase
      .from('instructor_unavailability')
      .delete()
      .eq('source_template_id', id);

    const { error } = await supabase
      .from('recurring_unavailability_templates')
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
