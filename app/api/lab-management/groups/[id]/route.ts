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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = getSupabase();

    // Get group with members
    const { data: group, error: groupError } = await supabase
      .from('student_groups')
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
      .from('student_group_assignments')
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
      .eq('group_id', id);

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
    const supabase = getSupabase();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const { data, error } = await supabase
      .from('student_groups')
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
    const supabase = getSupabase();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Delete assignments first
    await supabase
      .from('student_group_assignments')
      .delete()
      .eq('group_id', id);

    // Delete group
    const { error } = await supabase
      .from('student_groups')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting group:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete group' }, { status: 500 });
  }
}
