import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cohortId = searchParams.get('cohortId');
  const includeHistory = searchParams.get('includeHistory') === 'true';

  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('lab_groups')
      .select(`
        *,
        cohort:cohorts(
          id,
          cohort_number,
          program:programs(abbreviation)
        )
      `)
      .eq('is_active', true)
      .order('display_order');

    if (cohortId) {
      query = query.eq('cohort_id', cohortId);
    }

    const { data, error } = await query;

    if (error) throw error;

    let history: any[] = [];
    if (includeHistory && cohortId) {
      const groupIds = (data || []).map((g: any) => g.id);
      if (groupIds.length > 0) {
        const { data: histData } = await supabase
          .from('lab_group_assignment_history')
          .select(`
            *,
            student:students(id, first_name, last_name),
            from_group:lab_groups!from_group_id(id, name),
            to_group:lab_groups!to_group_id(id, name)
          `)
          .in('group_id', groupIds)
          .order('created_at', { ascending: false })
          .limit(500);
        history = histData || [];
      }
    }

    return NextResponse.json({ success: true, groups: data, history });
  } catch (error) {
    console.error('Error fetching groups:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch groups' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.cohort_id) {
      return NextResponse.json({ success: false, error: 'Cohort is required' }, { status: 400 });
    }

    // Get next display_order
    const { data: existingGroups } = await supabase
      .from('lab_groups')
      .select('display_order')
      .eq('cohort_id', body.cohort_id)
      .order('display_order', { ascending: false })
      .limit(1);

    const nextOrder = (existingGroups?.[0]?.display_order || 0) + 1;

    const { data, error } = await supabase
      .from('lab_groups')
      .insert({
        cohort_id: body.cohort_id,
        name: body.name || `Group ${nextOrder}`,
        display_order: body.display_order || nextOrder,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, group: data });
  } catch (error) {
    console.error('Error creating group:', error);
    return NextResponse.json({ success: false, error: 'Failed to create group' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = session.user.email;
    const body = await request.json();
    const { action } = body;

    if (action === 'lock' || action === 'unlock') {
      const { groupId } = body;
      if (!groupId) {
        return NextResponse.json({ success: false, error: 'groupId is required' }, { status: 400 });
      }

      const isLocking = action === 'lock';
      const { data, error } = await supabase
        .from('lab_groups')
        .update({
          is_locked: isLocking,
          locked_by: isLocking ? userEmail : null,
          locked_at: isLocking ? new Date().toISOString() : null,
        })
        .eq('id', groupId)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ success: true, group: data });
    }

    if (action === 'move_student') {
      const { studentId, fromGroupId, toGroupId } = body;
      if (!studentId) {
        return NextResponse.json({ success: false, error: 'studentId is required' }, { status: 400 });
      }

      if (toGroupId) {
        // Remove any existing assignment first (student can only be in one group)
        await supabase
          .from('lab_group_members')
          .delete()
          .eq('student_id', studentId);

        await supabase
          .from('lab_group_members')
          .insert({
            lab_group_id: toGroupId,
            student_id: studentId,
            assigned_by: userEmail,
          });
      } else if (fromGroupId) {
        await supabase
          .from('lab_group_members')
          .delete()
          .eq('lab_group_id', fromGroupId)
          .eq('student_id', studentId);
      }

      // Record history
      const historyAction = fromGroupId && toGroupId ? 'moved' : toGroupId ? 'added' : 'removed';
      await supabase
        .from('lab_group_assignment_history')
        .insert({
          group_id: toGroupId || fromGroupId,
          student_id: studentId,
          action: historyAction,
          from_group_id: fromGroupId || null,
          to_group_id: toGroupId || null,
          changed_by: userEmail,
        });

      return NextResponse.json({ success: true });
    }

    if (action === 'auto_balance') {
      const { groupIds } = body;
      if (!Array.isArray(groupIds) || groupIds.length < 2) {
        return NextResponse.json({ success: false, error: 'Need at least 2 group IDs' }, { status: 400 });
      }

      // Get all members in these groups
      const { data: members, error: membersError } = await supabase
        .from('lab_group_members')
        .select('lab_group_id, student_id')
        .in('lab_group_id', groupIds);

      if (membersError) throw membersError;

      const allStudentIds = (members || []).map((m: any) => m.student_id);
      const numGroups = groupIds.length;
      const targetSize = Math.floor(allStudentIds.length / numGroups);
      const remainder = allStudentIds.length % numGroups;

      // Shuffle students
      const shuffled = [...allStudentIds].sort(() => Math.random() - 0.5);

      // Assign students to groups
      const newAssignments: { lab_group_id: string; student_id: string; assigned_by: string }[] = [];
      let idx = 0;
      for (let g = 0; g < numGroups; g++) {
        const size = targetSize + (g < remainder ? 1 : 0);
        for (let s = 0; s < size && idx < shuffled.length; s++, idx++) {
          newAssignments.push({ lab_group_id: groupIds[g], student_id: shuffled[idx], assigned_by: userEmail });
        }
      }

      // Count moves
      const oldGroupMap = new Map((members || []).map((m: any) => [m.student_id, m.lab_group_id]));
      const moved = newAssignments.filter(a => oldGroupMap.get(a.student_id) !== a.lab_group_id).length;

      // Delete all current assignments for these groups
      await supabase
        .from('lab_group_members')
        .delete()
        .in('lab_group_id', groupIds);

      // Insert new assignments
      if (newAssignments.length > 0) {
        await supabase
          .from('lab_group_members')
          .insert(newAssignments);
      }

      return NextResponse.json({ success: true, moved });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Error in groups PUT:', error);
    return NextResponse.json({ success: false, error: 'Operation failed' }, { status: 500 });
  }
}
