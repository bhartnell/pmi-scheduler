import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

/**
 * /api/scheduling/unavailability
 *
 * Specific-date/range unavailability BLOCKS (instructor_unavailability) —
 * the override that beats the "full-time = default available" rule in
 * app/api/lab-management/instructor-availability. Sibling of
 * /api/scheduling/availability, but for the opposite signal.
 *
 * GET  → list blocks, optionally ?instructor_id / ?start_date / ?end_date
 * POST → create a block
 *
 * Lead_instructor+ for writes (mirrors recurring-availability — an admin
 * enters an instructor's known unavailability, not necessarily self-edit).
 */

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { searchParams } = request.nextUrl;
    const instructorId = searchParams.get('instructor_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    let query = supabase
      .from('instructor_unavailability')
      .select(
        `id, instructor_id, start_date, end_date, start_time, end_time,
         is_all_day, reason, notes, source_template_id, created_at, updated_at,
         instructor:lab_users!instructor_unavailability_instructor_id_fkey(id, name, email)`
      )
      .order('start_date', { ascending: true });

    if (instructorId) query = query.eq('instructor_id', instructorId);
    // Overlap filter: block's [start_date, end_date] intersects the
    // requested [startDate, endDate] window.
    if (startDate) query = query.gte('end_date', startDate);
    if (endDate) query = query.lte('start_date', endDate);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, blocks: data ?? [] });
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
      start_date,
      end_date,
      start_time,
      end_time,
      is_all_day,
      reason,
      notes,
    } = body as {
      instructor_id?: string;
      start_date?: string;
      end_date?: string;
      start_time?: string;
      end_time?: string;
      is_all_day?: boolean;
      reason?: string;
      notes?: string;
    };

    if (!instructor_id || !start_date || !end_date) {
      return NextResponse.json(
        { success: false, error: 'instructor_id, start_date, and end_date are required' },
        { status: 400 }
      );
    }
    if (end_date < start_date) {
      return NextResponse.json(
        { success: false, error: 'end_date must be on or after start_date' },
        { status: 400 }
      );
    }
    if (!is_all_day && (!start_time || !end_time)) {
      return NextResponse.json(
        { success: false, error: 'start_time and end_time are required unless is_all_day' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('instructor_unavailability')
      .insert({
        instructor_id,
        created_by: user.id,
        start_date,
        end_date,
        start_time: is_all_day ? null : start_time,
        end_time: is_all_day ? null : end_time,
        is_all_day: !!is_all_day,
        reason: reason?.trim() || null,
        notes: notes?.trim() || null,
      })
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, block: data });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
