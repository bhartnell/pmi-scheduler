import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;

  try {
    const { data, error } = await supabase
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
      .eq('group_id', groupId);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      members: data?.map(a => a.student) || [],
    });
  } catch (error) {
    console.error('Error fetching members:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch members' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;

  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { studentIds } = body;

    if (!Array.isArray(studentIds)) {
      return NextResponse.json({ success: false, error: 'studentIds must be an array' }, { status: 400 });
    }

    // Delete all existing assignments for this group
    await supabase
      .from('student_group_assignments')
      .delete()
      .eq('group_id', groupId);

    // Insert new assignments
    if (studentIds.length > 0) {
      const assignments = studentIds.map((studentId: string) => ({
        group_id: groupId,
        student_id: studentId,
        role: 'member',
      }));

      const { error: insertError } = await supabase
        .from('student_group_assignments')
        .insert(assignments);

      if (insertError) throw insertError;
    }

    // Fetch updated members
    const { data, error } = await supabase
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
      .eq('group_id', groupId);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      members: data?.map(a => a.student) || [],
    });
  } catch (error) {
    console.error('Error updating members:', error);
    return NextResponse.json({ success: false, error: 'Failed to update members' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;

  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { student_id } = body;

    if (!student_id) {
      return NextResponse.json({ success: false, error: 'student_id is required' }, { status: 400 });
    }

    // Check if already assigned
    const { data: existing } = await supabase
      .from('student_group_assignments')
      .select('id')
      .eq('group_id', groupId)
      .eq('student_id', student_id)
      .single();

    if (existing) {
      return NextResponse.json({ success: false, error: 'Student already in group' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('student_group_assignments')
      .insert({
        group_id: groupId,
        student_id: student_id,
        role: 'member',
      })
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
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, assignment: data });
  } catch (error) {
    console.error('Error adding member:', error);
    return NextResponse.json({ success: false, error: 'Failed to add member' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;

  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const studentId = searchParams.get('studentId');

    if (!studentId) {
      return NextResponse.json({ success: false, error: 'studentId is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('student_group_assignments')
      .delete()
      .eq('group_id', groupId)
      .eq('student_id', studentId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing member:', error);
    return NextResponse.json({ success: false, error: 'Failed to remove member' }, { status: 500 });
  }
}
