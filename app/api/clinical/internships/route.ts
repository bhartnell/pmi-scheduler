import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { requireAuth } from '@/lib/api-auth';
import { logAuditEvent } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const auth = await requireAuth('instructor');

    if (auth instanceof NextResponse) return auth;

    const { user, session } = auth;

    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !hasMinRole(callerUser.role, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const cohortId = searchParams.get('cohortId');
    const status = searchParams.get('status');
    const phase = searchParams.get('phase');
    const agencyId = searchParams.get('agencyId');
    // includeWithdrawn=true asks the API to return internships whose
    // student status is 'withdrawn'. Default behaviour stays
    // "exclude withdrawn" so the cohort tracker never accidentally
    // shows them; the cohort page's "Show withdrawn" toggle is the
    // only known caller that flips this on.
    const includeWithdrawn = searchParams.get('includeWithdrawn') === 'true';

    // !inner turns the embed into an inner join so .neq on students.status
    // filters the internships list, not just the embedded student object.
    // Without !inner the filter silently no-ops and withdrawn students
    // (Mccracken, Salazar Salgado) leak back onto /clinical/internships.
    let query = supabase
      .from('student_internships')
      .select(`
        *,
        students!inner (
          id,
          first_name,
          last_name,
          email,
          status
        ),
        cohorts (
          id,
          cohort_number,
          programs (
            id,
            name,
            abbreviation
          )
        ),
        field_preceptors (
          id,
          first_name,
          last_name,
          email,
          phone,
          station,
          agency_name
        ),
        agencies (
          id,
          name,
          abbreviation
        )
      `)
      .order('created_at', { ascending: false });

    if (!includeWithdrawn) {
      query = query.neq('students.status', 'withdrawn');
      // student_internships has its OWN 'withdrawn' status value
      // (independent of students.status — a student can be withdrawn
      // from just this internship/rotation while staying active
      // overall). The check above only ever caught the student-level
      // flag, so an internship-level withdrawal leaked through
      // regardless of the cohort page's toggle. Skip this exclusion
      // when the caller explicitly asked for status=withdrawn (the
      // "all internships" filter dropdown's intentional use case).
      if (status !== 'withdrawn') {
        query = query.neq('status', 'withdrawn');
      }
    }

    if (cohortId) {
      query = query.eq('cohort_id', cohortId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (phase) {
      query = query.eq('current_phase', phase);
    }

    if (agencyId) {
      query = query.eq('agency_id', agencyId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Deduplicate by student_id when querying a specific cohort. A student
    // should appear once per cohort even if they have multiple
    // student_internships rows (e.g. legacy dual-tracking records from
    // Group 12 that predate the webapp). Keep the most recent row (query is
    // already ordered created_at DESC). Cross-cohort queries are not
    // deduplicated — a student may legitimately appear in multiple cohorts.
    let internships = data || [];
    if (cohortId) {
      const seen = new Set<string>();
      internships = internships.filter(i => {
        const sid: string | undefined = (i.students as { id?: string } | null)?.id ?? i.student_id;
        if (!sid || seen.has(sid)) return false;
        seen.add(sid);
        return true;
      });
    }

    return NextResponse.json({ success: true, internships });
  } catch (error) {
    console.error('Error fetching internships:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch internships' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user, session } = auth;

    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !hasMinRole(callerUser.role, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    if (!body.student_id) {
      return NextResponse.json({ success: false, error: 'Student is required' }, { status: 400 });
    }

    // Get agency name if agency_id is provided
    let agencyName = body.agency_name || null;
    if (body.agency_id && !agencyName) {
      const { data: agency } = await supabase
        .from('agencies')
        .select('name')
        .eq('id', body.agency_id)
        .single();
      if (agency) {
        agencyName = agency.name;
      }
    }

    const { data, error } = await supabase
      .from('student_internships')
      .insert({
        student_id: body.student_id,
        cohort_id: body.cohort_id || null,
        preceptor_id: body.preceptor_id || null,
        agency_id: body.agency_id || null,
        agency_name: agencyName,
        shift_type: body.shift_type || '12_hour',
        placement_date: body.placement_date || null,
        orientation_date: body.orientation_date || null,
        internship_start_date: body.internship_start_date || null,
        expected_end_date: body.expected_end_date || null,
        current_phase: body.current_phase || 'pre_internship',
        status: body.status || 'not_started',
        notes: body.notes?.trim() || null,
      })
      .select(`
        *,
        students (id, first_name, last_name, email),
        cohorts (id, cohort_number, programs (id, name, abbreviation)),
        field_preceptors (id, first_name, last_name, agency_name),
        agencies (id, name, abbreviation)
      `)
      .single();

    if (error) throw error;

    // FERPA audit: log internship creation
    logAuditEvent({
      user: { id: user.id, email: user.email, role: user.role },
      action: 'internship_created',
      resourceType: 'internship',
      resourceId: data?.id,
      resourceDescription: `Created internship for student ${body.student_id}`,
      metadata: { studentId: body.student_id, cohortId: body.cohort_id, agencyName, status: body.status || 'not_started', phase: body.current_phase || 'pre_internship' },
    }).catch(console.error);

    return NextResponse.json({ success: true, internship: data });
  } catch (error) {
    console.error('Error creating internship:', error);
    return NextResponse.json({ success: false, error: 'Failed to create internship' }, { status: 500 });
  }
}
