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
      .from('scenarios')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, scenario: data });
  } catch (error) {
    console.error('Error fetching scenario:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch scenario' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const body = await request.json();
    body.updated_at = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('scenarios')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, scenario: data });
  } catch (error) {
    console.error('Error updating scenario:', error);
    return NextResponse.json({ success: false, error: 'Failed to update scenario' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    // Check if scenario is used in any lab stations
    const { count } = await supabase
      .from('lab_stations')
      .select('*', { count: 'exact', head: true })
      .eq('scenario_id', id);

    if (count && count > 0) {
      // Soft delete - just mark as inactive
      const { error } = await supabase
        .from('scenarios')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      return NextResponse.json({ 
        success: true, 
        message: 'Scenario marked as inactive (used in lab schedules)' 
      });
    }

    // Hard delete if not used
    const { error } = await supabase
      .from('scenarios')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting scenario:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete scenario' }, { status: 500 });
  }
}
