import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

// Create Supabase client lazily to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const siteId = searchParams.get('siteId');
    const cohortId = searchParams.get('cohortId');
    const visitorId = searchParams.get('visitorId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('clinical_site_visits')
      .select(`
        *,
        site:clinical_sites(id, name, abbreviation, system),
        agency:agencies(id, name, abbreviation),
        cohort:cohorts(id, cohort_number, program:programs(id, name, abbreviation)),
        visitor:lab_users(id, name, email),
        students:clinical_visit_students(
          student:students(id, first_name, last_name)
        )
      `, { count: 'exact' })
      .order('visit_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (siteId) {
      query = query.eq('site_id', siteId);
    }

    if (cohortId) {
      query = query.eq('cohort_id', cohortId);
    }

    if (visitorId) {
      query = query.eq('visitor_id', visitorId);
    }

    if (startDate) {
      query = query.gte('visit_date', startDate);
    }

    if (endDate) {
      query = query.lte('visit_date', endDate);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      visits: data,
      total: count,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching site visits:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch site visits' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.site_id) {
      return NextResponse.json({ success: false, error: 'Site is required' }, { status: 400 });
    }

    if (!body.visit_date) {
      return NextResponse.json({ success: false, error: 'Visit date is required' }, { status: 400 });
    }

    if (!body.visitor_name?.trim()) {
      return NextResponse.json({ success: false, error: 'Visitor name is required' }, { status: 400 });
    }

    // Handle field agency IDs (prefixed with "agency-")
    let actualSiteId = body.site_id;
    let agencyId: string | null = null;

    if (body.site_id.startsWith('agency-')) {
      // This is a field agency, not a clinical site
      // Store the agency ID separately and set site_id to null
      agencyId = body.site_id.replace('agency-', '');
      actualSiteId = null;
    }

    // Create the visit
    const { data: visit, error: visitError } = await supabase
      .from('clinical_site_visits')
      .insert({
        site_id: actualSiteId,
        agency_id: agencyId,
        departments: body.departments || [],
        visitor_id: body.visitor_id || null,
        visitor_name: body.visitor_name.trim(),
        visit_date: body.visit_date,
        visit_time: body.visit_time || null,
        cohort_id: body.cohort_id || null,
        entire_class: body.entire_class || false,
        comments: body.comments?.trim() || null,
        created_by: session.user.email,
      })
      .select()
      .single();

    if (visitError) {
      console.error('Error inserting site visit:', {
        code: visitError.code,
        message: visitError.message,
        details: visitError.details,
        hint: visitError.hint,
        body: {
          site_id: body.site_id,
          visitor_name: body.visitor_name,
          visit_date: body.visit_date,
          cohort_id: body.cohort_id,
        }
      });
      throw visitError;
    }

    // If specific students were selected, add them
    if (body.student_ids && Array.isArray(body.student_ids) && body.student_ids.length > 0 && !body.entire_class) {
      const studentInserts = body.student_ids.map((studentId: string) => ({
        visit_id: visit.id,
        student_id: studentId,
      }));

      const { error: studentsError } = await supabase
        .from('clinical_visit_students')
        .insert(studentInserts);

      if (studentsError) {
        console.error('Error adding students to visit:', studentsError);
      }
    }

    // Fetch the complete visit with relations
    const { data: completeVisit, error: fetchError } = await supabase
      .from('clinical_site_visits')
      .select(`
        *,
        site:clinical_sites(id, name, abbreviation, system),
        agency:agencies(id, name, abbreviation),
        cohort:cohorts(id, cohort_number, program:programs(id, name, abbreviation)),
        visitor:lab_users(id, name, email),
        students:clinical_visit_students(
          student:students(id, first_name, last_name)
        )
      `)
      .eq('id', visit.id)
      .single();

    if (fetchError) throw fetchError;

    return NextResponse.json({ success: true, visit: completeVisit });
  } catch (error: any) {
    console.error('Error creating site visit:', error);
    // Return more specific error message for debugging
    const errorMessage = error?.message || 'Failed to create site visit';
    const errorCode = error?.code;

    // Handle specific Postgres errors
    if (errorCode === '23503') {
      // Foreign key violation
      return NextResponse.json({
        success: false,
        error: 'Invalid reference: site, visitor, or cohort not found'
      }, { status: 400 });
    }

    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
