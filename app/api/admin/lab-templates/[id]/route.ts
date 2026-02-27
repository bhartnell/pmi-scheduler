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
        id, name, description, program, semester, week_number,
        created_by, created_at, updated_at,
        stations:lab_template_stations(
          id, sort_order, station_type, station_name, skills, scenario_id,
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

    // Sort stations by sort_order
    const enriched = {
      ...template,
      stations: ((template as any).stations ?? []).sort(
        (a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)
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
      program?: string;
      semester?: number;
      week_number?: number;
      name?: string;
      description?: string;
      stations?: Array<{
        sort_order: number;
        station_type: string;
        station_name?: string | null;
        skills?: unknown[] | null;
        scenario_id?: string | null;
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
    if (body.program !== undefined) updates.program = body.program;
    if (body.semester !== undefined) updates.semester = body.semester;
    if (body.week_number !== undefined) updates.week_number = body.week_number;
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.description !== undefined) updates.description = body.description;

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
        const stationsToInsert = body.stations.map((s, i) => ({
          template_id: id,
          sort_order: s.sort_order ?? i + 1,
          station_type: s.station_type || 'scenario',
          station_name: s.station_name || null,
          skills: s.skills || null,
          scenario_id: s.scenario_id || null,
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
        id, name, description, program, semester, week_number,
        created_by, created_at, updated_at,
        stations:lab_template_stations(
          id, sort_order, station_type, station_name, skills, scenario_id,
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
