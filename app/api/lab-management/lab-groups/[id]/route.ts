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
      .from('lab_groups')
      .select(`
        *,
        cohort:cohorts(
          id,
          cohort_number,
          program:programs(name, abbreviation)
        ),
        members:lab_group_members(
          id,
          assigned_at,
          student:students(
            id,
            first_name,
            last_name,
            photo_url,
            email,
            status
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, group: data });
  } catch (error) {
    console.error('Error fetching lab group:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch lab group' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const body = await request.json();
    
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.display_order !== undefined) updateData.display_order = body.display_order;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('lab_groups')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, group: data });
  } catch (error) {
    console.error('Error updating lab group:', error);
    return NextResponse.json({ success: false, error: 'Failed to update lab group' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    // Check if group has members
    const { count } = await supabase
      .from('lab_group_members')
      .select('*', { count: 'exact', head: true })
      .eq('lab_group_id', id);

    if (count && count > 0) {
      return NextResponse.json({ 
        success: false, 
        error: `Cannot delete group with ${count} members. Remove members first or deactivate the group.` 
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('lab_groups')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting lab group:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete lab group' }, { status: 500 });
  }
}
