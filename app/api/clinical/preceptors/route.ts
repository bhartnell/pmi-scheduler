import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const agencyId = searchParams.get('agencyId');
    const search = searchParams.get('search');
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    let query = supabase
      .from('field_preceptors')
      .select('*, agencies(id, name, abbreviation, type)')
      .order('last_name')
      .order('first_name');

    if (agencyId) {
      query = query.eq('agency_id', agencyId);
    }

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    if (search) {
      const safeSearch = search.replace(/[%_,.()\\/]/g, '');
      query = query.or(`first_name.ilike.%${safeSearch}%,last_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,agency_name.ilike.%${safeSearch}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, preceptors: data });
  } catch (error) {
    console.error('Error fetching preceptors:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch preceptors' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();

    if (!body.first_name?.trim() || !body.last_name?.trim()) {
      return NextResponse.json({ success: false, error: 'First and last name are required' }, { status: 400 });
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
      .from('field_preceptors')
      .insert({
        first_name: body.first_name.trim(),
        last_name: body.last_name.trim(),
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        agency_id: body.agency_id || null,
        agency_name: agencyName,
        station: body.station?.trim() || null,
        normal_schedule: body.normal_schedule?.trim() || null,
        snhd_trained_date: body.snhd_trained_date || null,
        snhd_cert_expires: body.snhd_cert_expires || null,
        max_students: body.max_students || 1,
        is_active: body.is_active !== false,
        notes: body.notes?.trim() || null,
      })
      .select('*, agencies(id, name, abbreviation, type)')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, preceptor: data });
  } catch (error) {
    console.error('Error creating preceptor:', error);
    return NextResponse.json({ success: false, error: 'Failed to create preceptor' }, { status: 500 });
  }
}
