import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;

  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();

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
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { studentIds } = body;

    if (!Array.isArray(studentIds)) {
      return NextResponse.json({ success: false, error: 'studentIds must be an array' }, { status: 400 });
    }

    // Pre-flight: confirm the group actually exists. The UI was
    // hitting 500s because deleted-and-recreated groups left the
    // client holding stale UUIDs; the INSERT below would then fail
    // with a 23503 FK violation. Returning a 404 with a clear "stale
    // group, please refresh" message gives the client something
    // actionable instead of an opaque server error.
    const { data: groupExists, error: groupCheckErr } = await supabase
      .from('student_groups')
      .select('id')
      .eq('id', groupId)
      .maybeSingle();
    if (groupCheckErr) throw groupCheckErr;
    if (!groupExists) {
      return NextResponse.json(
        {
          success: false,
          error: 'Group not found — please refresh and try again.',
          code: 'group_not_found',
          group_id: groupId,
        },
        { status: 404 },
      );
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

      if (insertError) {
        // Safety net: if a concurrent delete races the pre-flight
        // check, the FK violation still bubbles up here. Translate
        // it to the same 404 so the client gets a consistent signal.
        if ((insertError as { code?: string }).code === '23503') {
          return NextResponse.json(
            {
              success: false,
              error: 'Group or student no longer exists — please refresh and try again.',
              code: 'fk_violation',
            },
            { status: 404 },
          );
        }
        throw insertError;
      }
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
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const supabase = getSupabaseAdmin();
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

    if (error) {
      // FK violation = stale group_id / student_id. See the matching
      // 404 path on PUT above for context.
      if ((error as { code?: string }).code === '23503') {
        return NextResponse.json(
          {
            success: false,
            error: 'Group or student no longer exists — please refresh and try again.',
            code: 'fk_violation',
          },
          { status: 404 },
        );
      }
      throw error;
    }

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
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const supabase = getSupabaseAdmin();
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
