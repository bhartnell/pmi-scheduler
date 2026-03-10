import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logRecordAccess } from '@/lib/ferpa';

// ---------------------------------------------------------------------------
// GET /api/ferpa/release?cohort_id=...&student_id=...
//
// Return FERPA release status for students. Admin/lead_instructor+ only.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const auth = await requireAuth('lead_instructor');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const supabase = getSupabaseAdmin();
  const cohortId = request.nextUrl.searchParams.get('cohort_id');
  const studentId = request.nextUrl.searchParams.get('student_id');

  let query = supabase
    .from('students')
    .select('id, first_name, last_name, cohort_id, ferpa_agency_release, ferpa_release_date, ferpa_release_agency');

  if (studentId) {
    query = query.eq('id', studentId);
  } else if (cohortId) {
    query = query.eq('cohort_id', cohortId);
  }

  query = query.order('last_name', { ascending: true });

  const { data: students, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log access
  logRecordAccess({
    userEmail: user.email,
    userRole: user.role,
    dataType: 'profile',
    action: studentId ? 'view' : 'bulk_view',
    route: '/api/ferpa/release',
    details: { cohortId, studentId, count: students?.length },
  }).catch(() => {});

  return NextResponse.json({ students: students || [] });
}

// ---------------------------------------------------------------------------
// PUT /api/ferpa/release
//
// Set FERPA release for a single student. Admin+ only.
// Body: { student_id, ferpa_agency_release, ferpa_release_agency }
// ---------------------------------------------------------------------------
export async function PUT(request: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const body = await request.json();
  const { student_id, ferpa_agency_release, ferpa_release_agency } = body;

  if (!student_id) {
    return NextResponse.json({ error: 'student_id is required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('students')
    .update({
      ferpa_agency_release: !!ferpa_agency_release,
      ferpa_release_date: ferpa_agency_release ? new Date().toISOString().split('T')[0] : null,
      ferpa_release_agency: ferpa_agency_release ? (ferpa_release_agency || null) : null,
    })
    .eq('id', student_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log the modification
  logRecordAccess({
    userEmail: user.email,
    userRole: user.role,
    studentId: student_id,
    dataType: 'profile',
    action: 'modify',
    route: '/api/ferpa/release',
    details: { ferpa_agency_release, ferpa_release_agency },
  }).catch(() => {});

  return NextResponse.json({ success: true });
}

// ---------------------------------------------------------------------------
// PATCH /api/ferpa/release
//
// Bulk set FERPA releases. Admin+ only.
// Body: { student_ids: string[], ferpa_agency_release: boolean, ferpa_release_agency: string }
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const body = await request.json();
  const { student_ids, ferpa_agency_release, ferpa_release_agency } = body;

  if (!Array.isArray(student_ids) || student_ids.length === 0) {
    return NextResponse.json({ error: 'student_ids array is required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('students')
    .update({
      ferpa_agency_release: !!ferpa_agency_release,
      ferpa_release_date: ferpa_agency_release ? new Date().toISOString().split('T')[0] : null,
      ferpa_release_agency: ferpa_agency_release ? (ferpa_release_agency || null) : null,
    })
    .in('id', student_ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log bulk modification
  logRecordAccess({
    userEmail: user.email,
    userRole: user.role,
    dataType: 'profile',
    action: 'modify',
    route: '/api/ferpa/release',
    details: { bulk: true, count: student_ids.length, ferpa_agency_release, ferpa_release_agency },
  }).catch(() => {});

  return NextResponse.json({ success: true, updated: student_ids.length });
}
