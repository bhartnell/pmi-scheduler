import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

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
// GET /api/admin/lab-templates/compare?lab_day_id=X&template_id=Y
//
// Compares the stations of a live lab day against a template's stations.
// Returns a structured diff indicating what is unchanged, modified, added,
// or removed relative to the template.
//
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

    const { searchParams } = new URL(request.url);
    const labDayId = searchParams.get('lab_day_id');
    const templateId = searchParams.get('template_id');

    if (!labDayId || !templateId) {
      return NextResponse.json(
        { error: 'lab_day_id and template_id are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 1. Fetch lab day stations with scenario join
    const { data: labStations, error: labError } = await supabase
      .from('lab_stations')
      .select(`
        station_number,
        station_type,
        scenario_id,
        custom_title,
        station_notes,
        metadata,
        scenario:scenarios(id, title)
      `)
      .eq('lab_day_id', labDayId)
      .order('station_number', { ascending: true });

    if (labError) {
      return NextResponse.json(
        { error: `Failed to fetch lab day stations: ${labError.message}` },
        { status: 500 }
      );
    }

    // 2. Fetch template stations
    const { data: templateStations, error: templateError } = await supabase
      .from('lab_template_stations')
      .select(`
        sort_order,
        station_type,
        scenario_id,
        station_name,
        notes,
        metadata,
        scenario_title
      `)
      .eq('template_id', templateId)
      .order('sort_order', { ascending: true });

    if (templateError) {
      return NextResponse.json(
        { error: `Failed to fetch template stations: ${templateError.message}` },
        { status: 500 }
      );
    }

    // 3. Build lookup maps keyed by position number
    const labMap = new Map<number, typeof labStations extends (infer T)[] | null ? T : never>();
    for (const s of labStations ?? []) {
      labMap.set(s.station_number, s);
    }

    const templateMap = new Map<number, typeof templateStations extends (infer T)[] | null ? T : never>();
    for (const s of templateStations ?? []) {
      templateMap.set(s.sort_order, s);
    }

    // 4. Collect all position numbers from both sources
    const allPositions = new Set<number>([
      ...Array.from(labMap.keys()),
      ...Array.from(templateMap.keys()),
    ]);

    // 5. Build diff array
    type DiffItem = {
      station_number: number;
      status: 'unchanged' | 'modified' | 'added' | 'removed';
      template_station: {
        sort_order: number;
        station_type: string;
        station_name: string | null;
        scenario_id: string | null;
        scenario_title: string | null;
        notes: string | null;
        metadata: Record<string, unknown>;
      } | null;
      lab_station: {
        station_number: number;
        station_type: string;
        custom_title: string | null;
        scenario_id: string | null;
        scenario_title: string | null;
        station_notes: string | null;
        metadata: Record<string, unknown>;
      } | null;
      changes: Array<{ field: string; template_value: unknown; lab_value: unknown }>;
    };

    const diff: DiffItem[] = [];

    for (const pos of Array.from(allPositions).sort((a, b) => a - b)) {
      const tpl = templateMap.get(pos) ?? null;
      const lab = labMap.get(pos) ?? null;

      // Normalize scenario titles
      const tplScenarioTitle = tpl?.scenario_title ?? null;
      const labScenarioTitle =
        lab && lab.scenario && !Array.isArray(lab.scenario)
          ? (lab.scenario as { id: string; title: string }).title ?? null
          : null;

      // Normalize lab station shape
      const labNormalized = lab
        ? {
            station_number: lab.station_number,
            station_type: lab.station_type ?? 'scenario',
            custom_title: lab.custom_title ?? null,
            scenario_id: lab.scenario_id ?? null,
            scenario_title: labScenarioTitle,
            station_notes: lab.station_notes ?? null,
            metadata: (lab.metadata as Record<string, unknown>) ?? {},
          }
        : null;

      // Normalize template station shape
      const tplNormalized = tpl
        ? {
            sort_order: tpl.sort_order,
            station_type: tpl.station_type ?? 'scenario',
            station_name: tpl.station_name ?? null,
            scenario_id: tpl.scenario_id ?? null,
            scenario_title: tplScenarioTitle,
            notes: tpl.notes ?? null,
            metadata: (tpl.metadata as Record<string, unknown>) ?? {},
          }
        : null;

      // Determine status and changes
      if (!tpl && lab) {
        // Exists in lab day but not template — "added" to lab day
        diff.push({
          station_number: pos,
          status: 'added',
          template_station: null,
          lab_station: labNormalized,
          changes: [],
        });
      } else if (tpl && !lab) {
        // Exists in template but not lab day — "removed" from lab day
        diff.push({
          station_number: pos,
          status: 'removed',
          template_station: tplNormalized,
          lab_station: null,
          changes: [],
        });
      } else if (tpl && lab && tplNormalized && labNormalized) {
        // Both exist — compare fields
        const changes: Array<{ field: string; template_value: unknown; lab_value: unknown }> = [];

        // Compare station_type
        if (tplNormalized.station_type !== labNormalized.station_type) {
          changes.push({
            field: 'station_type',
            template_value: tplNormalized.station_type,
            lab_value: labNormalized.station_type,
          });
        }

        // Compare scenario_id
        if ((tplNormalized.scenario_id ?? null) !== (labNormalized.scenario_id ?? null)) {
          changes.push({
            field: 'scenario_id',
            template_value: tplNormalized.scenario_id,
            lab_value: labNormalized.scenario_id,
          });
        }

        // Compare title (station_name vs custom_title)
        const tplTitle = tplNormalized.station_name ?? null;
        const labTitle = labNormalized.custom_title ?? null;
        if (tplTitle !== labTitle) {
          changes.push({
            field: 'title',
            template_value: tplTitle,
            lab_value: labTitle,
          });
        }

        // Compare notes (notes vs station_notes)
        const tplNotes = tplNormalized.notes ?? null;
        const labNotes = labNormalized.station_notes ?? null;
        if (tplNotes !== labNotes) {
          changes.push({
            field: 'notes',
            template_value: tplNotes,
            lab_value: labNotes,
          });
        }

        diff.push({
          station_number: pos,
          status: changes.length > 0 ? 'modified' : 'unchanged',
          template_station: tplNormalized,
          lab_station: labNormalized,
          changes,
        });
      }
    }

    const hasChanges = diff.some((d) => d.status !== 'unchanged');

    return NextResponse.json({
      success: true,
      has_changes: hasChanges,
      diff,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error comparing lab day vs template:', msg, error);
    return NextResponse.json(
      { error: `Failed to compare lab day vs template: ${msg}` },
      { status: 500 }
    );
  }
}
