import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  expandWeekdayDates,
  todayDateStr,
  addWeeksToDateStr,
  GENERATION_WINDOW_WEEKS,
} from '@/lib/recurring-template-expansion';

/**
 * GET /api/cron/generate-recurring-windows
 *
 * Closes the silent-runout gap: instructor_availability rows generated
 * from recurring_availability_templates were a one-time manual seed
 * (see app/api/admin/seed-instructor-availability/route.ts) with no
 * cron regenerating further forward — rows currently exist only
 * through 2026-12-14. This cron keeps BOTH the positive
 * (instructor_availability, from recurring_availability_templates)
 * and negative (instructor_unavailability, from
 * recurring_unavailability_templates) tables filled GENERATION_WINDOW_WEEKS
 * ahead of today, on every run, for as long as a template stays
 * is_active. Purely internal bookkeeping — never touches Google
 * Calendar (see lib/general-lab-sync.ts / lib/google-calendar.ts,
 * out of scope here).
 *
 * Idempotent by design:
 *   - instructor_availability has a real UNIQUE(instructor_id, date,
 *     start_time) constraint (see supabase/migrations/archive/
 *     20260212_parttimer_scheduling.sql) — generation upserts with
 *     ignoreDuplicates so a re-run (or a second overlapping cron
 *     invocation) never creates duplicate rows. This is the same
 *     upsert shape already used in
 *     app/api/scheduling/availability/bulk/route.ts.
 *   - instructor_unavailability has no such constraint (0 rows in
 *     production, no existing callers to match against), so
 *     generation instead does an existence-check keyed on
 *     (source_template_id, start_date) before inserting — every row
 *     this cron creates is tagged with source_template_id, so the
 *     check is scoped and cheap. Matches the existence-check
 *     idempotency pattern already used in
 *     app/api/admin/seed-instructor-availability/route.ts.
 *
 * Auth: Bearer CRON_SECRET (standard pattern — see
 * app/api/cron/calendar-sync/route.ts).
 */

interface AvailabilityTemplate {
  id: string;
  instructor_id: string;
  weekdays: number[];
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  frequency: 'weekly' | 'biweekly';
  start_date: string;
  end_date: string;
}

interface UnavailabilityTemplate {
  id: string;
  instructor_id: string;
  created_by: string | null;
  weekdays: number[];
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
  frequency: 'weekly' | 'biweekly';
  start_date: string;
  end_date: string | null;
  reason: string | null;
  notes: string | null;
}

async function generateAvailabilityWindow(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  today: string,
  horizon: string
): Promise<{ templatesProcessed: number; rowsInserted: number; errors: string[] }> {
  const errors: string[] = [];
  let rowsInserted = 0;

  const { data: templates, error: tplErr } = await supabase
    .from('recurring_availability_templates')
    .select('id, instructor_id, weekdays, start_time, end_time, is_all_day, frequency, start_date, end_date')
    .eq('is_active', true)
    .gte('end_date', today);

  if (tplErr) {
    errors.push(`availability template fetch: ${tplErr.message}`);
    return { templatesProcessed: 0, rowsInserted: 0, errors };
  }

  const list = (templates ?? []) as AvailabilityTemplate[];
  for (const tpl of list) {
    const windowStart = tpl.start_date > today ? tpl.start_date : today;
    const windowEnd = tpl.end_date < horizon ? tpl.end_date : horizon;
    if (windowEnd < windowStart) continue;

    const dates = expandWeekdayDates(tpl.weekdays, windowStart, windowEnd, tpl.frequency);
    if (dates.length === 0) continue;

    const rows = dates.map((d) => ({
      instructor_id: tpl.instructor_id,
      date: d,
      start_time: tpl.start_time,
      end_time: tpl.end_time,
      is_all_day: tpl.is_all_day,
      notes: 'Generated from recurring template (rolling window)',
      source_template_id: tpl.id,
    }));

    // Unique(instructor_id, date, start_time) makes this upsert safe to
    // re-run — matching/duplicate rows are silently skipped.
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200);
      const { data: inserted, error: insErr } = await supabase
        .from('instructor_availability')
        .upsert(batch, { onConflict: 'instructor_id,date,start_time', ignoreDuplicates: true })
        .select('id');
      if (insErr) {
        errors.push(`availability template ${tpl.id}: ${insErr.message}`);
      } else {
        rowsInserted += inserted?.length ?? 0;
      }
    }
  }

  return { templatesProcessed: list.length, rowsInserted, errors };
}

async function generateUnavailabilityWindow(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  today: string,
  horizon: string
): Promise<{ templatesProcessed: number; rowsInserted: number; errors: string[] }> {
  const errors: string[] = [];
  let rowsInserted = 0;

  // NULL end_date (open-ended) or end_date >= today both need
  // consideration; PostgREST .or() expresses that.
  const { data: templates, error: tplErr } = await supabase
    .from('recurring_unavailability_templates')
    .select('id, instructor_id, created_by, weekdays, start_time, end_time, is_all_day, frequency, start_date, end_date, reason, notes')
    .eq('is_active', true)
    .or(`end_date.is.null,end_date.gte.${today}`);

  if (tplErr) {
    errors.push(`unavailability template fetch: ${tplErr.message}`);
    return { templatesProcessed: 0, rowsInserted: 0, errors };
  }

  const list = (templates ?? []) as UnavailabilityTemplate[];
  for (const tpl of list) {
    const windowStart = tpl.start_date > today ? tpl.start_date : today;
    const windowEnd = tpl.end_date && tpl.end_date < horizon ? tpl.end_date : horizon;
    if (windowEnd < windowStart) continue;

    const dates = expandWeekdayDates(tpl.weekdays, windowStart, windowEnd, tpl.frequency);
    if (dates.length === 0) continue;

    // Existence check scoped to this template — instructor_unavailability
    // has no unique constraint to upsert against, so dedupe on
    // (source_template_id, start_date) before inserting.
    const { data: existingRows, error: existErr } = await supabase
      .from('instructor_unavailability')
      .select('start_date')
      .eq('source_template_id', tpl.id)
      .gte('start_date', windowStart)
      .lte('start_date', windowEnd);
    if (existErr) {
      errors.push(`unavailability template ${tpl.id} existence check: ${existErr.message}`);
      continue;
    }
    const covered = new Set((existingRows ?? []).map((r) => r.start_date));
    const toInsert = dates.filter((d) => !covered.has(d));
    if (toInsert.length === 0) continue;

    const rows = toInsert.map((d) => ({
      instructor_id: tpl.instructor_id,
      created_by: tpl.created_by,
      start_date: d,
      end_date: d,
      start_time: tpl.start_time,
      end_time: tpl.end_time,
      is_all_day: tpl.is_all_day,
      reason: tpl.reason,
      notes: tpl.notes,
      source_template_id: tpl.id,
    }));

    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200);
      const { data: inserted, error: insErr } = await supabase
        .from('instructor_unavailability')
        .insert(batch)
        .select('id');
      if (insErr) {
        errors.push(`unavailability template ${tpl.id}: ${insErr.message}`);
      } else {
        rowsInserted += inserted?.length ?? 0;
      }
    }
  }

  return { templatesProcessed: list.length, rowsInserted, errors };
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const today = todayDateStr();
  const horizon = addWeeksToDateStr(today, GENERATION_WINDOW_WEEKS);

  const [availability, unavailability] = await Promise.all([
    generateAvailabilityWindow(supabase, today, horizon),
    generateUnavailabilityWindow(supabase, today, horizon),
  ]);

  const errors = [...availability.errors, ...unavailability.errors];
  if (errors.length > 0) {
    console.error('[cron/generate-recurring-windows] errors', errors);
  }

  return NextResponse.json({
    success: errors.length === 0,
    today,
    horizon,
    availability,
    unavailability,
    errors: errors.length > 0 ? errors : undefined,
  });
}
