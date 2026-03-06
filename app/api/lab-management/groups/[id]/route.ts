import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();

    // Get group with members
    const { data: group, error: groupError } = await supabase
      .from('lab_groups')
      .select(`
        *,
        cohort:cohorts(
          id,
          cohort_number,
          program:programs(abbreviation)
        )
      `)
      .eq('id', id)
      .single();

    if (groupError) throw groupError;

    // Get group assignments with student details
    const { data: assignments, error: assignError } = await supabase
      .from('lab_group_members')
      .select(`
        *,
        student:students(
          id,
          first_name,
          last_name,
          agency,
          photo_url
        )
      `)
      .eq('lab_group_id', id);

    if (assignError) throw assignError;

    return NextResponse.json({
      success: true,
      group,
      members: assignments?.map(a => a.student) || [],
    });
  } catch (error) {
    console.error('Error fetching group:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch group' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const { data, error } = await supabase
      .from('lab_groups')
      .update({
        name: body.name,
        description: body.description,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, group: data });
  } catch (error) {
    console.error('Error updating group:', error);
    return NextResponse.json({ success: false, error: 'Failed to update group' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const supabase = getSupabaseAdmin();

    // Delete assignments first
    await supabase
      .from('lab_group_members')
      .delete()
      .eq('lab_group_id', id);

    // Delete group
    const { error } = await supabase
      .from('lab_groups')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting group:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete group' }, { status: 500 });
  }
}
