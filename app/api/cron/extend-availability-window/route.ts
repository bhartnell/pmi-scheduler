import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/cron/extend-availability-window
 *
 * Rolling extension for the full-timer "default availability" seed
 * (Task Handoff Queue, [AVAILABILITY SYSTEM] item — Ben, 2026-08-07:
 * "VERIFY availability rows currently generate only through 2026-08-21
 * — confirm how far forward availability extends and whether it
 * auto-rolls; a silent run-out would break the calendar").
 *
 * CONFIRMED (2026-09-12 investigation): it did NOT auto-roll.
 * /api/admin/seed-instructor-availability is a one-shot bulk action
 * with a hardcoded default window (2026-05-11 → 2026-08-21) that
 * nobody had re-run since. Past the last-seeded end_date, full-timers
 * silently stop showing available anywhere the app checks
 * instructor_availability (the station-dropdown fix, general-lab
 * defaults, PALS-day candidate pool) — exactly the calendar-breaking
 * failure Ben flagged.
 *
 * This cron keeps a rolling ROLL_FORWARD_DAYS-day horizon by finding
 * every recurring_availability_templates row that IS the seeded
 * default (notes = 'Seeded full-time default availability', the exact
 * tag the seed route writes) whose end_date has fallen inside the
 * horizon, extending that template's end_date forward, and expanding
 * the newly-covered dates into instructor_availability rows —
 * idempotent (skips dates that already have a row) and additive only
 * (never updates/deletes an existing instructor_availability row).
 *
 * Deliberately scoped to ONLY the seeded-default tag: explicit
 * recurring rules an instructor or admin sets on their own (Josh's
 * clinical stretch, Ryan's masters-program date-bounded rule) must
 * keep expiring on their own end_date — auto-extending those would
 * silently undo the "date-bounded / count-bounded" feature Ben
 * specifically asked for. Only the generic full-time backdrop rolls
 * forward automatically.
 */
const SEED_NOTES_TAG = 'Seeded full-time default availability';
const ROLL_FORWARD_DAYS = 90;

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const horizon = new Date(today.getTime() + ROLL_FORWARD_DAYS * 86_400_000);
  const horizonStr = horizon.toISOString().slice(0, 10);

  let templatesExtended = 0;
  let rowsInserted = 0;
  const errors: string[] = [];

  try {
    const { data: templates, error: tErr } = await supabase
      .from('recurring_availability_templates')
      .select('id, instructor_id, weekdays, start_time, end_time, frequency, start_date, end_date, is_active')
      .eq('is_active', true)
      .eq('notes', SEED_NOTES_TAG)
      .lt('end_date', horizonStr);
    if (tErr) throw tErr;

    for (const tpl of templates ?? []) {
      const oldEnd = tpl.end_date as string;
      const weekdays: number[] = tpl.weekdays ?? [];
      if (!weekdays.length) continue;

      // Dates strictly after the old end_date, through the new horizon.
      const newDates: string[] = [];
      const oldEndMs = new Date(oldEnd + 'T00:00:00Z').getTime();
      const horizonMs = horizon.getTime();
      for (let ms = oldEndMs + 86_400_000; ms <= horizonMs; ms += 86_400_000) {
        const d = new Date(ms);
        if (weekdays.includes(d.getUTCDay())) {
          newDates.push(d.toISOString().slice(0, 10));
        }
      }
      if (!newDates.length) continue;

      // Idempotency: skip dates that already have a row for this
      // instructor (e.g. a previous partial run, or a manually-added row).
      const { data: existing } = await supabase
        .from('instructor_availability')
        .select('date')
        .eq('instructor_id', tpl.instructor_id)
        .in('date', newDates);
      const covered = new Set((existing ?? []).map((r) => r.date as string));
      const rowsToInsert = newDates
        .filter((d) => !covered.has(d))
        .map((d) => ({
          instructor_id: tpl.instructor_id,
          date: d,
          start_time: tpl.start_time,
          end_time: tpl.end_time,
          is_all_day: false,
          notes: SEED_NOTES_TAG,
        }));

      try {
        if (rowsToInsert.length > 0) {
          for (let i = 0; i < rowsToInsert.length; i += 100) {
            const batch = rowsToInsert.slice(i, i + 100);
            const { error: insErr } = await supabase.from('instructor_availability').insert(batch);
            if (insErr) throw insErr;
            rowsInserted += batch.length;
          }
        }

        const { error: updErr } = await supabase
          .from('recurring_availability_templates')
          .update({ end_date: horizonStr })
          .eq('id', tpl.id);
        if (updErr) throw updErr;
        templatesExtended++;
      } catch (rowErr) {
        errors.push(
          `template ${tpl.id} (instructor ${tpl.instructor_id}): ${
            rowErr instanceof Error ? rowErr.message : String(rowErr)
          }`
        );
      }
    }
  } catch (err) {
    console.error('[cron/extend-availability-window] fatal error', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    horizon: horizonStr,
    templatesExtended,
    rowsInserted,
    errors: errors.length > 0 ? errors : undefined,
    durationMs: Date.now() - startTime,
  });
}
