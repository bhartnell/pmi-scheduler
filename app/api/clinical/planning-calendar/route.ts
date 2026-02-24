import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// Helper: get caller's role
async function getCallerRole(supabase: ReturnType<typeof getSupabaseAdmin>, email: string) {
  const { data } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', email)
    .single();
  return data?.role ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const callerRole = await getCallerRole(supabase, session.user.email);
    if (!callerRole || !hasMinRole(callerRole, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const siteId = searchParams.get('site_id');
    const institution = searchParams.get('institution');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    let query = supabase
      .from('clinical_site_schedules')
      .select(`
        *,
        site:clinical_sites(id, name, abbreviation, system)
      `)
      .order('start_date', { ascending: true });

    if (siteId) {
      query = query.eq('clinical_site_id', siteId);
    }

    if (institution) {
      query = query.ilike('institution', institution);
    }

    // Filter schedules that overlap with the requested date range
    if (startDate) {
      // end_date is null (ongoing) or end_date >= startDate
      query = query.or(`end_date.gte.${startDate},end_date.is.null`);
    }

    if (endDate) {
      query = query.lte('start_date', endDate);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, schedules: data });
  } catch (error) {
    console.error('Error fetching clinical site schedules:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch schedules' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const callerRole = await getCallerRole(supabase, session.user.email);
    if (!callerRole || !hasMinRole(callerRole, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    if (!body.clinical_site_id) {
      return NextResponse.json({ success: false, error: 'Clinical site is required' }, { status: 400 });
    }

    if (!body.institution?.trim()) {
      return NextResponse.json({ success: false, error: 'Institution is required' }, { status: 400 });
    }

    if (!Array.isArray(body.days_of_week) || body.days_of_week.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one day of week is required' }, { status: 400 });
    }

    if (!body.start_date) {
      return NextResponse.json({ success: false, error: 'Start date is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('clinical_site_schedules')
      .insert({
        clinical_site_id: body.clinical_site_id,
        institution: body.institution.trim(),
        days_of_week: body.days_of_week,
        start_date: body.start_date,
        end_date: body.end_date || null,
        notes: body.notes?.trim() || null,
        created_by: session.user.email,
      })
      .select(`
        *,
        site:clinical_sites(id, name, abbreviation, system)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, schedule: data });
  } catch (error) {
    console.error('Error creating clinical site schedule:', error);
    return NextResponse.json({ success: false, error: 'Failed to create schedule' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const callerRole = await getCallerRole(supabase, session.user.email);
    if (!callerRole || !hasMinRole(callerRole, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ success: false, error: 'Schedule ID is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.clinical_site_id !== undefined) updates.clinical_site_id = body.clinical_site_id;
    if (body.institution !== undefined) updates.institution = body.institution.trim();
    if (body.days_of_week !== undefined) updates.days_of_week = body.days_of_week;
    if (body.start_date !== undefined) updates.start_date = body.start_date;
    if ('end_date' in body) updates.end_date = body.end_date || null;
    if ('notes' in body) updates.notes = body.notes?.trim() || null;

    const { data, error } = await supabase
      .from('clinical_site_schedules')
      .update(updates)
      .eq('id', body.id)
      .select(`
        *,
        site:clinical_sites(id, name, abbreviation, system)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, schedule: data });
  } catch (error) {
    console.error('Error updating clinical site schedule:', error);
    return NextResponse.json({ success: false, error: 'Failed to update schedule' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const callerRole = await getCallerRole(supabase, session.user.email);
    if (!callerRole || !hasMinRole(callerRole, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Schedule ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('clinical_site_schedules')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting clinical site schedule:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete schedule' }, { status: 500 });
  }
}
