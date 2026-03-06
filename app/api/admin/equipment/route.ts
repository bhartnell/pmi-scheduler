import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';

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
// GET /api/admin/equipment
//
// Query params:
//   ?category=  - filter by category (optional)
//
// Returns all equipment with active checkout count and available quantity.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    let query = supabase
      .from('equipment')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    const { data: equipment, error } = await query;
    if (error) throw error;

    // Fetch active (not checked in) checkouts for each item
    const { data: checkouts, error: checkoutError } = await supabase
      .from('equipment_checkouts')
      .select('equipment_id, quantity')
      .is('checked_in_at', null);

    if (checkoutError) throw checkoutError;

    // Map active checkout quantities per equipment item
    const checkedOutMap: Record<string, number> = {};
    for (const checkout of checkouts ?? []) {
      checkedOutMap[checkout.equipment_id] =
        (checkedOutMap[checkout.equipment_id] ?? 0) + checkout.quantity;
    }

    // Attach checkout status to each equipment item
    const enriched = (equipment ?? []).map((item) => ({
      ...item,
      checked_out_quantity: checkedOutMap[item.id] ?? 0,
    }));

    return NextResponse.json({ success: true, equipment: enriched });
  } catch (error) {
    console.error('Error fetching equipment:', error);
    return NextResponse.json({ error: 'Failed to fetch equipment' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/equipment
//
// Body: { name, category, quantity, available_quantity?, description?,
//         serial_number?, location?, condition?, last_serviced?,
//         next_service_due? }
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
      name: string;
      category?: string | null;
      quantity?: number;
      available_quantity?: number;
      description?: string | null;
      location?: string | null;
      condition?: string | null;
      last_maintenance?: string | null;
      next_maintenance?: string | null;
      low_stock_threshold?: number;
    };

    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    const qty = body.quantity ?? 1;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('equipment')
      .insert({
        name: name.trim(),
        category: body.category?.trim() ?? null,
        quantity: qty,
        available_quantity: body.available_quantity ?? qty,
        description: body.description ?? null,
        location: body.location ?? null,
        condition: body.condition ?? 'good',
        last_maintenance: body.last_maintenance ?? null,
        next_maintenance: body.next_maintenance ?? null,
        low_stock_threshold: body.low_stock_threshold ?? 1,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, equipment: data }, { status: 201 });
  } catch (error) {
    console.error('Error creating equipment:', error);
    return NextResponse.json({ error: 'Failed to create equipment' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/equipment
//
// Body: { id, ...fields_to_update }
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json() as { id: string; [key: string]: unknown };
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Only allow updating known columns
    const allowed = [
      'name', 'category', 'quantity', 'available_quantity', 'description',
      'location', 'condition', 'last_maintenance', 'next_maintenance', 'low_stock_threshold',
    ];
    const safeUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in updates) {
        safeUpdates[key] = updates[key];
      }
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('equipment')
      .update(safeUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });

    return NextResponse.json({ success: true, equipment: data });
  } catch (error) {
    console.error('Error updating equipment:', error);
    return NextResponse.json({ error: 'Failed to update equipment' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/equipment
//
// Query param: ?id=<uuid>
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Check for active checkouts before deleting
    const { data: activeCheckouts } = await supabase
      .from('equipment_checkouts')
      .select('id')
      .eq('equipment_id', id)
      .is('checked_in_at', null)
      .limit(1);

    if (activeCheckouts && activeCheckouts.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete equipment with active checkouts. Check in all items first.' },
        { status: 400 }
      );
    }

    const { error } = await supabase.from('equipment').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting equipment:', error);
    return NextResponse.json({ error: 'Failed to delete equipment' }, { status: 500 });
  }
}
