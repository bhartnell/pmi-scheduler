import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const { data, error } = await supabase
      .from('lab_days')
      .select(`
        *,
        cohort:cohorts(
          id,
          cohort_number,
          program:programs(name, abbreviation)
        ),
        stations:lab_stations(
          *,
          scenario:scenarios(id, title, category, difficulty),
          instructor:lab_users(id, name)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    // Sort stations by station_number
    if (data.stations) {
      data.stations.sort((a: any, b: any) => a.station_number - b.station_number);
    }

    return NextResponse.json({ success: true, labDay: data });
  } catch (error) {
    console.error('Error fetching lab day:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch lab day' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('lab_days')
      .update(body)
      .eq('id', id)
      .select(`
        *,
        cohort:cohorts(
          id,
          cohort_number,
          program:programs(name, abbreviation)
        )
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, labDay: data });
  } catch (error) {
    console.error('Error updating lab day:', error);
    return NextResponse.json({ success: false, error: 'Failed to update lab day' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    // Stations will be deleted via CASCADE
    const { error } = await supabase
      .from('lab_days')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting lab day:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete lab day' }, { status: 500 });
  }
}
