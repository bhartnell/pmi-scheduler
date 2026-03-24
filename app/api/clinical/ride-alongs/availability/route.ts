import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// GET /api/clinical/ride-alongs/availability — list all availability records
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    const cohortId = searchParams.get('cohort_id');
    const semesterId = searchParams.get('semester_id');
    const studentId = searchParams.get('student_id');

    let query = supabase
      .from('ride_along_availability')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (cohortId) query = query.eq('cohort_id', cohortId);
    if (semesterId) query = query.eq('semester_id', semesterId);
    if (studentId) query = query.eq('student_id', studentId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, availability: data || [] });
  } catch (error) {
    console.error('Error fetching ride-along availability:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch availability' }, { status: 500 });
  }
}

// POST /api/clinical/ride-alongs/availability — submit or update availability
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const {
      student_id, cohort_id, semester_id,
      available_days, preferred_shift_type,
      preferred_dates, unavailable_dates, notes
    } = body;

    if (!student_id) {
      return NextResponse.json({ success: false, error: 'student_id is required' }, { status: 400 });
    }

    // Upsert: check if student already has availability for this cohort/semester
    const matchQuery = supabase
      .from('ride_along_availability')
      .select('id')
      .eq('student_id', student_id);

    if (cohort_id) matchQuery.eq('cohort_id', cohort_id);
    if (semester_id) matchQuery.eq('semester_id', semester_id);

    const { data: existing } = await matchQuery.maybeSingle();

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('ride_along_availability')
        .update({
          available_days: available_days || {},
          preferred_shift_type: preferred_shift_type || [],
          preferred_dates: preferred_dates || [],
          unavailable_dates: unavailable_dates || [],
          notes: notes || null,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, availability: data, updated: true });
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('ride_along_availability')
        .insert({
          student_id,
          cohort_id: cohort_id || null,
          semester_id: semester_id || null,
          available_days: available_days || {},
          preferred_shift_type: preferred_shift_type || [],
          preferred_dates: preferred_dates || [],
          unavailable_dates: unavailable_dates || [],
          notes: notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, availability: data, updated: false });
    }
  } catch (error) {
    console.error('Error saving ride-along availability:', error);
    return NextResponse.json({ success: false, error: 'Failed to save availability' }, { status: 500 });
  }
}
