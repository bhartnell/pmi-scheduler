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
// GET /api/admin/lab-templates/[id]
// Returns single template with all stations.
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
    if (!currentUser || !hasMinRole(currentUser.role, 'lead_instructor')) {
      return NextResponse.json({ error: 'Lead instructor access required' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: template, error } = await supabase
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
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }
      throw error;
    }

    // Sort stations by station_number
    const enriched = {
      ...template,
      stations: ((template as any).stations ?? []).sort(
        (a: any, b: any) => (a.station_number || 0) - (b.station_number || 0)
      ),
    };

    return NextResponse.json({ success: true, template: enriched });
  } catch (error) {
    console.error('Error fetching lab template:', error);
    return NextResponse.json({ error: 'Failed to fetch lab template' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/admin/lab-templates/[id]
// Updates template fields and replaces all stations.
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
      program_id?: string;
      semester?: number;
      week_number?: number;
      day_number?: number;
      title?: string;
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

    const supabase = getSupabaseAdmin();

    // Verify template exists
    const { data: existing, error: fetchError } = await supabase
      .from('lab_day_templates')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Build update object
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.program_id !== undefined) updates.program_id = body.program_id;
    if (body.semester !== undefined) updates.semester = body.semester;
    if (body.week_number !== undefined) updates.week_number = body.week_number;
    if (body.day_number !== undefined) updates.day_number = body.day_number;
    if (body.title !== undefined) {
      updates.title = body.title.trim();
      updates.name = body.title.trim(); // keep 'name' in sync
    }
    if (body.description !== undefined) updates.description = body.description;
    if (body.num_rotations !== undefined) updates.num_rotations = body.num_rotations;
    if (body.rotation_duration !== undefined) updates.rotation_duration = body.rotation_duration;

    const { error: updateError } = await supabase
      .from('lab_day_templates')
      .update(updates)
      .eq('id', id);

    if (updateError) throw updateError;

    // Replace stations if provided
    if (body.stations !== undefined) {
      // Delete existing stations
      const { error: deleteError } = await supabase
        .from('lab_template_stations')
        .delete()
        .eq('template_id', id);

      if (deleteError) throw deleteError;

      // Insert new stations
      if (body.stations.length > 0) {
        const stationsToInsert = body.stations.map((s) => ({
          template_id: id,
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

        if (stationsError) throw stationsError;
      }
    }

    // Return updated template with stations
    const { data: fullTemplate, error: refetchError } = await supabase
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
      .eq('id', id)
      .single();

    if (refetchError) throw refetchError;

    return NextResponse.json({ success: true, template: fullTemplate });
  } catch (error) {
    console.error('Error updating lab template:', error);
    return NextResponse.json({ error: 'Failed to update lab template' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/lab-templates/[id]
// Deletes template (cascade removes stations).
// ---------------------------------------------------------------------------
export async function DELETE(
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

    const { error } = await supabase
      .from('lab_day_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting lab template:', error);
    return NextResponse.json({ error: 'Failed to delete lab template' }, { status: 500 });
  }
}
