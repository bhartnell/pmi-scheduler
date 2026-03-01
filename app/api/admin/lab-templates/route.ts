import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole, canAccessAdmin } from '@/lib/permissions';

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
// GET /api/admin/lab-templates
//
// Query params:
//   ?program=X   - filter by program text value (optional)
//   ?semester=N  - filter by semester (optional)
//
// Returns templates with stations.
// Requires lead_instructor+ role.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !hasMinRole(currentUser.role, 'lead_instructor')) {
      return NextResponse.json({ error: 'Lead instructor access required' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const program = searchParams.get('program') || searchParams.get('program_id');
    const semester = searchParams.get('semester');

    let query = supabase
      .from('lab_day_templates')
      .select(`
        id,
        name,
        description,
        program,
        semester,
        week_number,
        day_number,
        category,
        instructor_count,
        is_anchor,
        anchor_type,
        requires_review,
        review_notes,
        created_by,
        created_at,
        updated_at,
        stations:lab_template_stations(
          id,
          sort_order,
          station_type,
          station_name,
          skills,
          scenario_id,
          scenario_title,
          difficulty,
          notes,
          scenario:scenarios(id, title)
        )
      `)
      .not('program', 'is', null)
      .order('semester', { ascending: true })
      .order('week_number', { ascending: true });

    if (program) {
      query = query.eq('program', program);
    }

    if (semester) {
      query = query.eq('semester', parseInt(semester));
    }

    const { data: templates, error } = await query;
    if (error) throw error;

    // Sort stations by sort_order within each template
    const enriched = (templates ?? []).map((t: any) => ({
      ...t,
      stations: (t.stations ?? []).sort(
        (a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)
      ),
    }));

    return NextResponse.json({ success: true, templates: enriched });
  } catch (error) {
    console.error('Error fetching lab templates:', error);
    return NextResponse.json({ error: 'Failed to fetch lab templates' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/lab-templates
//
// Body: { program, semester, week_number, name, description, stations: [...] }
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
      program: string;
      semester: number;
      week_number: number;
      day_number?: number;
      name: string;
      description?: string;
      category?: string;
      instructor_count?: number;
      is_anchor?: boolean;
      anchor_type?: string | null;
      requires_review?: boolean;
      review_notes?: string | null;
      stations?: Array<{
        sort_order: number;
        station_type: string;
        station_name?: string | null;
        skills?: unknown[] | null;
        scenario_id?: string | null;
        scenario_title?: string | null;
        difficulty?: string | null;
        notes?: string | null;
      }>;
    };

    const { program, semester, week_number, name, stations } = body;

    if (!program || !semester || !week_number || !name) {
      return NextResponse.json(
        { error: 'program, semester, week_number, and name are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Insert the template
    const { data: template, error: templateError } = await supabase
      .from('lab_day_templates')
      .insert({
        name: name.trim(),
        description: body.description ?? null,
        program,
        semester,
        week_number,
        day_number: body.day_number ?? 1,
        category: body.category ?? 'other',
        instructor_count: body.instructor_count ?? null,
        is_anchor: body.is_anchor ?? false,
        anchor_type: body.anchor_type ?? null,
        requires_review: body.requires_review ?? false,
        review_notes: body.review_notes ?? null,
        created_by: currentUser.email,
        template_data: {},
        is_shared: true,
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (templateError) {
      console.error('Error inserting lab template:', templateError);
      throw templateError;
    }

    // Insert stations if provided
    if (stations && stations.length > 0) {
      const stationsToInsert = stations.map((s, i) => ({
        template_id: template.id,
        sort_order: s.sort_order ?? i + 1,
        station_type: s.station_type || 'scenario',
        station_name: s.station_name || null,
        skills: s.skills || null,
        scenario_id: s.scenario_id || null,
        scenario_title: s.scenario_title || null,
        difficulty: s.difficulty || null,
        notes: s.notes || null,
      }));

      const { error: stationsError } = await supabase
        .from('lab_template_stations')
        .insert(stationsToInsert);

      if (stationsError) {
        console.error('Error inserting template stations:', stationsError);
        throw stationsError;
      }
    }

    // Return the full template with stations
    const { data: fullTemplate, error: fetchError } = await supabase
      .from('lab_day_templates')
      .select(`
        id, name, description, program, semester, week_number, day_number,
        category, instructor_count, is_anchor, anchor_type,
        requires_review, review_notes,
        created_by, created_at, updated_at,
        stations:lab_template_stations(
          id, sort_order, station_type, station_name, skills, scenario_id,
          scenario_title, difficulty, notes,
          scenario:scenarios(id, title)
        )
      `)
      .eq('id', template.id)
      .single();

    if (fetchError) throw fetchError;

    return NextResponse.json({ success: true, template: fullTemplate }, { status: 201 });
  } catch (error) {
    console.error('Error creating lab template:', error);
    return NextResponse.json({ error: 'Failed to create lab template' }, { status: 500 });
  }
}
