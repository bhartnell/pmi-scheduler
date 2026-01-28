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
    const activeOnly = searchParams.get('activeOnly') !== 'false';
    const includeDepartments = searchParams.get('includeDepartments') === 'true';

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

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, sites: data });
  } catch (error) {
    console.error('Error fetching clinical sites:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch clinical sites' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
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
