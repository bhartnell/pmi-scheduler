import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/admin/seed-instructor-availability
 *
 * One-shot bulk action that creates default Mon-Fri 8:30 AM - 5:00 PM
 * availability for every full-time instructor for a specified date
 * range (defaults: 2026-05-11 → 2026-08-21, the Summer 2026 window).
 *
 * Idempotent — for each instructor, checks for an existing
 * recurring_availability_templates row covering the same window
 * with the same weekdays + times before inserting. ALSO expands
 * to instructor_availability rows so the
 * /api/lab-management/instructor-availability dropdown sees the
 * green-dot evidence immediately.
 *
 * Body (all optional):
 *   {
 *     start_date?: 'YYYY-MM-DD',     // default 2026-05-11
 *     end_date?:   'YYYY-MM-DD',     // default 2026-08-21
 *     start_time?: 'HH:MM:SS',       // default 08:30:00
 *     end_time?:   'HH:MM:SS',       // default 17:00:00
 *     weekdays?:   number[],         // default [1,2,3,4,5] (Mon-Fri)
 *     dry_run?:    boolean,          // default false
 *   }
 *
 * Filter: role IN ('lead_instructor','instructor') AND
 * is_part_time = false AND is_active = true. Part-timers continue
 * to submit their own availability (they have monthly_hours_target
 * tracking on lab_users).
 */
const DEFAULT_START_DATE = '2026-05-11';
const DEFAULT_END_DATE = '2026-08-21';
const DEFAULT_START_TIME = '08:30:00';
const DEFAULT_END_TIME = '17:00:00';
const DEFAULT_WEEKDAYS = [1, 2, 3, 4, 5];

export async function POST(request: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  let body: {
    start_date?: string;
    end_date?: string;
    start_time?: string;
    end_time?: string;
    weekdays?: number[];
    dry_run?: boolean;
  } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body — use defaults */
  }

  const startDate = body.start_date ?? DEFAULT_START_DATE;
  const endDate = body.end_date ?? DEFAULT_END_DATE;
  const startTime = body.start_time ?? DEFAULT_START_TIME;
  const endTime = body.end_time ?? DEFAULT_END_TIME;
  const weekdays = Array.isArray(body.weekdays) && body.weekdays.length > 0
    ? body.weekdays
    : DEFAULT_WEEKDAYS;
  const dryRun = body.dry_run === true;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return NextResponse.json(
      { success: false, error: 'start_date and end_date must be YYYY-MM-DD' },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  // Resolve the caller's lab_users.id for created_by (FK).
  let createdById: string | null = null;
  try {
    const { data: caller } = await supabase
      .from('lab_users')
      .select('id')
      .ilike('email', user.email)
      .single();
    createdById = caller?.id ?? null;
  } catch {
    /* caller lookup is best-effort */
  }

  // Pull every full-time, active instructor.
  const { data: instructors, error: iErr } = await supabase
    .from('lab_users')
    .select('id, name, email')
    .in('role', ['instructor', 'lead_instructor'])
    .eq('is_active', true)
    .or('is_part_time.is.null,is_part_time.eq.false')
    .order('name');
  if (iErr) {
    return NextResponse.json({ success: false, error: iErr.message }, { status: 500 });
  }
  if (!instructors || instructors.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No full-time instructors found',
      template_inserted: 0,
      availability_inserted: 0,
      instructors_touched: 0,
    });
  }

  // Generate the date list once — every (date, weekday) pair where
  // weekday ∈ weekdays and date ∈ [startDate, endDate].
  const dates: string[] = [];
  const startMs = new Date(startDate + 'T00:00:00Z').getTime();
  const endMs = new Date(endDate + 'T00:00:00Z').getTime();
  for (let ms = startMs; ms <= endMs; ms += 86400000) {
    const d = new Date(ms);
    const dow = d.getUTCDay();
    if (weekdays.includes(dow)) {
      dates.push(d.toISOString().slice(0, 10));
    }
  }

  let templateInserted = 0;
  let templateSkipped = 0;
  let availabilityInserted = 0;
  let availabilitySkipped = 0;
  const instructorsTouched = new Set<string>();
  const errors: string[] = [];

  for (const instr of instructors) {
    // Idempotency check #1: existing template covering this window
    // with the same weekdays + times.
    try {
      const { data: existingTpl } = await supabase
        .from('recurring_availability_templates')
        .select('id, weekdays, start_time, end_time, start_date, end_date, is_active')
        .eq('instructor_id', instr.id);
      const matches = (existingTpl ?? []).some(t => {
        if (!t.is_active) return false;
        if (t.start_date > startDate || t.end_date < endDate) return false;
        if (t.start_time !== startTime || t.end_time !== endTime) return false;
        const wkSet = new Set(t.weekdays ?? []);
        return weekdays.every(w => wkSet.has(w));
      });
      if (!matches && !dryRun) {
        const { error: tErr } = await supabase
          .from('recurring_availability_templates')
          .insert({
            instructor_id: instr.id,
            created_by: createdById,
            weekdays,
            start_time: startTime,
            end_time: endTime,
            is_all_day: false,
            frequency: 'weekly',
            start_date: startDate,
            end_date: endDate,
            notes: 'Seeded full-time default availability',
            is_active: true,
          });
        if (tErr) {
          errors.push(`${instr.name}: template insert failed — ${tErr.message}`);
        } else {
          templateInserted++;
          instructorsTouched.add(instr.id);
        }
      } else if (matches) {
        templateSkipped++;
      }
    } catch (err) {
      errors.push(`${instr.name}: template lookup error — ${err instanceof Error ? err.message : String(err)}`);
    }

    // Idempotency check #2: existing availability rows for this
    // instructor + date pairs. Bulk-fetch the rows in the window
    // once per instructor so we can skip dates already covered.
    try {
      const { data: existingAvail } = await supabase
        .from('instructor_availability')
        .select('date, start_time, end_time, is_all_day')
        .eq('instructor_id', instr.id)
        .gte('date', startDate)
        .lte('date', endDate);
      const coveredDates = new Set<string>();
      for (const a of existingAvail ?? []) {
        if (a.is_all_day) {
          coveredDates.add(a.date);
          continue;
        }
        if (a.start_time && a.end_time && a.start_time <= startTime && a.end_time >= endTime) {
          coveredDates.add(a.date);
        }
      }

      const rowsToInsert = dates
        .filter(d => !coveredDates.has(d))
        .map(d => ({
          instructor_id: instr.id,
          date: d,
          start_time: startTime,
          end_time: endTime,
          is_all_day: false,
          notes: 'Seeded full-time default availability',
        }));

      availabilitySkipped += dates.length - rowsToInsert.length;

      if (rowsToInsert.length > 0 && !dryRun) {
        // Insert in batches of 100 to stay under PostgREST limits.
        for (let i = 0; i < rowsToInsert.length; i += 100) {
          const batch = rowsToInsert.slice(i, i + 100);
          const { error: aErr } = await supabase
            .from('instructor_availability')
            .insert(batch);
          if (aErr) {
            errors.push(`${instr.name}: availability batch insert failed — ${aErr.message}`);
          } else {
            availabilityInserted += batch.length;
          }
        }
        instructorsTouched.add(instr.id);
      }
    } catch (err) {
      errors.push(`${instr.name}: availability lookup error — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({
    success: true,
    dry_run: dryRun,
    full_time_instructors: instructors.length,
    instructors_touched: instructorsTouched.size,
    template_inserted: templateInserted,
    template_skipped: templateSkipped,
    availability_inserted: availabilityInserted,
    availability_skipped: availabilitySkipped,
    errors: errors.length > 0 ? errors : undefined,
    window: { start_date: startDate, end_date: endDate, start_time: startTime, end_time: endTime, weekdays },
  });
}
