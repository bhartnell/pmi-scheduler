import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

/**
 * /api/lab-management/groups/[id]/members
 *
 * Member assignment CRUD for lab groups. The previous implementation
 * of this route was hitting `student_groups` + `student_group_assignments`
 * (legacy tables that pre-date the lab-groups rewrite), while every
 * other surface — the GET /groups list, POST /groups create, the
 * /groups PUT action='move_student' branch, the bulk auto-balance
 * action — uses `lab_groups` + `lab_group_members`. The mismatch
 * meant every group_id returned by POST /groups was unknown to this
 * route, so its pre-flight check returned 404 and its INSERTs would
 * have FK-violated against `student_groups` even if they reached the
 * insert step. Confirmed against prod: 4-of-4 reported "missing"
 * group_ids exist in `lab_groups`. Now everything goes through the
 * canonical lab_* tables, matching the rest of the system.
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;

  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
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
      .eq('lab_group_id', groupId);

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
    const { session } = auth;
    const userEmail = session.user.email;

    const supabase = getSupabaseAdmin();
    const body = await request.json();
    // Accept both the camelCase form the existing UI ships
    // (studentIds) and the snake_case form a future caller might
    // send (student_ids), so neither convention silently no-ops.
    const studentIds: unknown =
      (body.studentIds !== undefined ? body.studentIds : body.student_ids);

    if (!Array.isArray(studentIds)) {
      return NextResponse.json(
        { success: false, error: 'studentIds (or student_ids) must be an array' },
        { status: 400 },
      );
    }

    // Pre-flight: confirm the lab_group actually exists. If a stale
    // client cache holds a deleted-and-recreated group's old uuid,
    // we surface a clear "please refresh" 404 instead of letting
    // the assignments INSERT fail with an opaque FK violation.
    const { data: groupExists, error: groupCheckErr } = await supabase
      .from('lab_groups')
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

    // Replace-strategy: nuke existing assignments for this group,
    // then insert the new full set. Matches the previous behaviour
    // the UI's "Save" button relied on.
    await supabase
      .from('lab_group_members')
      .delete()
      .eq('lab_group_id', groupId);

    if (studentIds.length > 0) {
      const assignments = (studentIds as string[]).map((studentId) => ({
        lab_group_id: groupId,
        student_id: studentId,
        assigned_by: userEmail,
      }));

      const { error: insertError } = await supabase
        .from('lab_group_members')
        .insert(assignments);

      if (insertError) {
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

    // Return the resolved roster so the UI doesn't need a follow-up
    // GET to reconcile the displayed members.
    const { data, error } = await supabase
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
      .eq('lab_group_id', groupId);

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
    const { session } = auth;
    const userEmail = session.user.email;

    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { student_id } = body;

    if (!student_id) {
      return NextResponse.json({ success: false, error: 'student_id is required' }, { status: 400 });
    }

    // Same single-group-per-student invariant the /groups PUT
    // action='move_student' branch enforces — remove any prior
    // assignment before inserting the new one.
    await supabase
      .from('lab_group_members')
      .delete()
      .eq('student_id', student_id);

    const { data, error } = await supabase
      .from('lab_group_members')
      .insert({
        lab_group_id: groupId,
        student_id,
        assigned_by: userEmail,
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

    const supabase = getSupabaseAdmin();
    const searchParams = request.nextUrl.searchParams;
    const studentId = searchParams.get('studentId');

    if (!studentId) {
      return NextResponse.json({ success: false, error: 'studentId is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('lab_group_members')
      .delete()
      .eq('lab_group_id', groupId)
      .eq('student_id', studentId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing member:', error);
    return NextResponse.json({ success: false, error: 'Failed to remove member' }, { status: 500 });
  }
}
