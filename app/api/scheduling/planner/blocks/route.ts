import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

const BLOCK_SELECT = `
  *,
  room:pmi_rooms!pmi_schedule_blocks_room_id_fkey(id, name, room_type, capacity),
  program_schedule:pmi_program_schedules!pmi_schedule_blocks_program_schedule_id_fkey(
    id, class_days, color, label,
    cohort:cohorts!pmi_program_schedules_cohort_id_fkey(
      id, cohort_number,
      program:programs(id, name, abbreviation)
    )
  ),
  instructors:pmi_block_instructors(
    id, role,
    instructor:lab_users!pmi_block_instructors_instructor_id_fkey(id, name, email)
  )
`;

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const semesterId = searchParams.get('semester_id');
    const roomId = searchParams.get('room_id');
    const programScheduleId = searchParams.get('program_schedule_id');
    const dateFrom = searchParams.get('date_from');  // YYYY-MM-DD
    const dateTo = searchParams.get('date_to');      // YYYY-MM-DD

    if (!semesterId) {
      return NextResponse.json({ error: 'semester_id is required' }, { status: 400 });
    }

    let query = supabase
      .from('pmi_schedule_blocks')
      .select(BLOCK_SELECT)
      .eq('semester_id', semesterId)
      .order('date', { ascending: true, nullsFirst: false })
      .order('start_time');

    if (roomId) {
      query = query.eq('room_id', roomId);
    }

    if (programScheduleId) {
      query = query.eq('program_schedule_id', programScheduleId);
    }

    // Date range filtering for calendar view
    if (dateFrom) {
      query = query.gte('date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('date', dateTo);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ blocks: data || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('List schedule blocks error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
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
      program_schedule_id, semester_id, room_id, day_of_week, start_time, end_time,
      block_type, title, course_name, content_notes, color,
      is_recurring, specific_date, sort_order, date, week_number, recurring_group_id,
      instructor_ids,
    } = body;

    if (!semester_id || !start_time || !end_time) {
      return NextResponse.json({
        error: 'semester_id, start_time, and end_time are required'
      }, { status: 400 });
    }

    // Derive day_of_week from date if not provided
    let dayNum = typeof day_of_week === 'string' ? parseInt(day_of_week, 10) : day_of_week;
    if ((dayNum === undefined || isNaN(dayNum)) && date) {
      dayNum = new Date(date + 'T00:00:00').getDay();
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('pmi_schedule_blocks')
      .insert({
        program_schedule_id: program_schedule_id || null,
        semester_id,
        room_id: room_id || null,
        day_of_week: dayNum ?? null,
        start_time,
        end_time,
        block_type: block_type || 'other',
        title: title || null,
        course_name: course_name || null,
        content_notes: content_notes || null,
        color: color || null,
        is_recurring: is_recurring ?? false,
        specific_date: specific_date ?? null,
        date: date || null,
        week_number: week_number ?? null,
        recurring_group_id: recurring_group_id || null,
        sort_order: sort_order ?? 0,
      })
      .select(BLOCK_SELECT)
      .single();

    if (error) throw error;

    // Assign instructors if provided
    const newInstructorIds: string[] = Array.isArray(instructor_ids) ? instructor_ids : [];
    if (newInstructorIds.length > 0 && data?.id) {
      const assignments = newInstructorIds.map(instId => ({
        schedule_block_id: data.id,
        instructor_id: instId,
        role: 'primary',
      }));
      await supabase.from('pmi_block_instructors').insert(assignments);

      // Re-fetch to include instructors in the response
      const { data: refreshed } = await supabase
        .from('pmi_schedule_blocks')
        .select(BLOCK_SELECT)
        .eq('id', data.id)
        .single();

      return NextResponse.json({ block: refreshed || data });
    }

    return NextResponse.json({ block: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const detail = (err as { details?: string; hint?: string; code?: string })?.details || '';
    const code = (err as { code?: string })?.code || '';
    console.error('Create schedule block error:', { message, detail, code, err });
    return NextResponse.json({
      error: message,
      detail: detail || undefined,
      code: code || undefined,
    }, { status: 500 });
  }
}
