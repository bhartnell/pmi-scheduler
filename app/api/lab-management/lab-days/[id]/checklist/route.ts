import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/lab-management/lab-days/[id]/checklist
// Fetch all checklist items for a lab day, sorted by sort_order
export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user } = auth;

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();



  try {
    const { data, error } = await supabase
      .from('lab_day_checklists')
      .select('*')
      .eq('lab_day_id', labDayId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      if (error.message?.includes('does not exist')) {
        return NextResponse.json({ success: true, items: [] });
      }
      throw error;
    }

    return NextResponse.json({ success: true, items: data || [] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('does not exist')) {
      return NextResponse.json({ success: true, items: [] });
    }
    console.error('Error fetching checklist items:', error);
    return NextResponse.json({ success: false, error: (error instanceof Error ? error.message : (error as any)?.message) || 'Failed to fetch checklist items' }, { status: 500 });
  }
}

// POST /api/lab-management/lab-days/[id]/checklist
// Add a new item OR auto-generate items from stations
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user } = auth;

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();



  try {
    const body = await request.json();

    // Auto-generate from stations using checklist templates
    if (body.action === 'auto-generate') {
      // Fetch lab day with stations and scenarios
      const { data: labDay, error: labDayError } = await supabase
        .from('lab_days')
        .select(`
          id,
          stations:lab_stations(
            id,
            station_number,
            station_type,
            custom_title,
            skill_name,
            scenario:scenarios(id, title)
          )
        `)
        .eq('id', labDayId)
        .single();

      if (labDayError || !labDay) {
        return NextResponse.json({ error: 'Lab day not found' }, { status: 404 });
      }

      // Delete existing auto-generated items first
      await supabase
        .from('lab_day_checklists')
        .delete()
        .eq('lab_day_id', labDayId)
        .eq('is_auto_generated', true);

      // Fetch default templates for all station types + common
      const stations = (labDay.stations as any[]) || [];
      const stationTypes = [...new Set(stations.map((s: any) => s.station_type as string))];
      const templateTypes = [...stationTypes, '_common'];

      let templates: any[] = [];
      try {
        const { data: tmplData } = await supabase
          .from('lab_checklist_templates')
          .select('*')
          .in('station_type', templateTypes)
          .eq('is_default', true);
        templates = tmplData || [];
      } catch {
        // Templates table may not exist yet; fall back to hard-coded items
      }

      // Build a map of station_type → template items
      const templateMap: Record<string, { title: string; sort_order: number }[]> = {};
      for (const tmpl of templates) {
        templateMap[tmpl.station_type] = tmpl.items || [];
      }

      // Build items list
      const items: { lab_day_id: string; title: string; is_auto_generated: boolean; sort_order: number }[] = [];
      let sortOrder = 0;

      // Per-station items: use template if available, otherwise fallback
      for (const station of stations) {
        const stationLabel = station.custom_title
          || (station.scenario as any)?.title
          || station.skill_name
          || `Station ${station.station_number}`;

        const stationType = station.station_type as string;
        const templateItems = templateMap[stationType];

        if (templateItems && templateItems.length > 0) {
          // Use template items, prefixed with station number
          for (const tmplItem of templateItems) {
            items.push({
              lab_day_id: labDayId,
              title: `Stn ${station.station_number} — ${tmplItem.title}`,
              is_auto_generated: true,
              sort_order: sortOrder++,
            });
          }
        } else {
          // Fallback: basic setup item
          items.push({
            lab_day_id: labDayId,
            title: `Set up Station ${station.station_number}: ${stationLabel}`,
            is_auto_generated: true,
            sort_order: sortOrder++,
          });

          if ((stationType === 'scenario') && (station.scenario as any)?.title) {
            items.push({
              lab_day_id: labDayId,
              title: `Equipment ready for: ${(station.scenario as any).title}`,
              is_auto_generated: true,
              sort_order: sortOrder++,
            });
          }
        }
      }

      // Common prep items: use _common template if available, otherwise fallback
      const commonTemplate = templateMap['_common'];
      if (commonTemplate && commonTemplate.length > 0) {
        for (const item of commonTemplate) {
          items.push({
            lab_day_id: labDayId,
            title: item.title,
            is_auto_generated: true,
            sort_order: sortOrder++,
          });
        }
      } else {
        const fallbackCommon = [
          'Check supplies inventory',
          'Print station cards',
          'Set up timer display',
          'Confirm instructor assignments',
          'Review student roster',
        ];
        for (const title of fallbackCommon) {
          items.push({
            lab_day_id: labDayId,
            title,
            is_auto_generated: true,
            sort_order: sortOrder++,
          });
        }
      }

      if (items.length === 0) {
        return NextResponse.json({ success: true, items: [] });
      }

      const { data: inserted, error: insertError } = await supabase
        .from('lab_day_checklists')
        .insert(items)
        .select();

      if (insertError) throw insertError;

      return NextResponse.json({ success: true, items: inserted || [] });
    }

    // Add a single item
    const { title, is_auto_generated = false } = body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    // Get current max sort_order for this lab day
    const { data: existing } = await supabase
      .from('lab_day_checklists')
      .select('sort_order')
      .eq('lab_day_id', labDayId)
      .order('sort_order', { ascending: false })
      .limit(1);

    const maxSortOrder = existing && existing.length > 0 ? (existing[0].sort_order ?? 0) : -1;

    const { data, error } = await supabase
      .from('lab_day_checklists')
      .insert({
        lab_day_id: labDayId,
        title: title.trim(),
        is_auto_generated,
        sort_order: maxSortOrder + 1,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, item: data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('does not exist')) {
      return NextResponse.json({ success: false, error: 'Checklist feature is not yet configured. Please run database migrations.' }, { status: 503 });
    }
    console.error('Error creating checklist item:', error);
    return NextResponse.json({ success: false, error: (error instanceof Error ? error.message : (error as any)?.message) || 'Failed to create checklist item' }, { status: 500 });
  }
}

// PUT /api/lab-management/lab-days/[id]/checklist
// Update a checklist item (toggle completed, update title)
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user } = auth;

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();



  try {
    const body = await request.json();
    const { item_id, is_completed, title } = body;

    if (!item_id) {
      return NextResponse.json({ error: 'item_id is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};

    if (typeof is_completed === 'boolean') {
      updates.is_completed = is_completed;
      if (is_completed) {
        updates.completed_by = user.id;
        updates.completed_at = new Date().toISOString();
      } else {
        updates.completed_by = null;
        updates.completed_at = null;
      }
    }

    if (typeof title === 'string' && title.trim()) {
      updates.title = title.trim();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('lab_day_checklists')
      .update(updates)
      .eq('id', item_id)
      .eq('lab_day_id', labDayId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, item: data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('does not exist')) {
      return NextResponse.json({ success: false, error: 'Checklist feature is not yet configured. Please run database migrations.' }, { status: 503 });
    }
    console.error('Error updating checklist item:', error);
    return NextResponse.json({ success: false, error: (error instanceof Error ? error.message : (error as any)?.message) || 'Failed to update checklist item' }, { status: 500 });
  }
}

// DELETE /api/lab-management/lab-days/[id]/checklist
// Remove a specific checklist item by item_id query param
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user } = auth;

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();



  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get('itemId');

  if (!itemId) {
    return NextResponse.json({ error: 'itemId query param is required' }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from('lab_day_checklists')
      .delete()
      .eq('id', itemId)
      .eq('lab_day_id', labDayId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('does not exist')) {
      return NextResponse.json({ success: false, error: 'Checklist feature is not yet configured. Please run database migrations.' }, { status: 503 });
    }
    console.error('Error deleting checklist item:', error);
    return NextResponse.json({ success: false, error: (error instanceof Error ? error.message : (error as any)?.message) || 'Failed to delete checklist item' }, { status: 500 });
  }
}
