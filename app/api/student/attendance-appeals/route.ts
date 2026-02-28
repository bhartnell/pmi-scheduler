import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/student/attendance-appeals
 * Returns the authenticated student's own attendance appeals, newest first.
 *
 * POST /api/student/attendance-appeals
 * Submit a new attendance appeal.
 * Body: { absence_date, reason, documentation_url?, lab_day_id? }
 */

async function getStudentRecord(supabase: ReturnType<typeof getSupabaseAdmin>, email: string) {
  // First confirm this is a student account
  const { data: labUser } = await supabase
    .from('lab_users')
    .select('id, role')
    .ilike('email', email)
    .single();

  if (!labUser || labUser.role !== 'student') return null;

  // Find matching student record by email
  const { data: student } = await supabase
    .from('students')
    .select('id, first_name, last_name, email')
    .ilike('email', email)
    .single();

  return student;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const student = await getStudentRecord(supabase, session.user.email);

    if (!student) {
      return NextResponse.json(
        { success: false, error: 'Student record not found' },
        { status: 404 }
      );
    }

    const { data: appeals, error } = await supabase
      .from('attendance_appeals')
      .select(`
        id,
        absence_date,
        reason,
        documentation_url,
        status,
        review_notes,
        created_at,
        updated_at,
        reviewer:lab_users!attendance_appeals_reviewed_by_fkey(id, name)
      `)
      .eq('student_id', student.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, appeals: appeals || [] });
  } catch (error) {
    console.error('Error fetching student attendance appeals:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch appeals' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const student = await getStudentRecord(supabase, session.user.email);

    if (!student) {
      return NextResponse.json(
        { success: false, error: 'Student record not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { absence_date, reason, documentation_url, lab_day_id } = body;

    if (!absence_date || !reason?.trim()) {
      return NextResponse.json(
        { success: false, error: 'absence_date and reason are required' },
        { status: 400 }
      );
    }

    // Prevent duplicate pending appeals for the same date
    const { data: existing } = await supabase
      .from('attendance_appeals')
      .select('id')
      .eq('student_id', student.id)
      .eq('absence_date', absence_date)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'A pending appeal already exists for this date' },
        { status: 409 }
      );
    }

    const { data: appeal, error } = await supabase
      .from('attendance_appeals')
      .insert({
        student_id: student.id,
        absence_date,
        reason: reason.trim(),
        documentation_url: documentation_url?.trim() || null,
        lab_day_id: lab_day_id || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, appeal }, { status: 201 });
  } catch (error) {
    console.error('Error submitting attendance appeal:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit appeal' },
      { status: 500 }
    );
  }
}
