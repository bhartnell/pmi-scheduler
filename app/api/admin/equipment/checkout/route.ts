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
// GET /api/admin/equipment/checkout
//
// Returns all active (not yet checked in) checkout records.
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
    const { data, error } = await supabase
      .from('equipment_checkouts')
      .select('*')
      .is('checked_in_at', null)
      .order('checked_out_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, checkouts: data ?? [] });
  } catch (error) {
    console.error('Error fetching checkouts:', error);
    return NextResponse.json({ error: 'Failed to fetch checkouts' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/equipment/checkout
//
// Check out equipment.
// Body: { equipment_id, quantity, lab_day_id?, notes? }
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
      equipment_id: string;
      quantity: number;
      lab_day_id?: string | null;
      notes?: string | null;
    };

    const { equipment_id, quantity, lab_day_id, notes } = body;

    if (!equipment_id || !quantity) {
      return NextResponse.json(
        { error: 'equipment_id and quantity are required' },
        { status: 400 }
      );
    }

    if (quantity < 1) {
      return NextResponse.json({ error: 'quantity must be at least 1' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Verify the equipment exists and has sufficient available quantity
    const { data: equipment, error: fetchError } = await supabase
      .from('equipment')
      .select('id, name, available_quantity, condition')
      .eq('id', equipment_id)
      .single();

    if (fetchError || !equipment) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
    }

    if (equipment.condition === 'retired') {
      return NextResponse.json(
        { error: 'Cannot check out retired equipment' },
        { status: 400 }
      );
    }

    if (equipment.available_quantity < quantity) {
      return NextResponse.json(
        {
          error: `Insufficient quantity. Available: ${equipment.available_quantity}, requested: ${quantity}`,
        },
        { status: 400 }
      );
    }

    // Create checkout record
    const { data: checkout, error: checkoutError } = await supabase
      .from('equipment_checkouts')
      .insert({
        equipment_id,
        lab_day_id: lab_day_id ?? null,
        checked_out_by: currentUser.email,
        quantity,
        notes: notes ?? null,
      })
      .select()
      .single();

    if (checkoutError) throw checkoutError;

    // Decrement available_quantity
    const { error: updateError } = await supabase
      .from('equipment')
      .update({
        available_quantity: equipment.available_quantity - quantity,
        updated_at: new Date().toISOString(),
      })
      .eq('id', equipment_id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, checkout }, { status: 201 });
  } catch (error) {
    console.error('Error checking out equipment:', error);
    return NextResponse.json({ error: 'Failed to check out equipment' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/admin/equipment/checkout
//
// Check in equipment.
// Body: { checkout_id }
// ---------------------------------------------------------------------------
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json() as { checkout_id: string };
    const { checkout_id } = body;

    if (!checkout_id) {
      return NextResponse.json({ error: 'checkout_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch the checkout record
    const { data: checkout, error: fetchError } = await supabase
      .from('equipment_checkouts')
      .select('id, equipment_id, quantity, checked_in_at')
      .eq('id', checkout_id)
      .single();

    if (fetchError || !checkout) {
      return NextResponse.json({ error: 'Checkout record not found' }, { status: 404 });
    }

    if (checkout.checked_in_at) {
      return NextResponse.json(
        { error: 'Equipment has already been checked in' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Mark the checkout as returned
    const { data: updatedCheckout, error: updateCheckoutError } = await supabase
      .from('equipment_checkouts')
      .update({
        checked_in_at: now,
        checked_in_by: currentUser.email,
      })
      .eq('id', checkout_id)
      .select()
      .single();

    if (updateCheckoutError) throw updateCheckoutError;

    // Restore available_quantity on the equipment record
    const { data: equipment } = await supabase
      .from('equipment')
      .select('available_quantity, quantity')
      .eq('id', checkout.equipment_id)
      .single();

    if (equipment) {
      const restored = Math.min(
        equipment.available_quantity + checkout.quantity,
        equipment.quantity
      );
      await supabase
        .from('equipment')
        .update({ available_quantity: restored, updated_at: now })
        .eq('id', checkout.equipment_id);
    }

    return NextResponse.json({ success: true, checkout: updatedCheckout });
  } catch (error) {
    console.error('Error checking in equipment:', error);
    return NextResponse.json({ error: 'Failed to check in equipment' }, { status: 500 });
  }
}
