import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

interface StationDiffEntry {
  station_number: number;
  status: 'unchanged' | 'modified' | 'added' | 'removed';
  template_station: Record<string, unknown> | null;
  lab_station: Record<string, unknown> | null;
  changes: Array<{ field: string; template_value: unknown; lab_value: unknown }>;
}

// GET /api/lab-management/template-reviews/[id]/items/[itemId]
// Full item detail with diff computation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const { id, itemId } = await params;
    const supabase = getSupabaseAdmin();

    // Fetch the item
    const { data: item, error: itemError } = await supabase
      .from('template_review_items')
      .select(`
        *,
        lab_day:lab_days(id, date, title, week_number, day_number, source_template_id)
      `)
      .eq('id', itemId)
      .eq('review_id', id)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: 'Review item not found' }, { status: 404 });
    }

    const labDay = item.lab_day as Record<string, unknown>;

    // Fetch lab_stations for this lab_day
    const { data: labStations } = await supabase
      .from('lab_stations')
      .select(`
        id, station_number, station_type, custom_title, skill_name, room,
        station_notes, rotation_minutes, num_rotations, notes,
        scenario:scenarios(id, title)
      `)
      .eq('lab_day_id', labDay.id as string)
      .order('station_number', { ascending: true });

    // Try to fetch template stations
    let templateStations: Record<string, unknown>[] = [];
    const templateId = item.template_id as string | null;

    if (templateId) {
      // Try lab_week_templates first
      const { data: weekTemplate } = await supabase
        .from('lab_week_templates')
        .select('days')
        .eq('id', templateId)
        .single();

      if (weekTemplate && weekTemplate.days) {
        const days = weekTemplate.days as Array<Record<string, unknown>>;
        const dayNumber = labDay.day_number as number;
        const matchingDay = days.find((d) => d.day_number === dayNumber);
        if (matchingDay && Array.isArray(matchingDay.stations)) {
          templateStations = matchingDay.stations as Record<string, unknown>[];
        }
      }

      // If not found in week templates, try lab_day_templates
      if (templateStations.length === 0) {
        const { data: dayTemplate } = await supabase
          .from('lab_day_templates')
          .select('template_data')
          .eq('id', templateId)
          .single();

        if (dayTemplate && dayTemplate.template_data) {
          const td = dayTemplate.template_data as Record<string, unknown>;
          if (Array.isArray(td.stations)) {
            templateStations = td.stations as Record<string, unknown>[];
          }
        }
      }
    }

    // Build diff
    const diff = buildDiff(templateStations, labStations || []);

    // Fetch comments
    const { data: comments } = await supabase
      .from('template_review_comments')
      .select('*')
      .eq('review_item_id', itemId)
      .order('created_at', { ascending: true });

    return NextResponse.json({
      success: true,
      item,
      labDay,
      labStations: labStations || [],
      templateStations,
      diff,
      comments: comments || [],
    });
  } catch (error) {
    console.error('Error fetching review item detail:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch review item' }, { status: 500 });
  }
}

// PUT /api/lab-management/template-reviews/[id]/items/[itemId]
// Set disposition, reviewer_notes, revised_data
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const auth = await requireAuth('lead_instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const { id, itemId } = await params;
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { disposition, reviewer_notes, revised_data } = body;

    const updates: Record<string, unknown> = {
      reviewed_by: user.email,
      reviewed_at: new Date().toISOString(),
    };

    if (disposition !== undefined) updates.disposition = disposition;
    if (reviewer_notes !== undefined) updates.reviewer_notes = reviewer_notes;
    if (revised_data !== undefined) updates.revised_data = revised_data;

    const { data, error } = await supabase
      .from('template_review_items')
      .update(updates)
      .eq('id', itemId)
      .eq('review_id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, item: data });
  } catch (error) {
    console.error('Error updating review item:', error);
    return NextResponse.json({ success: false, error: 'Failed to update review item' }, { status: 500 });
  }
}

// ── Diff helpers ────────────────────────────────────────────────────────
function buildDiff(
  templateStations: Record<string, unknown>[],
  labStations: Record<string, unknown>[]
): StationDiffEntry[] {
  const COMPARE_FIELDS = ['station_type', 'rotation_minutes', 'room', 'notes'];
  const diff: StationDiffEntry[] = [];

  // Index by station_number
  const templateByNum = new Map<number, Record<string, unknown>>();
  for (const ts of templateStations) {
    const num = (ts.station_number ?? ts.sort_order ?? 0) as number;
    templateByNum.set(num, ts);
  }

  const labByNum = new Map<number, Record<string, unknown>>();
  for (const ls of labStations) {
    const num = (ls.station_number ?? 0) as number;
    labByNum.set(num, ls);
  }

  const allNums = new Set([...templateByNum.keys(), ...labByNum.keys()]);
  const sortedNums = Array.from(allNums).sort((a, b) => a - b);

  for (const num of sortedNums) {
    const ts = templateByNum.get(num) || null;
    const ls = labByNum.get(num) || null;

    if (ts && !ls) {
      diff.push({ station_number: num, status: 'removed', template_station: ts, lab_station: null, changes: [] });
    } else if (!ts && ls) {
      diff.push({ station_number: num, status: 'added', template_station: null, lab_station: ls, changes: [] });
    } else if (ts && ls) {
      const changes: Array<{ field: string; template_value: unknown; lab_value: unknown }> = [];

      for (const field of COMPARE_FIELDS) {
        const tVal = getFieldValue(ts, field);
        const lVal = getFieldValue(ls, field);
        if (normalizeVal(tVal) !== normalizeVal(lVal)) {
          changes.push({ field, template_value: tVal, lab_value: lVal });
        }
      }

      // Compare scenario/skill name
      const tName = getStationName(ts);
      const lName = getStationName(ls);
      if (tName !== lName) {
        changes.push({ field: 'scenario/skill', template_value: tName, lab_value: lName });
      }

      diff.push({
        station_number: num,
        status: changes.length > 0 ? 'modified' : 'unchanged',
        template_station: ts,
        lab_station: ls,
        changes,
      });
    }
  }

  return diff;
}

function getFieldValue(station: Record<string, unknown>, field: string): unknown {
  if (field === 'notes') {
    return station.notes ?? station.station_notes ?? null;
  }
  return station[field] ?? null;
}

function getStationName(station: Record<string, unknown>): string {
  const scenario = station.scenario as Record<string, unknown> | null;
  if (scenario?.title) return scenario.title as string;
  if (station.scenario_title) return station.scenario_title as string;
  if (station.skill_name) return station.skill_name as string;
  if (station.custom_title) return station.custom_title as string;
  if (station.station_name) return station.station_name as string;
  return '';
}

function normalizeVal(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  return String(v);
}
