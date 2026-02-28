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
// GET /api/admin/rubrics
//
// Returns all rubrics with their criteria and scenario assignments.
// Requires admin+ role.
// ---------------------------------------------------------------------------
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    const { data: rubrics, error } = await supabase
      .from('assessment_rubrics')
      .select(`
        id,
        name,
        description,
        rating_scale,
        created_by,
        created_at,
        updated_at,
        criteria:rubric_criteria(
          id,
          name,
          description,
          max_points,
          sort_order
        ),
        assignments:rubric_scenario_assignments(
          id,
          scenario_id,
          assigned_at
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Sort criteria by sort_order within each rubric
    const enriched = (rubrics ?? []).map((r: any) => ({
      ...r,
      criteria: (r.criteria ?? []).sort(
        (a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)
      ),
    }));

    return NextResponse.json({ success: true, rubrics: enriched });
  } catch (error) {
    console.error('Error fetching rubrics:', error);
    return NextResponse.json({ error: 'Failed to fetch rubrics' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/rubrics
//
// Body: { name, description, rating_scale, criteria: [...], scenario_ids: [...] }
//
// Requires admin+ role.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json() as {
      name: string;
      description?: string;
      rating_scale?: string;
      criteria?: Array<{
        name: string;
        description?: string;
        max_points?: number;
        sort_order?: number;
      }>;
      scenario_ids?: string[];
    };

    const { name, description, rating_scale, criteria, scenario_ids } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Rubric name is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Insert the rubric
    const { data: rubric, error: rubricError } = await supabase
      .from('assessment_rubrics')
      .insert({
        name: name.trim(),
        description: description ?? null,
        rating_scale: rating_scale ?? 'numeric_5',
        created_by: currentUser.email,
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (rubricError) throw rubricError;

    // Insert criteria if provided
    if (criteria && criteria.length > 0) {
      const criteriaToInsert = criteria.map((c, i) => ({
        rubric_id: rubric.id,
        name: c.name.trim(),
        description: c.description ?? null,
        max_points: c.max_points ?? 5,
        sort_order: c.sort_order ?? i,
      }));

      const { error: criteriaError } = await supabase
        .from('rubric_criteria')
        .insert(criteriaToInsert);

      if (criteriaError) throw criteriaError;
    }

    // Assign to scenarios if provided
    if (scenario_ids && scenario_ids.length > 0) {
      const assignments = scenario_ids.map((sid) => ({
        rubric_id: rubric.id,
        scenario_id: sid,
        assigned_by: currentUser.email,
      }));

      const { error: assignError } = await supabase
        .from('rubric_scenario_assignments')
        .insert(assignments);

      if (assignError) throw assignError;
    }

    // Return full rubric
    const { data: fullRubric, error: fetchError } = await supabase
      .from('assessment_rubrics')
      .select(`
        id, name, description, rating_scale, created_by, created_at, updated_at,
        criteria:rubric_criteria(id, name, description, max_points, sort_order),
        assignments:rubric_scenario_assignments(id, scenario_id, assigned_at)
      `)
      .eq('id', rubric.id)
      .single();

    if (fetchError) throw fetchError;

    return NextResponse.json({ success: true, rubric: fullRubric }, { status: 201 });
  } catch (error) {
    console.error('Error creating rubric:', error);
    return NextResponse.json({ error: 'Failed to create rubric' }, { status: 500 });
  }
}
