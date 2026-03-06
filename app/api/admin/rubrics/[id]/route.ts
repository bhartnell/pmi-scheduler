import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// Helper – resolve current user from session email
// ---------------------------------------------------------------------------
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// ---------------------------------------------------------------------------
// GET /api/admin/rubrics/[id]
// Returns a single rubric with all criteria and scenario assignments.
// ---------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: rubric, error } = await supabase
      .from('assessment_rubrics')
      .select(`
        id, name, description, rating_scale, created_by, created_at, updated_at,
        criteria:rubric_criteria(id, name, description, points, sort_order),
        assignments:rubric_scenario_assignments(id, scenario_id, assigned_at)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Rubric not found' }, { status: 404 });
      }
      throw error;
    }

    const enriched = {
      ...rubric,
      criteria: ((rubric as any).criteria ?? []).sort(
        (a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)
      ),
    };

    return NextResponse.json({ success: true, rubric: enriched });
  } catch (error) {
    console.error('Error fetching rubric:', error);
    return NextResponse.json({ error: 'Failed to fetch rubric' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/admin/rubrics/[id]
//
// Updates rubric fields, replaces all criteria, and syncs scenario assignments.
// Body: { name?, description?, rating_scale?, criteria?: [...], scenario_ids?: [...] }
// ---------------------------------------------------------------------------
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json() as {
      name?: string;
      description?: string;
      rating_scale?: string;
      criteria?: Array<{
        name: string;
        description?: string;
        points?: number;
        sort_order?: number;
      }>;
      scenario_ids?: string[];
    };

    const supabase = getSupabaseAdmin();

    // Verify rubric exists
    const { data: existing, error: existsError } = await supabase
      .from('assessment_rubrics')
      .select('id')
      .eq('id', id)
      .single();

    if (existsError || !existing) {
      return NextResponse.json({ error: 'Rubric not found' }, { status: 404 });
    }

    // Build update fields
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.description !== undefined) updates.description = body.description;
    if (body.rating_scale !== undefined) updates.rating_scale = body.rating_scale;

    const { error: updateError } = await supabase
      .from('assessment_rubrics')
      .update(updates)
      .eq('id', id);

    if (updateError) throw updateError;

    // Replace criteria if provided
    if (body.criteria !== undefined) {
      const { error: deleteError } = await supabase
        .from('rubric_criteria')
        .delete()
        .eq('rubric_id', id);

      if (deleteError) throw deleteError;

      if (body.criteria.length > 0) {
        const criteriaToInsert = body.criteria.map((c, i) => ({
          rubric_id: id,
          name: c.name.trim(),
          description: c.description ?? null,
          points: c.points ?? 5,
          sort_order: c.sort_order ?? i,
        }));

        const { error: insertError } = await supabase
          .from('rubric_criteria')
          .insert(criteriaToInsert);

        if (insertError) throw insertError;
      }
    }

    // Sync scenario assignments if provided
    if (body.scenario_ids !== undefined) {
      // Delete all existing assignments for this rubric
      const { error: deleteAssignError } = await supabase
        .from('rubric_scenario_assignments')
        .delete()
        .eq('rubric_id', id);

      if (deleteAssignError) throw deleteAssignError;

      // Insert new assignments
      if (body.scenario_ids.length > 0) {
        const assignments = body.scenario_ids.map((sid) => ({
          rubric_id: id,
          scenario_id: sid,
          assigned_by: currentUser.email,
        }));

        const { error: insertAssignError } = await supabase
          .from('rubric_scenario_assignments')
          .insert(assignments);

        if (insertAssignError) throw insertAssignError;
      }
    }

    // Return updated rubric
    const { data: fullRubric, error: refetchError } = await supabase
      .from('assessment_rubrics')
      .select(`
        id, name, description, rating_scale, created_by, created_at, updated_at,
        criteria:rubric_criteria(id, name, description, points, sort_order),
        assignments:rubric_scenario_assignments(id, scenario_id, assigned_at)
      `)
      .eq('id', id)
      .single();

    if (refetchError) throw refetchError;

    return NextResponse.json({ success: true, rubric: fullRubric });
  } catch (error) {
    console.error('Error updating rubric:', error);
    return NextResponse.json({ error: 'Failed to update rubric' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/rubrics/[id]
//
// Deletes rubric only if it has no scenario assignments.
// Pass ?force=true to delete anyway.
// ---------------------------------------------------------------------------
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    const supabase = getSupabaseAdmin();

    // Check for scenario assignments (unless force)
    if (!force) {
      const { data: assignments, error: checkError } = await supabase
        .from('rubric_scenario_assignments')
        .select('id')
        .eq('rubric_id', id);

      if (checkError) throw checkError;

      if (assignments && assignments.length > 0) {
        return NextResponse.json(
          {
            error: 'Rubric is assigned to scenarios. Remove assignments first or use force=true.',
            assignment_count: assignments.length,
          },
          { status: 409 }
        );
      }
    }

    const { error } = await supabase
      .from('assessment_rubrics')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting rubric:', error);
    return NextResponse.json({ error: 'Failed to delete rubric' }, { status: 500 });
  }
}
