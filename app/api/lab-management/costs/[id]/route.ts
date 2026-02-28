import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

const VALID_CATEGORIES = ['Equipment', 'Consumables', 'Instructor Pay', 'External', 'Other'];

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

// PUT /api/lab-management/costs/[id]
// Update a cost line item
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getAuthenticatedUser(session.user.email);
  if (!user || !hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  try {
    const body = await request.json();
    const { category, description, unit_cost, quantity } = body;

    const updates: Record<string, unknown> = {};

    if (category !== undefined) {
      if (!VALID_CATEGORIES.includes(category)) {
        return NextResponse.json(
          { error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` },
          { status: 400 }
        );
      }
      updates.category = category;
    }

    if (description !== undefined) {
      updates.description = description?.trim() || null;
    }

    if (unit_cost !== undefined) {
      const parsedCost = parseFloat(unit_cost);
      if (isNaN(parsedCost) || parsedCost < 0) {
        return NextResponse.json({ error: 'unit_cost must be a non-negative number' }, { status: 400 });
      }
      updates.unit_cost = parsedCost;
    }

    if (quantity !== undefined) {
      const parsedQty = parseInt(quantity, 10);
      if (isNaN(parsedQty) || parsedQty < 1) {
        return NextResponse.json({ error: 'quantity must be a positive integer' }, { status: 400 });
      }
      updates.quantity = parsedQty;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('lab_day_costs')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Cost item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, item: data });
  } catch (error) {
    console.error('Error updating cost item:', error);
    return NextResponse.json({ success: false, error: 'Failed to update cost item' }, { status: 500 });
  }
}

// DELETE /api/lab-management/costs/[id]
// Remove a cost line item
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getAuthenticatedUser(session.user.email);
  if (!user || !hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  try {
    const { error } = await supabase
      .from('lab_day_costs')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting cost item:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete cost item' }, { status: 500 });
  }
}
