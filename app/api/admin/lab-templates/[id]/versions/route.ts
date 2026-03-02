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
// Helper – create a version snapshot of the current template state
// ---------------------------------------------------------------------------
async function createVersionSnapshot(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  templateId: string,
  createdBy: string,
  changeSummary?: string,
  sourceLabDayId?: string
) {
  // Fetch current template + stations
  const { data: template } = await supabase
    .from('lab_day_templates')
    .select(`
      id, name, description, program, semester, week_number, day_number,
      stations:lab_template_stations(
        id, sort_order, station_type, station_name, skills, scenario_id,
        scenario_title, difficulty, notes, metadata
      )
    `)
    .eq('id', templateId)
    .single();

  if (!template) return null;

  // Get next version number
  const { data: maxVersion } = await supabase
    .from('lab_template_versions')
    .select('version_number')
    .eq('template_id', templateId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (maxVersion?.version_number || 0) + 1;

  const snapshot = {
    name: template.name,
    description: template.description,
    program: template.program,
    semester: template.semester,
    week_number: template.week_number,
    day_number: template.day_number,
    stations: (template as any).stations || [],
  };

  const { data: version, error } = await supabase
    .from('lab_template_versions')
    .insert({
      template_id: templateId,
      version_number: nextVersion,
      snapshot,
      change_summary: changeSummary || 'Manual edit',
      source_lab_day_id: sourceLabDayId || null,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating version snapshot:', error);
    return null;
  }

  return version;
}

// ---------------------------------------------------------------------------
// GET /api/admin/lab-templates/[id]/versions
// Returns all version history for a template, newest first.
// Requires lead_instructor+ role.
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

    const { data: versions, error } = await supabase
      .from('lab_template_versions')
      .select('*')
      .eq('template_id', id)
      .order('version_number', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, versions: versions || [] });
  } catch (error) {
    console.error('Error fetching template versions:', error);
    return NextResponse.json({ error: 'Failed to fetch template versions' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/lab-templates/[id]/versions
// Restores a specific version of the template.
// Body: { version_id: string }
// Requires admin+ role.
// ---------------------------------------------------------------------------
export async function POST(
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
    const body = await request.json() as { version_id: string };
    const { version_id } = body;

    if (!version_id) {
      return NextResponse.json({ error: 'version_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch the version to restore
    const { data: targetVersion, error: versionError } = await supabase
      .from('lab_template_versions')
      .select('*')
      .eq('id', version_id)
      .eq('template_id', id)
      .single();

    if (versionError || !targetVersion) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    // Create a snapshot of the current state before restoring
    const newVersion = await createVersionSnapshot(
      supabase,
      id,
      currentUser.email,
      `Pre-restore snapshot (restoring to v${targetVersion.version_number})`
    );

    const new_version_number = newVersion?.version_number ?? null;

    // Extract the snapshot to restore
    const snapshot = targetVersion.snapshot as {
      name?: string;
      description?: string;
      program?: string;
      semester?: number;
      week_number?: number;
      day_number?: number;
      stations?: Array<{
        sort_order: number;
        station_type: string;
        station_name?: string | null;
        skills?: unknown[] | null;
        scenario_id?: string | null;
        scenario_title?: string | null;
        difficulty?: string | null;
        notes?: string | null;
        metadata?: Record<string, unknown> | null;
      }>;
    };

    // Delete existing template stations
    const { error: deleteError } = await supabase
      .from('lab_template_stations')
      .delete()
      .eq('template_id', id);

    if (deleteError) throw deleteError;

    // Insert stations from the snapshot
    if (snapshot.stations && snapshot.stations.length > 0) {
      const stationsToInsert = snapshot.stations.map((s) => ({
        template_id: id,
        sort_order: s.sort_order,
        station_type: s.station_type || 'scenario',
        station_name: s.station_name || null,
        skills: s.skills || null,
        scenario_id: s.scenario_id || null,
        notes: s.notes || null,
        metadata: s.metadata || null,
      }));

      const { error: insertError } = await supabase
        .from('lab_template_stations')
        .insert(stationsToInsert);

      if (insertError) throw insertError;
    }

    // Update template fields from snapshot
    const templateUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (snapshot.name !== undefined) templateUpdates.name = snapshot.name;
    if (snapshot.description !== undefined) templateUpdates.description = snapshot.description;
    if (snapshot.program !== undefined) templateUpdates.program = snapshot.program;
    if (snapshot.semester !== undefined) templateUpdates.semester = snapshot.semester;
    if (snapshot.week_number !== undefined) templateUpdates.week_number = snapshot.week_number;
    if (snapshot.day_number !== undefined) templateUpdates.day_number = snapshot.day_number;

    const { error: updateError } = await supabase
      .from('lab_day_templates')
      .update(templateUpdates)
      .eq('id', id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      restored_version_number: targetVersion.version_number,
      new_version_number,
    });
  } catch (error) {
    console.error('Error restoring template version:', error);
    return NextResponse.json({ error: 'Failed to restore template version' }, { status: 500 });
  }
}
