import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const semesterId = searchParams.get('semester_id');
    const roomId = searchParams.get('room_id');
    const programScheduleId = searchParams.get('program_schedule_id');

    if (!semesterId) {
      return NextResponse.json({ error: 'semester_id is required' }, { status: 400 });
    }

    // Get all program_schedule IDs for this semester first
    const { data: schedules, error: schedError } = await supabase
      .from('pmi_program_schedules')
      .select('id')
      .eq('semester_id', semesterId)
      .eq('is_active', true);

    if (schedError) throw schedError;

    const scheduleIds = (schedules || []).map(s => s.id);
    if (scheduleIds.length === 0) {
      return NextResponse.json({ blocks: [] });
    }

    let query = supabase
      .from('pmi_schedule_blocks')
      .select(`
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
      `)
      .in('program_schedule_id', scheduleIds)
      .order('day_of_week')
      .order('start_time');

    if (roomId) {
      query = query.eq('room_id', roomId);
    }

    if (programScheduleId) {
      query = query.eq('program_schedule_id', programScheduleId);
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
      program_schedule_id, room_id, day_of_week, start_time, end_time,
      block_type, title, course_name, content_notes,
      is_recurring, specific_date, sort_order
    } = body;

    const dayNum = typeof day_of_week === 'string' ? parseInt(day_of_week, 10) : day_of_week;
    if (!program_schedule_id || dayNum === undefined || isNaN(dayNum) || !start_time || !end_time) {
      return NextResponse.json({
        error: 'program_schedule_id, day_of_week, start_time, and end_time are required'
      }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('pmi_schedule_blocks')
      .insert({
        program_schedule_id,
        room_id: room_id || null,  // || catches empty string from form selects
        day_of_week: dayNum,
        start_time,
        end_time,
        block_type: block_type ?? 'lecture',
        title: title || null,
        course_name: course_name || null,
        content_notes: content_notes || null,
        is_recurring: is_recurring ?? true,
        specific_date: specific_date ?? null,
        sort_order: sort_order ?? 0,
      })
      .select(`
        *,
        room:pmi_rooms!pmi_schedule_blocks_room_id_fkey(id, name, room_type, capacity),
        program_schedule:pmi_program_schedules!pmi_schedule_blocks_program_schedule_id_fkey(
          id, class_days, color, label,
          cohort:cohorts!pmi_program_schedules_cohort_id_fkey(
            id, cohort_number,
            program:programs(id, name, abbreviation)
          )
        )
      `)
      .single();

    if (error) throw error;

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
