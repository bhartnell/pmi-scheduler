import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { randomUUID } from 'crypto';

/**
 * POST /api/scheduling/planner/blocks/recurring
 * Creates multiple dated blocks for a recurring series.
 *
 * Body:
 *   semester_id: string
 *   repeat_type: 'weekly_single' | 'weekly_multi' | 'weekdays' | 'custom'
 *   repeat_days: number[]          — day_of_week values (0-6)
 *   day_times: Record<number, { start_time: string; end_time: string }>  — per-day overrides
 *   start_date: string             — first occurrence (YYYY-MM-DD)
 *   duration_type: 'full' | 'first_half' | 'second_half' | 'custom'
 *   until_date?: string            — end date for custom duration
 *   until_weeks?: number           — number of weeks for custom duration
 *   title?: string
 *   course_name?: string
 *   block_type?: string
 *   color?: string
 *   content_notes?: string
 *   program_schedule_id?: string
 *   room_id?: string
 *   instructor_id?: string
 *   semester_start_date?: string   — used for week number calculation
 */

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekNumber(date: Date, semesterStart: Date): number {
  const start = getMonday(semesterStart);
  const current = getMonday(date);
  const diff = current.getTime() - start.getTime();
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    if (!hasMinRole(user.role, 'lead_instructor')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const {
      semester_id,
      repeat_days,        // e.g. [4, 5] for Thu/Fri
      day_times,          // e.g. { "4": { start_time: "08:30", end_time: "10:30" }, "5": { ... } }
      start_date,
      duration_type,
      until_date,
      until_weeks,
      title,
      course_name,
      block_type,
      color,
      content_notes,
      program_schedule_id,
      room_id,
      instructor_id,
      semester_start_date,
      // Fallback start/end time if day_times not provided
      start_time: defaultStartTime,
      end_time: defaultEndTime,
    } = body;

    if (!semester_id || !start_date || !repeat_days || repeat_days.length === 0) {
      return NextResponse.json({
        error: 'semester_id, start_date, and repeat_days are required'
      }, { status: 400 });
    }

    // Determine end date based on duration_type
    const semStart = new Date(start_date + 'T00:00:00');
    let endDate: Date;

    if (duration_type === 'first_half') {
      endDate = addDays(semStart, 8 * 7 - 1); // 8 weeks
    } else if (duration_type === 'second_half') {
      endDate = addDays(semStart, 15 * 7 - 1); // through week 15
    } else if (until_date) {
      endDate = new Date(until_date + 'T00:00:00');
    } else if (until_weeks) {
      endDate = addDays(semStart, until_weeks * 7 - 1);
    } else {
      // Default: full semester = 15 weeks
      endDate = addDays(semStart, 15 * 7 - 1);
    }

    // Generate recurring group ID shared by all instances
    const recurringGroupId = randomUUID();

    // For each repeat_day, find first occurrence from start_date, then add weekly
    const blocksToInsert: Record<string, unknown>[] = [];
    const parsedDays: number[] = repeat_days.map((d: number | string) => typeof d === 'string' ? parseInt(d, 10) : d);

    const semesterStartForWeekCalc = semester_start_date
      ? new Date(semester_start_date + 'T00:00:00')
      : semStart;

    for (const dayOfWeek of parsedDays) {
      // Get per-day times or fall back to defaults
      const dayKey = String(dayOfWeek);
      const dayTimeOverride = day_times?.[dayKey];
      const startTime = dayTimeOverride?.start_time || defaultStartTime || '08:00';
      const endTime = dayTimeOverride?.end_time || defaultEndTime || '09:00';

      // Find first occurrence of this day of week from start_date
      let firstDate = new Date(semStart);
      const currentDow = firstDate.getDay();
      let daysUntil = dayOfWeek - currentDow;
      if (daysUntil < 0) daysUntil += 7;
      firstDate = addDays(firstDate, daysUntil);

      // Generate blocks for each week until endDate
      let currentDate = firstDate;
      while (currentDate <= endDate) {
        const weekNum = getWeekNumber(currentDate, semesterStartForWeekCalc);

        blocksToInsert.push({
          semester_id,
          program_schedule_id: program_schedule_id || null,
          room_id: room_id || null,
          day_of_week: dayOfWeek,
          date: formatDate(currentDate),
          week_number: weekNum > 0 ? weekNum : null,
          recurring_group_id: recurringGroupId,
          start_time: startTime,
          end_time: endTime,
          block_type: block_type || 'lecture',
          title: title || null,
          course_name: course_name || null,
          content_notes: content_notes || null,
          color: color || null,
          is_recurring: true,
          sort_order: 0,
        });

        currentDate = addDays(currentDate, 7);
      }
    }

    if (blocksToInsert.length === 0) {
      return NextResponse.json({
        error: 'No blocks to create — check repeat_days and date range'
      }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Insert in batches of 100
    const allCreated: Record<string, unknown>[] = [];
    for (let i = 0; i < blocksToInsert.length; i += 100) {
      const batch = blocksToInsert.slice(i, i + 100);
      const { data: created, error: insertError } = await supabase
        .from('pmi_schedule_blocks')
        .insert(batch)
        .select('id, date, day_of_week, week_number');

      if (insertError) throw insertError;
      if (created) allCreated.push(...created);
    }

    // Assign instructor if provided
    if (instructor_id && allCreated.length > 0) {
      const assignments = allCreated.map(block => ({
        schedule_block_id: (block as { id: string }).id,
        instructor_id,
        role: 'primary',
      }));

      for (let i = 0; i < assignments.length; i += 100) {
        const batch = assignments.slice(i, i + 100);
        await supabase.from('pmi_block_instructors').insert(batch);
      }
    }

    return NextResponse.json({
      success: true,
      blocks_created: allCreated.length,
      recurring_group_id: recurringGroupId,
      days: parsedDays,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Create recurring blocks error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
