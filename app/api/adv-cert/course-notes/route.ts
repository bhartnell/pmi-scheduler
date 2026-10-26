import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

/**
 * GET /api/adv-cert/course-notes?cohortId=&course=pals|acls
 * PUT /api/adv-cert/course-notes  { cohortId, course, date, content }
 *
 * Per-course, per-day instruction notes (PALS P5d). Any instructor may read and
 * edit; last write wins and records who saved. Notes are stored, never generated.
 */
const COURSES = ['acls', 'pals'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_LEN = 20000;

export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const sp = request.nextUrl.searchParams;
  const cohortId = sp.get('cohortId');
  const course = sp.get('course');
  if (!cohortId || !course || !COURSES.includes(course)) {
    return NextResponse.json({ success: false, error: 'cohortId and course (acls|pals) are required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('adv_cert_course_notes')
      .select('note_date, content, updated_by, updated_at')
      .eq('cohort_id', cohortId)
      .eq('cert_course', course)
      .order('note_date');
    if (error) throw error;
    return NextResponse.json({ success: true, notes: data || [] });
  } catch (error) {
    console.error('Error loading course notes:', error);
    return NextResponse.json({ success: false, error: 'Failed to load course notes' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { cohortId, course, date, content } = body || {};
    if (!cohortId || !COURSES.includes(course) || typeof date !== 'string' || !DATE_RE.test(date) || typeof content !== 'string') {
      return NextResponse.json({ success: false, error: 'cohortId, course, date (YYYY-MM-DD) and content are required' }, { status: 400 });
    }
    if (content.length > MAX_LEN) {
      return NextResponse.json({ success: false, error: `Notes are limited to ${MAX_LEN} characters` }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('adv_cert_course_notes')
      .upsert(
        {
          cohort_id: cohortId,
          cert_course: course,
          note_date: date,
          content,
          updated_by: auth.user.email,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'cohort_id,cert_course,note_date' },
      )
      .select('note_date, content, updated_by, updated_at')
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, note: data });
  } catch (error) {
    console.error('Error saving course note:', error);
    return NextResponse.json({ success: false, error: 'Failed to save course note' }, { status: 500 });
  }
}
