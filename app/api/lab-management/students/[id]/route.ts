import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client lazily to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('students')
      .select(`
        *,
        cohort:cohorts(
          id,
          cohort_number,
          program:programs(name, abbreviation)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    const { count: teamLeadCount } = await supabase
      .from('team_lead_log')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', id);

    const { data: lastTL } = await supabase
      .from('team_lead_log')
      .select('date')
      .eq('student_id', id)
      .order('date', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({ 
      success: true, 
      student: {
        ...data,
        team_lead_count: teamLeadCount || 0,
        last_team_lead_date: lastTL?.date || null
      }
    });
  } catch (error) {
    console.error('Error fetching student:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch student' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const supabase = getSupabase();

    const body = await request.json();
    
    const { data, error } = await supabase
      .from('students')
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

    return NextResponse.json({ success: true, student: data });
  } catch (error) {
    console.error('Error updating student:', error);
    return NextResponse.json({ success: false, error: 'Failed to update student' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const supabase = getSupabase();

    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting student:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete student' }, { status: 500 });
  }
}
