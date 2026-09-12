import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

/**
 * /api/scheduling/unavailability
 *
 * Self-service CRUD for one-off / date-range instructor_unavailability
 * entries — the negative-availability counterpart to
 * /api/scheduling/availability. A plain `instructor`-role user may
 * create/list/delete only their OWN rows (instructor_id === their own
 * lab_users.id); `lead_instructor`+ may manage any instructor's rows
 * (coordinator use). RLS on instructor_unavailability only checks the
 * role band, not row ownership, so self-scoping is enforced here in
 * the route handler — same pattern note as the migration's RLS
 * comment.
 *
 * GET    ?instructor_id=  — list own (default) or, for lead_instructor+,
 *                            any instructor's rows. Optional
 *                            ?start_date / ?end_date range filter.
 * POST                    — create a row. Body may omit instructor_id
 *                            (defaults to self); a plain instructor
 *                            may only pass their own id.
 * DELETE ?id=             — remove a row. Plain instructor may only
 *                            delete a row they own.
 */

interface UnavailabilityBody {
  instructor_id?: string;
  start_date?: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  is_all_day?: boolean;
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

    const { searchParams } = new URL(request.url);
    const requestedInstructorId = searchParams.get('instructor_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    let instructorId = user.id;
    if (requestedInstructorId && requestedInstructorId !== user.id) {
      if (!hasMinRole(user.role, 'lead_instructor')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      instructorId = requestedInstructorId;
    }

    const supabase = getSupabaseAdmin();
    let q = supabase
      .from('instructor_unavailability')
      .select(
        `id, instructor_id, created_by, start_date, end_date, start_time,
         end_time, is_all_day, reason, notes, source_template_id,
         created_at, updated_at,
         instructor:lab_users!instructor_unavailability_instructor_id_fkey(id, name, email)`
      )
      .eq('instructor_id', instructorId)
      .order('start_date', { ascending: true });

    if (startDate) q = q.gte('end_date', startDate);
    if (endDate) q = q.lte('start_date', endDate);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, unavailability: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST — create
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const body = (await request.json()) as UnavailabilityBody;
    const {
      instructor_id,
      start_date,
      end_date,
      start_time,
      end_time,
      is_all_day,
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

    if (!start_date || !end_date) {
      return NextResponse.json(
        { error: 'start_date and end_date are required' },
        { status: 400 }
      );
    }
    if (end_date < start_date) {
      return NextResponse.json(
        { error: 'end_date must be on or after start_date' },
        { status: 400 }
      );
    }
    const allDay = is_all_day !== false; // default true, matches column default
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
    const { data, error } = await supabase
      .from('instructor_unavailability')
      .insert({
        instructor_id: targetInstructorId,
        created_by: user.id,
        start_date,
        end_date,
        start_time: allDay ? null : start_time,
        end_time: allDay ? null : end_time,
        is_all_day: allDay,
        reason: reason?.trim() || null,
        notes: notes?.trim() || null,
      })
      .select(
        `id, instructor_id, created_by, start_date, end_date, start_time,
         end_time, is_all_day, reason, notes, source_template_id,
         created_at, updated_at`
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, unavailability: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — remove one row, self-scoped
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
      .from('instructor_unavailability')
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

    const { error } = await supabase
      .from('instructor_unavailability')
      .delete()
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
