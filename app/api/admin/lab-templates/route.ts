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
//   ?program_id=X  - filter by program (optional)
//   ?semester=N    - filter by semester (optional)
//
// Returns templates with stations, joined with program name.
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
    const programId = searchParams.get('program_id');
    const semester = searchParams.get('semester');

    // Only fetch program-based templates (those with week_number set via this feature)
    // We identify them by the presence of program_id or the new title field
    let query = supabase
      .from('lab_day_templates')
      .select(`
        id,
        name,
        title,
        description,
        program_id,
        semester,
        week_number,
        day_number,
        num_rotations,
        rotation_duration,
        created_by,
        created_at,
        updated_at,
        program:programs(id, name, abbreviation),
        stations:lab_template_stations(
          id,
          station_number,
          station_type,
          scenario_id,
          skill_name,
          custom_title,
          room,
          notes,
          rotation_minutes,
          num_rotations,
          scenario:scenarios(id, title)
        )
      `)
      .not('program_id', 'is', null)
      .order('semester', { ascending: true })
      .order('week_number', { ascending: true })
      .order('day_number', { ascending: true });

    if (programId) {
      query = query.eq('program_id', programId);
    }

    if (semester) {
      query = query.eq('semester', parseInt(semester));
    }

    const { data: templates, error } = await query;
    if (error) throw error;

    // Sort stations by station_number within each template
    const enriched = (templates ?? []).map((t: any) => ({
      ...t,
      stations: (t.stations ?? []).sort(
        (a: any, b: any) => (a.station_number || 0) - (b.station_number || 0)
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
// Body: { program_id, semester, week_number, day_number, title, description,
//         num_rotations, rotation_duration, stations: [...] }
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
      program_id: string;
      semester: number;
      week_number: number;
      day_number?: number;
      title: string;
      description?: string;
      num_rotations?: number;
      rotation_duration?: number;
      stations?: Array<{
        station_number: number;
        station_type: string;
        scenario_id?: string | null;
        skill_name?: string | null;
        custom_title?: string | null;
        room?: string | null;
        notes?: string | null;
        rotation_minutes?: number | null;
        num_rotations?: number | null;
      }>;
    };

    const { program_id, semester, week_number, title, stations } = body;

    if (!program_id || !semester || !week_number || !title) {
      return NextResponse.json(
        { error: 'program_id, semester, week_number, and title are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Insert the template
    const { data: template, error: templateError } = await supabase
      .from('lab_day_templates')
      .insert({
        name: title.trim(), // keep 'name' populated for backward compat
        title: title.trim(),
        description: body.description ?? null,
        program_id,
        semester,
        week_number,
        day_number: body.day_number ?? 1,
        num_rotations: body.num_rotations ?? 4,
        rotation_duration: body.rotation_duration ?? 30,
        created_by: currentUser.email,
        template_data: {}, // required by original schema – store empty object
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
      const stationsToInsert = stations.map((s) => ({
        template_id: template.id,
        station_number: s.station_number,
        station_type: s.station_type || 'scenario',
        scenario_id: s.scenario_id || null,
        skill_name: s.skill_name || null,
        custom_title: s.custom_title || null,
        room: s.room || null,
        notes: s.notes || null,
        rotation_minutes: s.rotation_minutes || null,
        num_rotations: s.num_rotations || null,
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
        id, name, title, description, program_id, semester, week_number, day_number,
        num_rotations, rotation_duration, created_by, created_at, updated_at,
        program:programs(id, name, abbreviation),
        stations:lab_template_stations(
          id, station_number, station_type, scenario_id, skill_name, custom_title,
          room, notes, rotation_minutes, num_rotations,
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
