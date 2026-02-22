import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get('activeOnly') !== 'false';
    const includeDepartments = searchParams.get('includeDepartments') === 'true';
    const includeAgencies = searchParams.get('includeAgencies') === 'true';

    let query = supabase
      .from('clinical_sites')
      .select(includeDepartments
        ? '*, departments:clinical_site_departments(id, department, is_active)'
        : '*'
      )
      .order('name');

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data: sites, error } = await query;

    if (error) throw error;

    // Optionally include EMS field agencies as site visit locations
    if (includeAgencies) {
      let agencyQuery = supabase
        .from('agencies')
        .select('*')
        .neq('type', 'hospital') // Only EMS agencies
        .order('name');

      if (activeOnly) {
        agencyQuery = agencyQuery.eq('is_active', true);
      }

      const { data: agencies, error: agencyError } = await agencyQuery;

      if (agencyError) {
        console.error('Error fetching agencies:', agencyError);
      }

      // Transform agencies to match clinical_sites structure
      const agenciesAsSites = (agencies || []).map((agency: any) => ({
        id: `agency-${agency.id}`, // Prefix to distinguish from clinical sites
        name: agency.name,
        abbreviation: agency.abbreviation || agency.name.slice(0, 10),
        system: 'Field Agency',
        address: agency.address,
        phone: agency.phone,
        is_active: agency.is_active,
        site_type: 'field_agency', // Add type identifier
        original_id: agency.id,
        departments: [], // Agencies don't have departments
      }));

      // Add site_type to clinical sites
      const sitesWithType = (sites || []).map((site: any) => ({
        ...site,
        site_type: 'clinical_site',
      }));

      return NextResponse.json({
        success: true,
        sites: [...sitesWithType, ...agenciesAsSites],
      });
    }

    return NextResponse.json({ success: true, sites });
  } catch (error) {
    console.error('Error fetching clinical sites:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch clinical sites' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }

    if (!body.abbreviation?.trim()) {
      return NextResponse.json({ success: false, error: 'Abbreviation is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('clinical_sites')
      .insert({
        name: body.name.trim(),
        abbreviation: body.abbreviation.trim(),
        system: body.system?.trim() || null,
        address: body.address?.trim() || null,
        phone: body.phone?.trim() || null,
        is_active: body.is_active !== false,
      })
      .select()
      .single();

    if (error) throw error;

    // If departments were provided, add them
    if (body.departments && Array.isArray(body.departments) && body.departments.length > 0) {
      const departmentInserts = body.departments.map((dept: string) => ({
        site_id: data.id,
        department: dept.trim(),
      }));

      await supabase.from('clinical_site_departments').insert(departmentInserts);
    }

    return NextResponse.json({ success: true, site: data });
  } catch (error) {
    console.error('Error creating clinical site:', error);
    return NextResponse.json({ success: false, error: 'Failed to create clinical site' }, { status: 500 });
  }
}
