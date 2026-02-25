import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

type RouteContext = { params: Promise<{ id: string }> };

async function getAuthenticatedInstructor(email: string) {
  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase
    .from('lab_users')
    .select('id, role')
    .ilike('email', email)
    .single();
  return user;
}

// GET /api/lab-management/lab-days/[id]/checklist
// Fetch all checklist items for a lab day, sorted by sort_order
export async function GET(request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();

  const user = await getAuthenticatedInstructor(session.user.email);
  if (!user || !hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { data, error } = await supabase
      .from('lab_day_checklist_items')
      .select('*')
      .eq('lab_day_id', labDayId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, items: data || [] });
  } catch (error) {
    console.error('Error fetching checklist items:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch checklist items' }, { status: 500 });
  }
}

// POST /api/lab-management/lab-days/[id]/checklist
// Add a new item OR auto-generate items from stations
export async function POST(request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();

  const user = await getAuthenticatedInstructor(session.user.email);
  if (!user || !hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();

    // Auto-generate from stations
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
        .from('lab_day_checklist_items')
        .delete()
        .eq('lab_day_id', labDayId)
        .eq('is_auto_generated', true);

      // Build items list
      const items: { lab_day_id: string; title: string; is_auto_generated: boolean; sort_order: number }[] = [];
      let sortOrder = 0;

      const stations = (labDay.stations as any[]) || [];

      // Per-station items
      for (const station of stations) {
        const stationLabel = station.custom_title
          || (station.scenario as any)?.title
          || station.skill_name
          || `Station ${station.station_number}`;

        items.push({
          lab_day_id: labDayId,
          title: `Set up Station ${station.station_number}: ${stationLabel}`,
          is_auto_generated: true,
          sort_order: sortOrder++,
        });

        if ((station.station_type === 'scenario') && (station.scenario as any)?.title) {
          items.push({
            lab_day_id: labDayId,
            title: `Equipment ready for: ${(station.scenario as any).title}`,
            is_auto_generated: true,
            sort_order: sortOrder++,
          });
        }
      }

      // Common prep items always added
      const commonItems = [
        'Check supplies inventory',
        'Print station cards',
        'Set up timer display',
        'Confirm instructor assignments',
        'Review student roster',
      ];
      for (const title of commonItems) {
        items.push({
          lab_day_id: labDayId,
          title,
          is_auto_generated: true,
          sort_order: sortOrder++,
        });
      }

      if (items.length === 0) {
        return NextResponse.json({ success: true, items: [] });
      }

      const { data: inserted, error: insertError } = await supabase
        .from('lab_day_checklist_items')
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
      .from('lab_day_checklist_items')
      .select('sort_order')
      .eq('lab_day_id', labDayId)
      .order('sort_order', { ascending: false })
      .limit(1);

    const maxSortOrder = existing && existing.length > 0 ? (existing[0].sort_order ?? 0) : -1;

    const { data, error } = await supabase
      .from('lab_day_checklist_items')
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
  } catch (error) {
    console.error('Error creating checklist item:', error);
    return NextResponse.json({ success: false, error: 'Failed to create checklist item' }, { status: 500 });
  }
}

// PUT /api/lab-management/lab-days/[id]/checklist
// Update a checklist item (toggle completed, update title)
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();

  const user = await getAuthenticatedInstructor(session.user.email);
  if (!user || !hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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
      .from('lab_day_checklist_items')
      .update(updates)
      .eq('id', item_id)
      .eq('lab_day_id', labDayId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, item: data });
  } catch (error) {
    console.error('Error updating checklist item:', error);
    return NextResponse.json({ success: false, error: 'Failed to update checklist item' }, { status: 500 });
  }
}

// DELETE /api/lab-management/lab-days/[id]/checklist
// Remove a specific checklist item by item_id query param
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();

  const user = await getAuthenticatedInstructor(session.user.email);
  if (!user || !hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get('itemId');

  if (!itemId) {
    return NextResponse.json({ error: 'itemId query param is required' }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from('lab_day_checklist_items')
      .delete()
      .eq('id', itemId)
      .eq('lab_day_id', labDayId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting checklist item:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete checklist item' }, { status: 500 });
  }
}
