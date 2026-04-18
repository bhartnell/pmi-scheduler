import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Checklists API.
 *
 * Repurposed from the old field_trips feature (see migration
 * 20260418_rename_field_trips_to_checklists). A checklist is a
 * cohort-scoped list of students with per-student attendance/completion
 * tracking — e.g. NREMT Documentation, End of Semester Skills Review,
 * Equipment Inspection, Sheep Pluck Lab.
 *
 * Schema note: several columns retain their old names because every
 * client in this codebase maps through the dbToClient/client-in layer.
 * Column mapping (kept backwards-compatible):
 *   client `name`        → db `title`        (NOT NULL)  — the
 *                          checklist's display name
 *   client `location`    → db `destination`  — optional, carried over
 *                          from field trip semantics
 *   client `description` → db `description`
 *   client `date`        → db `trip_date`    — the date the checklist
 *                          applies to
 *   `created_by`         — db uuid (lab_users.id), NOT email
 *
 * The client may send either `date` or `trip_date`; both map to db
 * `trip_date`. Responses return BOTH keys (`date` and `trip_date`) so
 * older callers continue to work during the rename rollout.
 */

type DbChecklist = {
  id: string;
  cohort_id: string;
  title: string;
  destination: string | null;
  trip_date: string;
  departure_time: string | null;
  return_time: string | null;
  description: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_active: boolean | null;
};

function dbToClient(row: DbChecklist) {
  return {
    id: row.id,
    cohort_id: row.cohort_id,
    name: row.title,
    date: row.trip_date,
    // trip_date retained for any caller still using the old key.
    trip_date: row.trip_date,
    location: row.destination,
    // Prefer the dedicated description column; fall back to the legacy
    // notes column for rows created before migration 20260417.
    description: row.description ?? row.notes,
    departure_time: row.departure_time,
    return_time: row.return_time,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_active: row.is_active,
  };
}

// GET - List checklists for a cohort
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();

    const searchParams = request.nextUrl.searchParams;
    const cohortId = searchParams.get('cohortId');

    if (!cohortId) {
      return NextResponse.json({ error: 'cohortId is required' }, { status: 400 });
    }

    let checklists: any[] | null = null;
    let error: any = null;

    const result = await supabase
      .from('checklists')
      .select('*')
      .eq('cohort_id', cohortId)
      .eq('is_active', true)
      .order('trip_date', { ascending: false });

    checklists = result.data;
    error = result.error;

    if (error && ((error as Error).message?.includes('is_active') || error?.code === '42703')) {
      console.warn('checklists: is_active column not found, querying without filter');
      const fallback = await supabase
        .from('checklists')
        .select('*')
        .eq('cohort_id', cohortId)
        .order('trip_date', { ascending: false });
      checklists = fallback.data;
      error = fallback.error;
    }

    if (error) {
      if (error?.code === '42P01') {
        return NextResponse.json({ success: true, checklists: [], fieldTrips: [] });
      }
      throw error;
    }

    const mapped = (checklists || []).map((r) => dbToClient(r as DbChecklist));
    // Both keys in the response for backwards compatibility. Callers
    // updated to use `checklists` can drop the duplicate.
    return NextResponse.json({ success: true, checklists: mapped, fieldTrips: mapped });
  } catch (error) {
    console.error('Error fetching checklists:', error);
    return NextResponse.json(
      { success: false, error: (error as Error)?.message || 'Failed to fetch checklists' },
      { status: 500 }
    );
  }
}

// POST - Create a new checklist
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const {
      cohort_id,
      name,
      // Accept either `date` or `trip_date` — new UI uses `date`, older
      // callers send `trip_date`. Prefer `date` when both are provided.
      date,
      trip_date,
      location,
      description,
    } = body;
    const effectiveDate = date || trip_date;

    if (!cohort_id || !name || !effectiveDate) {
      return NextResponse.json(
        { success: false, error: 'cohort_id, name, and date are required' },
        { status: 400 }
      );
    }

    // created_by must be a uuid (lab_users.id), NOT an email — the
    // original 500 cause on 2026-04-17 was session.user.email here.
    const { data: checklist, error } = await supabase
      .from('checklists')
      .insert({
        cohort_id,
        title: String(name).trim(),
        trip_date: effectiveDate,
        destination: location || null,
        description: description || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    const mapped = checklist ? dbToClient(checklist as DbChecklist) : null;
    return NextResponse.json({
      success: true,
      checklist: mapped,
      fieldTrip: mapped,
    });
  } catch (error) {
    console.error('Error creating checklist:', error);
    return NextResponse.json(
      { success: false, error: (error as Error)?.message || 'Failed to create checklist' },
      { status: 500 }
    );
  }
}

// DELETE - Soft-delete a checklist
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Checklist ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('checklists')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting checklist:', error);
    return NextResponse.json(
      { success: false, error: (error as Error)?.message || 'Failed to delete checklist' },
      { status: 500 }
    );
  }
}
