import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const cohortId = searchParams.get('cohortId');
    const status = searchParams.get('status');
    const phase = searchParams.get('phase');
    const agencyId = searchParams.get('agencyId');

    let query = supabase
      .from('student_internships')
      .select(`
        *,
        students (
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

    return NextResponse.json({ success: true, internships: data });
  } catch (error) {
    console.error('Error fetching internships:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch internships' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
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

    return NextResponse.json({ success: true, internship: data });
  } catch (error) {
    console.error('Error creating internship:', error);
    return NextResponse.json({ success: false, error: 'Failed to create internship' }, { status: 500 });
  }
}
