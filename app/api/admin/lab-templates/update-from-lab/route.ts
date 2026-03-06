import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';
import { requireAuth } from '@/lib/api-auth';

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
      change_summary: changeSummary || 'Updated from lab day',
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
// POST /api/admin/lab-templates/update-from-lab
//
// Pushes selected lab day station changes back to the source template.
// Creates a version snapshot of the current template state before applying.
//
// Body: {
//   template_id: string,
//   lab_day_id: string,
//   selected_changes: number[],  // station_number values to push back
//   change_summary?: string,
// }
//
// Requires admin+ role.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(user.email);
    if (!currentUser || !canAccessAdmin(user.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json() as {
      template_id: string;
      lab_day_id: string;
      selected_changes: number[];
      change_summary?: string;
    };

    const { template_id, lab_day_id, selected_changes, change_summary } = body;

    if (!template_id || !lab_day_id || !selected_changes || !Array.isArray(selected_changes)) {
      return NextResponse.json(
        { error: 'template_id, lab_day_id, and selected_changes are required' },
        { status: 400 }
      );
    }

    if (selected_changes.length === 0) {
      return NextResponse.json(
        { error: 'At least one station must be selected' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 1. Fetch current template with stations
    const { data: template, error: templateError } = await supabase
      .from('lab_day_templates')
      .select(`
        id, name, description, program, semester, week_number, day_number,
        stations:lab_template_stations(
          id, sort_order, station_type, station_name, skills, scenario_id,
          scenario_title, difficulty, notes, metadata
        )
      `)
      .eq('id', template_id)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // 2. Create version snapshot of current state before applying changes
    const version = await createVersionSnapshot(
      supabase,
      template_id,
      user.email,
      change_summary || 'Updated from lab day',
      lab_day_id
    );

    const version_number = version?.version_number ?? 1;

    // 3. Fetch lab day stations
    const { data: labStations, error: labStationsError } = await supabase
      .from('lab_stations')
      .select(`
        id, station_number, station_type, scenario_id,
        custom_title, station_notes, metadata
      `)
      .eq('lab_day_id', lab_day_id)
      .order('station_number', { ascending: true });

    if (labStationsError) {
      return NextResponse.json(
        { error: `Failed to fetch lab stations: ${labStationsError.message}` },
        { status: 500 }
      );
    }

    const templateStations = (template as any).stations as Array<{
      id: string;
      sort_order: number;
      station_type: string;
      station_name: string | null;
      skills: unknown[] | null;
      scenario_id: string | null;
      scenario_title: string | null;
      difficulty: string | null;
      notes: string | null;
      metadata: Record<string, unknown> | null;
    }>;

    // 4. For each selected station_number, update or insert template station
    let changesApplied = 0;
    const applyErrors: string[] = [];

    for (const stationNumber of selected_changes) {
      // Find corresponding lab station
      const labStation = (labStations || []).find(
        (s: any) => s.station_number === stationNumber
      );

      if (!labStation) {
        applyErrors.push(`Lab station #${stationNumber} not found`);
        continue;
      }

      // Find corresponding template station by sort_order
      const templateStation = templateStations.find(
        (s) => s.sort_order === stationNumber
      );

      if (templateStation) {
        // Update existing template station
        const { error: updateError } = await supabase
          .from('lab_template_stations')
          .update({
            station_type: labStation.station_type || templateStation.station_type,
            station_name: labStation.custom_title || templateStation.station_name,
            scenario_id: labStation.scenario_id || null,
            notes: labStation.station_notes || null,
            metadata: labStation.metadata || null,
          })
          .eq('id', templateStation.id);

        if (updateError) {
          applyErrors.push(`Station #${stationNumber} update failed: ${updateError.message}`);
          continue;
        }
      } else {
        // Insert new template station (station exists in lab day but not in template)
        const { error: insertError } = await supabase
          .from('lab_template_stations')
          .insert({
            template_id,
            sort_order: stationNumber,
            station_type: labStation.station_type || 'scenario',
            station_name: labStation.custom_title || null,
            scenario_id: labStation.scenario_id || null,
            notes: labStation.station_notes || null,
            metadata: labStation.metadata || null,
          });

        if (insertError) {
          applyErrors.push(`Station #${stationNumber} insert failed: ${insertError.message}`);
          continue;
        }
      }

      changesApplied++;
    }

    // 5. Update template updated_at
    await supabase
      .from('lab_day_templates')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', template_id);

    return NextResponse.json({
      success: true,
      version_number,
      changes_applied: changesApplied,
      errors: applyErrors.length > 0 ? applyErrors : undefined,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error updating template from lab day:', msg, error);
    return NextResponse.json(
      { error: `Failed to update template from lab day: ${msg}` },
      { status: 500 }
    );
  }
}
