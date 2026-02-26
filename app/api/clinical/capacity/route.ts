import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// ─── GET: List all clinical sites with capacity info and utilization ──────────
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !hasMinRole(callerUser.role, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get('date'); // Optional: YYYY-MM-DD

    // ── 1. Fetch all active agencies (EMS + hospital) ────────────────────────
    const { data: agencies, error: agenciesError } = await supabase
      .from('agencies')
      .select('id, name, abbreviation, type, max_students_per_day, max_students_per_rotation, capacity_notes, is_active')
      .eq('is_active', true)
      .order('name');

    if (agenciesError) throw agenciesError;

    // ── 2. Fetch all active clinical sites ────────────────────────────────────
    const { data: clinicalSites, error: sitesError } = await supabase
      .from('clinical_sites')
      .select('id, name, abbreviation, system, max_students_per_day, max_students_per_rotation, capacity_notes, is_active')
      .eq('is_active', true)
      .order('name');

    if (sitesError) throw sitesError;

    // ── 3. Count internship utilization per agency ────────────────────────────
    // Count active student_internships per agency (not completed/withdrawn)
    let internshipQuery = supabase
      .from('student_internships')
      .select('agency_id')
      .not('status', 'in', '("completed","withdrawn")');

    // If a specific date is requested, filter by placement_date
    if (dateParam) {
      internshipQuery = internshipQuery.eq('placement_date', dateParam);
    }

    const { data: internships, error: internshipsError } = await internshipQuery;
    if (internshipsError) throw internshipsError;

    // Build count map: agency_id -> student count
    const agencyStudentCount: Record<string, number> = {};
    for (const internship of internships || []) {
      if (internship.agency_id) {
        agencyStudentCount[internship.agency_id] = (agencyStudentCount[internship.agency_id] || 0) + 1;
      }
    }

    // ── 4. Count clinical site visit utilization ───────────────────────────────
    // Count students visited per clinical site
    let visitQuery = supabase
      .from('clinical_site_visits')
      .select('site_id');

    if (dateParam) {
      visitQuery = visitQuery.eq('visit_date', dateParam);
    }

    const { data: siteVisits, error: visitsError } = await visitQuery;
    // clinical_site_visits errors are non-fatal - table may have no data
    if (visitsError) {
      console.warn('Error fetching site visits for capacity:', visitsError);
    }

    const siteVisitCount: Record<string, number> = {};
    for (const visit of siteVisits || []) {
      if (visit.site_id) {
        siteVisitCount[visit.site_id] = (siteVisitCount[visit.site_id] || 0) + 1;
      }
    }

    // ── 5. Build enriched agency capacity data ────────────────────────────────
    const agencyCapacity = (agencies || []).map((agency) => {
      const currentCount = agencyStudentCount[agency.id] || 0;
      const maxPerDay = agency.max_students_per_day ?? 2;
      const utilizationPct = maxPerDay > 0 ? Math.round((currentCount / maxPerDay) * 100) : 0;

      return {
        id: agency.id,
        source: 'agency' as const,
        name: agency.name,
        abbreviation: agency.abbreviation,
        type: agency.type, // 'ems' | 'hospital'
        max_students_per_day: maxPerDay,
        max_students_per_rotation: agency.max_students_per_rotation ?? null,
        capacity_notes: agency.capacity_notes ?? null,
        current_student_count: currentCount,
        utilization_percentage: utilizationPct,
        is_over_capacity: currentCount > maxPerDay,
      };
    });

    // ── 6. Build enriched clinical site capacity data ─────────────────────────
    const clinicalSiteCapacity = (clinicalSites || []).map((site) => {
      const currentCount = siteVisitCount[site.id] || 0;
      const maxPerDay = site.max_students_per_day ?? 2;
      const utilizationPct = maxPerDay > 0 ? Math.round((currentCount / maxPerDay) * 100) : 0;

      return {
        id: site.id,
        source: 'clinical_site' as const,
        name: site.name,
        abbreviation: site.abbreviation,
        type: 'hospital' as const,
        system: site.system ?? null,
        max_students_per_day: maxPerDay,
        max_students_per_rotation: site.max_students_per_rotation ?? null,
        capacity_notes: site.capacity_notes ?? null,
        current_student_count: currentCount,
        utilization_percentage: utilizationPct,
        is_over_capacity: currentCount > maxPerDay,
      };
    });

    return NextResponse.json({
      success: true,
      date: dateParam ?? null,
      agencies: agencyCapacity,
      clinical_sites: clinicalSiteCapacity,
    });
  } catch (error) {
    console.error('Error fetching capacity:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch capacity data' }, { status: 500 });
  }
}

// ─── PATCH: Update a site's capacity settings ─────────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !hasMinRole(callerUser.role, 'admin')) {
      return NextResponse.json({ success: false, error: 'Forbidden - admin+ required' }, { status: 403 });
    }

    const body = await request.json();
    const { site_id, source, max_students_per_day, max_students_per_rotation, capacity_notes } = body;

    if (!site_id) {
      return NextResponse.json({ success: false, error: 'site_id is required' }, { status: 400 });
    }

    if (!source || !['agency', 'clinical_site'].includes(source)) {
      return NextResponse.json({ success: false, error: 'source must be "agency" or "clinical_site"' }, { status: 400 });
    }

    if (max_students_per_day !== undefined && (typeof max_students_per_day !== 'number' || max_students_per_day < 1)) {
      return NextResponse.json({ success: false, error: 'max_students_per_day must be a positive integer' }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (max_students_per_day !== undefined) {
      updatePayload.max_students_per_day = max_students_per_day;
    }
    if (max_students_per_rotation !== undefined) {
      updatePayload.max_students_per_rotation = max_students_per_rotation;
    }
    if (capacity_notes !== undefined) {
      updatePayload.capacity_notes = capacity_notes;
    }

    const table = source === 'agency' ? 'agencies' : 'clinical_sites';

    const { data, error } = await supabase
      .from(table)
      .update(updatePayload)
      .eq('id', site_id)
      .select('id, name, max_students_per_day, max_students_per_rotation, capacity_notes')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, site: data });
  } catch (error) {
    console.error('Error updating capacity:', error);
    return NextResponse.json({ success: false, error: 'Failed to update capacity' }, { status: 500 });
  }
}
