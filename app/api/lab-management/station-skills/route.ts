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
      .from('station_skills')
      .select(`
        *,
        skill:skills(id, name, category, certification_levels)
      `)
      .eq('station_id', stationId)
      .order('display_order');

    if (error) throw error;

    return NextResponse.json({ success: true, stationSkills: data });
  } catch (error) {
    console.error('Error fetching station skills:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch station skills' }, { status: 500 });
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

    if (!body.station_id || !body.skill_id) {
      return NextResponse.json({ success: false, error: 'station_id and skill_id are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('station_skills')
      .insert({
        station_id: body.station_id,
        skill_id: body.skill_id,
        display_order: body.display_order || 0
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, stationSkill: data });
  } catch (error) {
    console.error('Error creating station skill:', error);
    return NextResponse.json({ success: false, error: 'Failed to create station skill' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const stationId = searchParams.get('stationId');
  const skillId = searchParams.get('skillId');

  if (!stationId) {
    return NextResponse.json({ success: false, error: 'stationId is required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    // If skillId is provided, delete specific skill link
    // If only stationId is provided, delete ALL skill links for that station
    let query = supabase
      .from('station_skills')
      .delete()
      .eq('station_id', stationId);

    if (skillId) {
      query = query.eq('skill_id', skillId);
    }

    const { error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting station skill:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete station skill' }, { status: 500 });
  }
}
