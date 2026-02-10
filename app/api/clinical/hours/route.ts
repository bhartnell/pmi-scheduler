import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// All hour/shift column pairs in the wide table
const HOUR_FIELDS = [
  'psych_hours', 'psych_shifts',
  'ed_hours', 'ed_shifts',
  'icu_hours', 'icu_shifts',
  'ob_hours', 'ob_shifts',
  'or_hours', 'or_shifts',
  'peds_ed_hours', 'peds_ed_shifts',
  'peds_icu_hours', 'peds_icu_shifts',
  'ems_field_hours', 'ems_field_shifts',
  'cardiology_hours', 'cardiology_shifts',
] as const;

// Calculate totals from individual department hours/shifts
function calculateTotals(data: Record<string, number | null>) {
  let total_hours = 0;
  let total_shifts = 0;

  for (const field of HOUR_FIELDS) {
    const value = data[field] || 0;
    if (field.endsWith('_hours')) {
      total_hours += value;
    } else if (field.endsWith('_shifts')) {
      total_shifts += value;
    }
  }

  return { total_hours, total_shifts };
}

// GET - Fetch clinical hours for a student or all students in a cohort
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const cohortId = searchParams.get('cohortId');

    if (!studentId && !cohortId) {
      return NextResponse.json({ success: false, error: 'Student ID or Cohort ID required' }, { status: 400 });
    }

    if (studentId) {
      // Fetch single student's hours
      const { data, error } = await supabase
        .from('student_clinical_hours')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle();

      if (error) throw error;

      return NextResponse.json({ success: true, hours: data });
    }

    // Fetch all students in cohort with their hours
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('cohort_id', cohortId)
      .in('status', ['active', 'enrolled'])
      .order('last_name')
      .order('first_name');

    if (studentsError) throw studentsError;

    if (!students || students.length === 0) {
      return NextResponse.json({ success: true, hours: [] });
    }

    const studentIds = students.map(s => s.id);

    // Get hours for all students
    const { data: hoursData, error: hoursError } = await supabase
      .from('student_clinical_hours')
      .select('*')
      .in('student_id', studentIds);

    if (hoursError) throw hoursError;

    // Map hours to students
    const hoursMap = new Map(hoursData?.map(h => [h.student_id, h]) || []);

    const result = students.map(student => ({
      student_id: student.id,
      first_name: student.first_name,
      last_name: student.last_name,
      ...hoursMap.get(student.id) || {
        psych_hours: 0, psych_shifts: 0,
        ed_hours: 0, ed_shifts: 0,
        icu_hours: 0, icu_shifts: 0,
        ob_hours: 0, ob_shifts: 0,
        or_hours: 0, or_shifts: 0,
        peds_ed_hours: 0, peds_ed_shifts: 0,
        peds_icu_hours: 0, peds_icu_shifts: 0,
        ems_field_hours: 0, ems_field_shifts: 0,
        cardiology_hours: 0, cardiology_shifts: 0,
        total_hours: 0, total_shifts: 0,
      }
    }));

    return NextResponse.json({ success: true, hours: result });
  } catch (error) {
    console.error('Error fetching clinical hours:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch clinical hours' }, { status: 500 });
  }
}

// POST - Create or update clinical hours (upsert)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { student_id, cohort_id, ...hourData } = body;

    if (!student_id) {
      return NextResponse.json({ success: false, error: 'Student ID required' }, { status: 400 });
    }

    // Build update object with only valid hour/shift fields
    const updateData: Record<string, number | null> = {};
    for (const field of HOUR_FIELDS) {
      if (field in hourData) {
        updateData[field] = hourData[field] ?? 0;
      }
    }

    // Check if record exists
    const { data: existing } = await supabase
      .from('student_clinical_hours')
      .select('*')
      .eq('student_id', student_id)
      .maybeSingle();

    let result;
    if (existing && typeof existing === 'object' && 'id' in existing) {
      // Merge existing values with updates for total calculation
      const existingRecord = existing as Record<string, unknown>;
      const mergedData: Record<string, number | null> = {};
      for (const field of HOUR_FIELDS) {
        mergedData[field] = (field in updateData ? updateData[field] : existingRecord[field]) as number | null;
      }
      const totals = calculateTotals(mergedData);

      result = await supabase
        .from('student_clinical_hours')
        .update({
          ...updateData,
          ...totals,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id as string)
        .select()
        .single();
    } else {
      // Insert new record with totals
      const totals = calculateTotals(updateData);

      result = await supabase
        .from('student_clinical_hours')
        .insert({
          student_id,
          cohort_id: cohort_id || null,
          ...updateData,
          ...totals,
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

// PATCH - Update specific fields for a student's clinical hours
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { student_id, ...hourData } = body;

    if (!student_id) {
      return NextResponse.json({ success: false, error: 'Student ID required' }, { status: 400 });
    }

    // Get existing record
    const { data: existing, error: fetchError } = await supabase
      .from('student_clinical_hours')
      .select('*')
      .eq('student_id', student_id)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!existing) {
      return NextResponse.json({ success: false, error: 'No hours record found for this student' }, { status: 404 });
    }

    // Build update object with only valid hour/shift fields
    const updateData: Record<string, number | null> = {};
    for (const field of HOUR_FIELDS) {
      if (field in hourData) {
        updateData[field] = hourData[field] ?? 0;
      }
    }

    // Merge and calculate new totals
    const mergedData = { ...existing, ...updateData };
    const totals = calculateTotals(mergedData);

    const { data, error } = await supabase
      .from('student_clinical_hours')
      .update({
        ...updateData,
        ...totals,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, hours: data });
  } catch (error) {
    console.error('Error updating clinical hours:', error);
    return NextResponse.json({ success: false, error: 'Failed to update clinical hours' }, { status: 500 });
  }
}
