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
      .from('lab_stations')
      .select(`
        *,
        scenario:scenarios(id, title, category, difficulty),
        instructor:lab_users(id, name),
        lab_day:lab_days(
          id,
          date,
          week_number,
          day_number,
          num_rotations,
          cohort:cohorts(
            id,
            cohort_number,
            program:programs(name, abbreviation)
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, station: data });
  } catch (error) {
    console.error('Error fetching station:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch station' }, { status: 500 });
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
      .from('lab_stations')
      .update(body)
      .eq('id', id)
      .select(`
        *,
        scenario:scenarios(id, title, category, difficulty),
        instructor:lab_users(id, name)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, station: data });
  } catch (error) {
    console.error('Error updating station:', error);
    return NextResponse.json({ success: false, error: 'Failed to update station' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const { error } = await supabase
      .from('lab_stations')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting station:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete station' }, { status: 500 });
  }
}
