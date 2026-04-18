import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

/**
 * Field trips API.
 *
 * Schema note: the `field_trips` table in production uses different
 * column names than the client payload. Column mapping:
 *   client `name`        → db `title`        (NOT NULL)
 *   client `location`    → db `destination`
 *   client `description` → db `description`  (dedicated column added
 *                          in migration 20260417, was previously
 *                          squatting on `notes`)
 *   `created_by`         — db uuid (lab_users.id), NOT email
 *
 * This route translates in both directions so the client can keep using
 * friendly names without a schema migration.
 */

type DbFieldTrip = {
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

function dbToClient(row: DbFieldTrip) {
  return {
    id: row.id,
    cohort_id: row.cohort_id,
    name: row.title,
    trip_date: row.trip_date,
    location: row.destination,
    // Prefer the new description column; fall back to notes for rows
    // created before the migration that may still have the blurb there.
    description: row.description ?? row.notes,
    departure_time: row.departure_time,
    return_time: row.return_time,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_active: row.is_active,
  };
}

// GET - List field trips for a cohort
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fieldTrips: any[] | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let error: any = null;

    const result = await supabase
      .from('field_trips')
      .select('*')
      .eq('cohort_id', cohortId)
      .eq('is_active', true)
      .order('trip_date', { ascending: false });

    fieldTrips = result.data;
    error = result.error;

    // If is_active column doesn't exist, retry without filter
    if (error && ((error as Error).message?.includes('is_active') || error?.code === '42703')) {
      console.warn('field_trips: is_active column not found, querying without filter');
      const fallback = await supabase
        .from('field_trips')
        .select('*')
        .eq('cohort_id', cohortId)
        .order('trip_date', { ascending: false });
      fieldTrips = fallback.data;
      error = fallback.error;
    }

    if (error) {
      // Table might not exist yet
      if (error?.code === '42P01') {
        return NextResponse.json({ success: true, fieldTrips: [] });
      }
      throw error;
    }

    const mapped = (fieldTrips || []).map((r) => dbToClient(r as DbFieldTrip));
    return NextResponse.json({ success: true, fieldTrips: mapped });
  } catch (error) {
    console.error('Error fetching field trips:', error);
    return NextResponse.json(
      { success: false, error: (error as Error)?.message || 'Failed to fetch field trips' },
      { status: 500 }
    );
  }
}

// POST - Create a new field trip
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { cohort_id, name, trip_date, location, description } = body;

    if (!cohort_id || !name || !trip_date) {
      return NextResponse.json(
        { success: false, error: 'cohort_id, name, and trip_date are required' },
        { status: 400 }
      );
    }

    // Translate client payload to DB schema. created_by must be a uuid
    // (lab_users.id), NOT an email — using session.user.email here was the
    // original 500 cause on 2026-04-17.
    const { data: fieldTrip, error } = await supabase
      .from('field_trips')
      .insert({
        cohort_id,
        title: name,
        trip_date,
        destination: location || null,
        description: description || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      fieldTrip: fieldTrip ? dbToClient(fieldTrip as DbFieldTrip) : null,
    });
  } catch (error) {
    console.error('Error creating field trip:', error);
    return NextResponse.json(
      { success: false, error: (error as Error)?.message || 'Failed to create field trip' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a field trip (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Field trip ID is required' }, { status: 400 });
    }

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('field_trips')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting field trip:', error);
    return NextResponse.json(
      { success: false, error: (error as Error)?.message || 'Failed to delete field trip' },
      { status: 500 }
    );
  }
}
