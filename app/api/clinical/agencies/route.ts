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
    const type = searchParams.get('type'); // 'ems', 'hospital', or null for all
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    let query = supabase
      .from('agencies')
      .select('*')
      .order('name');

    if (type) {
      // 'ems' includes all EMS-related types (fire departments, ambulance, etc.)
      if (type === 'ems') {
        query = query.neq('type', 'hospital');
      } else {
        query = query.eq('type', type);
      }
    }

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, agencies: data });
  } catch (error) {
    console.error('Error fetching agencies:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch agencies' }, { status: 500 });
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

    if (!body.name?.trim()) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }

    if (!body.type || !['ems', 'hospital'].includes(body.type)) {
      return NextResponse.json({ success: false, error: 'Type must be "ems" or "hospital"' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('agencies')
      .insert({
        name: body.name.trim(),
        abbreviation: body.abbreviation?.trim() || null,
        type: body.type,
        address: body.address?.trim() || null,
        phone: body.phone?.trim() || null,
        website: body.website?.trim() || null,
        notes: body.notes?.trim() || null,
        is_active: body.is_active !== false,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, agency: data });
  } catch (error) {
    console.error('Error creating agency:', error);
    return NextResponse.json({ success: false, error: 'Failed to create agency' }, { status: 500 });
  }
}
