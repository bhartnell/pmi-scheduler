import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// GET - List field trips for a cohort
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const supabase = getSupabaseAdmin();

    const searchParams = request.nextUrl.searchParams;
    const cohortId = searchParams.get('cohortId');

    if (!cohortId) {
      return NextResponse.json({ error: 'cohortId is required' }, { status: 400 });
    }

    let fieldTrips = null;
    let error = null;

    // Try with is_active filter first
    const result = await supabase
      .from('field_trips')
      .select('*')
      .eq('cohort_id', cohortId)
      .eq('is_active', true)
      .order('trip_date', { ascending: false });

    fieldTrips = result.data;
    error = result.error;

    // If is_active column doesn't exist, retry without filter
    if (error && ((error as Error).message?.includes('is_active') || (error as any).code === '42703')) {
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
      if ((error as any).code === '42P01') {
        return NextResponse.json({ success: true, fieldTrips: [] });
      }
      throw error;
    }

    return NextResponse.json({ success: true, fieldTrips: fieldTrips || [] });
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
    const { user, session } = auth;

    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { cohort_id, name, trip_date, location, description } = body;

    if (!cohort_id || !name || !trip_date) {
      return NextResponse.json(
        { success: false, error: 'cohort_id, name, and trip_date are required' },
        { status: 400 }
      );
    }

    const { data: fieldTrip, error } = await supabase
      .from('field_trips')
      .insert({
        cohort_id,
        name,
        trip_date,
        location: location || null,
        description: description || null,
        created_by: session.user.email,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, fieldTrip });
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
    const { user } = auth;

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
