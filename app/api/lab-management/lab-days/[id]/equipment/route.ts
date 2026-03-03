import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

type RouteContext = { params: Promise<{ id: string }> };

async function getAuthenticatedUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase
    .from('lab_users')
    .select('id, role')
    .ilike('email', email)
    .single();
  return user;
}

// GET /api/lab-management/lab-days/[id]/equipment
// Fetch all equipment items for a lab day
export async function GET(request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();

  const user = await getAuthenticatedUser(session.user.email);
  if (!user || !hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { data, error } = await supabase
      .from('lab_equipment_items')
      .select(`
        *,
        station:lab_stations(id, station_number, custom_title, skill_name, station_type)
      `)
      .eq('lab_day_id', labDayId)
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
    console.error('Error fetching equipment items:', error);
    return NextResponse.json({ success: false, error: (error instanceof Error ? error.message : (error as any)?.message) || 'Failed to fetch equipment items' }, { status: 500 });
  }
}

// POST /api/lab-management/lab-days/[id]/equipment
// Add a new equipment item
export async function POST(request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();

  const user = await getAuthenticatedUser(session.user.email);
  if (!user || !hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, quantity = 1, station_id, notes } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('lab_equipment_items')
      .insert({
        lab_day_id: labDayId,
        name: name.trim(),
        quantity: Math.max(1, parseInt(quantity, 10) || 1),
        status: 'checked_out',
        station_id: station_id || null,
        notes: notes?.trim() || null,
        checked_out_by: user.id,
      })
      .select(`
        *,
        station:lab_stations(id, station_number, custom_title, skill_name, station_type)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, item: data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('does not exist')) {
      return NextResponse.json({ success: false, error: 'Equipment tracking is not yet configured. Please run database migrations.' }, { status: 503 });
    }
    console.error('Error creating equipment item:', error);
    return NextResponse.json({ success: false, error: (error instanceof Error ? error.message : (error as any)?.message) || 'Failed to create equipment item' }, { status: 500 });
  }
}

// PUT /api/lab-management/lab-days/[id]/equipment
// Update status or notes on an equipment item
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();

  const user = await getAuthenticatedUser(session.user.email);
  if (!user || !hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { item_id, status, notes } = body;

    if (!item_id) {
      return NextResponse.json({ error: 'item_id is required' }, { status: 400 });
    }

    const validStatuses = ['checked_out', 'returned', 'damaged', 'missing'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status) {
      updates.status = status;
      if (status === 'returned') {
        updates.returned_by = user.id;
        updates.returned_at = new Date().toISOString();
      }
    }

    if (typeof notes === 'string') {
      updates.notes = notes.trim() || null;
    }

    const { data, error } = await supabase
      .from('lab_equipment_items')
      .update(updates)
      .eq('id', item_id)
      .eq('lab_day_id', labDayId)
      .select(`
        *,
        station:lab_stations(id, station_number, custom_title, skill_name, station_type)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, item: data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('does not exist')) {
      return NextResponse.json({ success: false, error: 'Equipment tracking is not yet configured. Please run database migrations.' }, { status: 503 });
    }
    console.error('Error updating equipment item:', error);
    return NextResponse.json({ success: false, error: (error instanceof Error ? error.message : (error as any)?.message) || 'Failed to update equipment item' }, { status: 500 });
  }
}

// DELETE /api/lab-management/lab-days/[id]/equipment
// Remove an equipment item by itemId query param
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();

  const user = await getAuthenticatedUser(session.user.email);
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
      .from('lab_equipment_items')
      .delete()
      .eq('id', itemId)
      .eq('lab_day_id', labDayId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('does not exist')) {
      return NextResponse.json({ success: false, error: 'Equipment tracking is not yet configured. Please run database migrations.' }, { status: 503 });
    }
    console.error('Error deleting equipment item:', error);
    return NextResponse.json({ success: false, error: (error instanceof Error ? error.message : (error as any)?.message) || 'Failed to delete equipment item' }, { status: 500 });
  }
}
