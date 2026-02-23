import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// GET /api/lab-management/lab-days/[id]/attendance
// Returns all students in the cohort merged with their attendance status for this lab day
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();

  // Check role
  const { data: requestingUser } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', session.user.email)
    .single();

  const userRole = requestingUser?.role || 'guest';
  if (!hasMinRole(userRole, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Get the lab day's cohort_id
    const { data: labDay, error: labDayError } = await supabase
      .from('lab_days')
      .select('id, cohort_id')
      .eq('id', labDayId)
      .single();

    if (labDayError || !labDay) {
      return NextResponse.json({ error: 'Lab day not found' }, { status: 404 });
    }

    if (!labDay.cohort_id) {
      return NextResponse.json({ students: [], summary: { total: 0, present: 0, absent: 0, excused: 0, late: 0, unmarked: 0 } });
    }

    // Fetch all active students in the cohort
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, first_name, last_name, email, photo_url')
      .eq('cohort_id', labDay.cohort_id)
      .eq('status', 'active')
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });

    if (studentsError) throw studentsError;

    // Fetch existing attendance records for this lab day
    const { data: attendanceRecords, error: attendanceError } = await supabase
      .from('lab_day_attendance')
      .select('student_id, status, notes, marked_by, marked_at')
      .eq('lab_day_id', labDayId);

    if (attendanceError) throw attendanceError;

    // Build a map of student_id -> attendance record
    const attendanceMap = new Map<string, {
      status: string;
      notes: string | null;
      marked_by: string;
      marked_at: string;
    }>();
    for (const record of attendanceRecords || []) {
      attendanceMap.set(record.student_id, record);
    }

    // Merge students with attendance data
    const mergedStudents = (students || []).map(student => {
      const record = attendanceMap.get(student.id);
      return {
        student_id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email,
        photo_url: student.photo_url,
        status: record?.status || null,
        notes: record?.notes || null,
        marked_by: record?.marked_by || null,
        marked_at: record?.marked_at || null,
      };
    });

    // Sort: unmarked first, then alphabetical by last name
    mergedStudents.sort((a, b) => {
      if (!a.status && b.status) return -1;
      if (a.status && !b.status) return 1;
      const lastNameCmp = a.last_name.localeCompare(b.last_name);
      if (lastNameCmp !== 0) return lastNameCmp;
      return a.first_name.localeCompare(b.first_name);
    });

    // Build summary
    const total = mergedStudents.length;
    const present = mergedStudents.filter(s => s.status === 'present').length;
    const absent = mergedStudents.filter(s => s.status === 'absent').length;
    const excused = mergedStudents.filter(s => s.status === 'excused').length;
    const late = mergedStudents.filter(s => s.status === 'late').length;
    const unmarked = mergedStudents.filter(s => !s.status).length;

    return NextResponse.json({
      students: mergedStudents,
      summary: { total, present, absent, excused, late, unmarked },
    });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 });
  }
}

// PUT /api/lab-management/lab-days/[id]/attendance
// Upsert a single student's attendance record
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();

  // Check role
  const { data: requestingUser } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', session.user.email)
    .single();

  const userRole = requestingUser?.role || 'guest';
  if (!hasMinRole(userRole, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { student_id, status, notes } = body;

    if (!student_id || !status) {
      return NextResponse.json({ error: 'student_id and status are required' }, { status: 400 });
    }

    const validStatuses = ['present', 'absent', 'excused', 'late'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('lab_day_attendance')
      .upsert(
        {
          lab_day_id: labDayId,
          student_id,
          status,
          notes: notes || null,
          marked_by: session.user.email,
          marked_at: now,
          updated_at: now,
        },
        { onConflict: 'lab_day_id,student_id' }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, record: data });
  } catch (error) {
    console.error('Error updating attendance:', error);
    return NextResponse.json({ error: 'Failed to update attendance' }, { status: 500 });
  }
}

// POST /api/lab-management/lab-days/[id]/attendance
// Bulk upsert attendance records (e.g., "Mark All Present")
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();

  // Check role
  const { data: requestingUser } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', session.user.email)
    .single();

  const userRole = requestingUser?.role || 'guest';
  if (!hasMinRole(userRole, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { records } = body as { records: Array<{ student_id: string; status: string; notes?: string }> };

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'records array is required' }, { status: 400 });
    }

    const validStatuses = ['present', 'absent', 'excused', 'late'];
    const now = new Date().toISOString();
    const markedBy = session!.user!.email!;

    const upsertRows = records
      .filter(r => r.student_id && validStatuses.includes(r.status))
      .map(r => ({
        lab_day_id: labDayId,
        student_id: r.student_id,
        status: r.status,
        notes: r.notes || null,
        marked_by: markedBy,
        marked_at: now,
        updated_at: now,
      }));

    if (upsertRows.length === 0) {
      return NextResponse.json({ error: 'No valid records to upsert' }, { status: 400 });
    }

    const { error } = await supabase
      .from('lab_day_attendance')
      .upsert(upsertRows, { onConflict: 'lab_day_id,student_id' });

    if (error) throw error;

    // Return summary
    const present = upsertRows.filter(r => r.status === 'present').length;
    const absent = upsertRows.filter(r => r.status === 'absent').length;
    const excused = upsertRows.filter(r => r.status === 'excused').length;
    const late = upsertRows.filter(r => r.status === 'late').length;

    return NextResponse.json({
      success: true,
      summary: { total: upsertRows.length, present, absent, excused, late },
    });
  } catch (error) {
    console.error('Error bulk updating attendance:', error);
    return NextResponse.json({ error: 'Failed to bulk update attendance' }, { status: 500 });
  }
}
