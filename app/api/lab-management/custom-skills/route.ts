import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const stationId = searchParams.get('stationId');

  if (!stationId) {
    return NextResponse.json({ success: false, error: 'stationId is required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('custom_skills')
      .select('*')
      .eq('station_id', stationId)
      .order('created_at');

    if (error) throw error;

    const response = NextResponse.json({ success: true, customSkills: data });
    response.headers.set('Cache-Control', 'private, max-age=14400, stale-while-revalidate=1800');
    return response;
  } catch (error) {
    console.error('Error fetching custom skills:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch custom skills' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const body = await request.json();

    if (!body.station_id || !body.name) {
      return NextResponse.json({ success: false, error: 'station_id and name are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('custom_skills')
      .insert({
        station_id: body.station_id,
        name: body.name,
        notes: body.notes || null
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, customSkill: data });
  } catch (error) {
    console.error('Error creating custom skill:', error);
    return NextResponse.json({ success: false, error: 'Failed to create custom skill' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('custom_skills')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting custom skill:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete custom skill' }, { status: 500 });
  }
}
