import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cohortId = searchParams.get('cohortId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!cohortId) {
      return NextResponse.json({ success: false, error: 'Cohort ID required' }, { status: 400 });
    }

    // Get all students in the cohort
    const { data: students } = await supabase
      .from('students')
      .select('id')
      .eq('cohort_id', cohortId);

    const studentIds = students?.map(s => s.id) || [];

    if (studentIds.length === 0) {
      return NextResponse.json({ success: true, hours: [], pagination: { limit, offset, total: 0 } });
    }

    // Get clinical hours for these students
    const { data: hours, error, count } = await supabase
      .from('student_clinical_hours')
      .select(
        'id, student_id, cohort_id, psych_hours, psych_shifts, ed_hours, ed_shifts, icu_hours, icu_shifts, ob_hours, ob_shifts, or_hours, or_shifts, peds_ed_hours, peds_ed_shifts, peds_icu_hours, peds_icu_shifts, ems_field_hours, ems_field_shifts, cardiology_hours, cardiology_shifts, ems_ridealong_hours, ems_ridealong_shifts, total_hours, total_shifts, updated_at',
        { count: 'exact' }
      )
      .in('student_id', studentIds)
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({ success: true, hours: hours || [], pagination: { limit, offset, total: count || 0 } });
  } catch (error) {
    console.error('Error fetching clinical hours:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch clinical hours' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { student_id, cohort_id, ...hoursData } = body;

    if (!student_id) {
      return NextResponse.json({ success: false, error: 'Student ID required' }, { status: 400 });
    }

    // Check if record exists for this student
    const { data: existing } = await supabase
      .from('student_clinical_hours')
      .select('id')
      .eq('student_id', student_id)
      .maybeSingle();

    // Build update data (only include fields that are present in the request)
    const updateData: Record<string, unknown> = {
      ...hoursData,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existing) {
      // Update existing record
      result = await supabase
        .from('student_clinical_hours')
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      // Insert new record with student_id and cohort_id
      result = await supabase
        .from('student_clinical_hours')
        .insert({
          student_id,
          cohort_id,
          ...hoursData,
        })
        .select()
        .single();
    }

    if (result.error) throw result.error;

    return NextResponse.json({ success: true, hours: result.data });
  } catch (error) {
    console.error('Error saving clinical hours:', error);
    return NextResponse.json({ success: false, error: 'Failed to save clinical hours' }, { status: 500 });
  }
}
