import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/checkin/[token]
// PUBLIC — no auth required
// Returns lab day info (title, date, cohort, student list) for the check-in page
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Validate token and check that check-in is enabled
  const { data: labDay, error: labDayError } = await supabase
    .from('lab_days')
    .select(`
      id,
      date,
      title,
      checkin_enabled,
      cohort:cohorts(
        id,
        cohort_number,
        program:programs(name, abbreviation)
      )
    `)
    .eq('checkin_token', token)
    .single();

  if (labDayError || !labDay) {
    return NextResponse.json({ error: 'Check-in not found or expired' }, { status: 404 });
  }

  if (!labDay.checkin_enabled) {
    return NextResponse.json({ error: 'Check-in is not currently enabled for this lab day' }, { status: 403 });
  }

  const cohort = labDay.cohort as unknown as {
    id: string;
    cohort_number: number;
    program: { name: string; abbreviation: string };
  } | null;

  if (!cohort) {
    return NextResponse.json({ error: 'No cohort assigned to this lab day' }, { status: 400 });
  }

  // Fetch active students in the cohort
  const { data: students, error: studentsError } = await supabase
    .from('students')
    .select('id, first_name, last_name')
    .eq('cohort_id', cohort.id)
    .eq('status', 'active')
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true });

  if (studentsError) {
    console.error('Error fetching students:', studentsError);
    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
  }

  // Fetch existing attendance records for this lab day so we know who already checked in
  const { data: attendanceRecords, error: attendanceError } = await supabase
    .from('lab_day_attendance')
    .select('student_id, status')
    .eq('lab_day_id', labDay.id);

  if (attendanceError) {
    console.error('Error fetching attendance:', attendanceError);
    return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 });
  }

  // Build set of already-present student IDs
  const presentStudentIds = new Set(
    (attendanceRecords || [])
      .filter(r => r.status === 'present')
      .map(r => r.student_id)
  );

  const studentList = (students || []).map(s => ({
    id: s.id,
    first_name: s.first_name,
    last_name: s.last_name,
    checked_in: presentStudentIds.has(s.id),
  }));

  return NextResponse.json({
    success: true,
    labDay: {
      id: labDay.id,
      date: labDay.date,
      title: labDay.title,
    },
    cohort: {
      id: cohort.id,
      cohort_number: cohort.cohort_number,
      program_name: cohort.program.name,
      program_abbreviation: cohort.program.abbreviation,
    },
    students: studentList,
  });
}

// POST /api/checkin/[token]
// PUBLIC — no auth required
// Body: { student_id: string }
// Marks a student as present in lab_day_attendance
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Validate token and that check-in is enabled
  const { data: labDay, error: labDayError } = await supabase
    .from('lab_days')
    .select('id, checkin_enabled, cohort_id')
    .eq('checkin_token', token)
    .single();

  if (labDayError || !labDay) {
    return NextResponse.json({ error: 'Check-in not found or expired' }, { status: 404 });
  }

  if (!labDay.checkin_enabled) {
    return NextResponse.json({ error: 'Check-in is not currently enabled' }, { status: 403 });
  }

  // Parse body
  let body: { student_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { student_id } = body;
  if (!student_id) {
    return NextResponse.json({ error: 'student_id is required' }, { status: 400 });
  }

  // Verify the student belongs to this lab day's cohort
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id, first_name, last_name, cohort_id')
    .eq('id', student_id)
    .eq('cohort_id', labDay.cohort_id)
    .eq('status', 'active')
    .single();

  if (studentError || !student) {
    return NextResponse.json({ error: 'Student not found in this cohort' }, { status: 404 });
  }

  // Upsert attendance record — mark as present
  const now = new Date().toISOString();
  const { error: upsertError } = await supabase
    .from('lab_day_attendance')
    .upsert(
      {
        lab_day_id: labDay.id,
        student_id,
        status: 'present',
        notes: 'Self check-in',
        marked_by: 'self-checkin',
        marked_at: now,
        updated_at: now,
      },
      { onConflict: 'lab_day_id,student_id' }
    );

  if (upsertError) {
    console.error('Error recording check-in:', upsertError);
    return NextResponse.json({ error: 'Failed to record check-in' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: `${student.first_name} ${student.last_name} checked in successfully`,
  });
}
