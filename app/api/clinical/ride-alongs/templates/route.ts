import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// GET /api/clinical/ride-alongs/templates — list templates
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active_only') !== 'false';
    const agencyId = searchParams.get('agency_id');

    let query = supabase
      .from('ride_along_templates')
      .select('*')
      .order('name');

    if (activeOnly) query = query.eq('is_active', true);
    if (agencyId) query = query.eq('agency_id', agencyId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, templates: data || [] });
  } catch (error) {
    console.error('Error fetching ride-along templates:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch templates' }, { status: 500 });
  }
}

// POST /api/clinical/ride-alongs/templates — create a template
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const {
      name, agency_id, day_of_week, shift_type,
      start_time, end_time, max_students, unit_number, preceptor_name
    } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('ride_along_templates')
      .insert({
        name,
        agency_id: agency_id || null,
        day_of_week: day_of_week ?? null,
        shift_type: shift_type || null,
        start_time: start_time || null,
        end_time: end_time || null,
        max_students: max_students || 1,
        unit_number: unit_number || null,
        preceptor_name: preceptor_name || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, template: data });
  } catch (error) {
    console.error('Error creating ride-along template:', error);
    return NextResponse.json({ success: false, error: 'Failed to create template' }, { status: 500 });
  }
}
