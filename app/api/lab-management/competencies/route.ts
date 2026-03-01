import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const studentId = searchParams.get('student_id');
  const skillId = searchParams.get('skill_id');
  const cohortId = searchParams.get('cohort_id');

  try {
    const supabase = getSupabaseAdmin();

    // If cohort_id is provided, fetch all students in cohort and their competencies
    if (cohortId) {
      // Get students in the cohort
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id, first_name, last_name, status')
        .eq('cohort_id', cohortId)
        .eq('status', 'active')
        .order('last_name')
        .order('first_name');

      if (studentsError) throw studentsError;

      if (!students || students.length === 0) {
        return NextResponse.json({ success: true, competencies: [], students: [] });
      }

      const studentIds = students.map((s: { id: string }) => s.id);

      // Get all competency records for these students
      const { data: competencies, error: compError } = await supabase
        .from('skill_competencies')
        .select('*')
        .in('student_id', studentIds);

      if (compError) throw compError;

      return NextResponse.json({
        success: true,
        students,
        competencies: competencies || [],
      });
    }

    // Otherwise, filter by student_id and/or skill_id
    let query = supabase
      .from('skill_competencies')
      .select(`
        *,
        student:students(id, first_name, last_name),
        skill:skills(id, name, category)
      `)
      .order('updated_at', { ascending: false });

    if (studentId) query = query.eq('student_id', studentId);
    if (skillId) query = query.eq('skill_id', skillId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, competencies: data || [] });
  } catch (err) {
    console.error('Error fetching competencies:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch competencies' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only instructors and above can update competency levels
  const userRole = (session.user as { role?: string }).role || 'guest';
  if (!hasMinRole(userRole, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { student_id, skill_id, level, demonstrations, notes } = body;

    if (!student_id || !skill_id || !level) {
      return NextResponse.json(
        { success: false, error: 'student_id, skill_id, and level are required' },
        { status: 400 }
      );
    }

    const validLevels = ['introduced', 'practiced', 'competent', 'proficient'];
    if (!validLevels.includes(level)) {
      return NextResponse.json(
        { success: false, error: `level must be one of: ${validLevels.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('skill_competencies')
      .upsert(
        {
          student_id,
          skill_id,
          level,
          demonstrations: demonstrations ?? 0,
          notes: notes ?? null,
          updated_by: session.user.email,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'student_id,skill_id' }
      )
      .select(`
        *,
        student:students(id, first_name, last_name),
        skill:skills(id, name, category)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, competency: data });
  } catch (err) {
    console.error('Error upserting competency:', err);
    return NextResponse.json({ success: false, error: 'Failed to save competency' }, { status: 500 });
  }
}
