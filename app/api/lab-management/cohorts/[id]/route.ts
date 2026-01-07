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
      .from('cohorts')
      .select(`
        *,
        program:programs(id, name, abbreviation)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, cohort: data });
  } catch (error) {
    console.error('Error fetching cohort:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch cohort' }, { status: 500 });
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
      .from('cohorts')
      .update(body)
      .eq('id', id)
      .select(`
        *,
        program:programs(id, name, abbreviation)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, cohort: data });
  } catch (error) {
    console.error('Error updating cohort:', error);
    return NextResponse.json({ success: false, error: 'Failed to update cohort' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const { count } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('cohort_id', id);

    if (count && count > 0) {
      return NextResponse.json({ 
        success: false, 
        error: `Cannot delete cohort with ${count} students. Remove students first.` 
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('cohorts')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting cohort:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete cohort' }, { status: 500 });
  }
}
