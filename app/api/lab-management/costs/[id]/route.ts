import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// Same Title Case ↔ snake_case mapping as the parent route. The DB
// CHECK constraint only allows snake_case; the UI uses Title Case.
// See app/api/lab-management/costs/route.ts for the full rationale.
const DISPLAY_TO_DB: Record<string, string> = {
  'Equipment': 'equipment',
  'Consumables': 'consumables',
  'Instructor Pay': 'instructor_pay',
  'External': 'external',
  'Other': 'other',
};
const VALID_CATEGORY_INPUTS = new Set<string>([
  ...Object.keys(DISPLAY_TO_DB),
  ...Object.values(DISPLAY_TO_DB),
]);
const DB_TO_DISPLAY: Record<string, string> = Object.fromEntries(
  Object.entries(DISPLAY_TO_DB).map(([k, v]) => [v, k]),
);
const VALID_CATEGORIES = Object.keys(DISPLAY_TO_DB);

type RouteContext = { params: Promise<{ id: string }> };

// PUT /api/lab-management/costs/[id]
// Update a cost line item
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user } = auth;

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  try {
    const body = await request.json();
    const { category, description, amount } = body;

    const updates: Record<string, unknown> = {};

    if (category !== undefined) {
      if (!VALID_CATEGORY_INPUTS.has(category)) {
        return NextResponse.json(
          { error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` },
          { status: 400 }
        );
      }
      // Normalize to snake_case for the DB CHECK constraint.
      updates.category = (category in DB_TO_DISPLAY) ? category : DISPLAY_TO_DB[category];
    }

    if (description !== undefined) {
      if (!description?.trim()) {
        return NextResponse.json({ error: 'description cannot be empty' }, { status: 400 });
      }
      updates.description = description.trim();
    }

    if (amount !== undefined) {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount < 0) {
        return NextResponse.json({ error: 'amount must be a non-negative number' }, { status: 400 });
      }
      updates.amount = parsedAmount;
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

    return NextResponse.json({
      success: true,
      item: { ...data, category: DB_TO_DISPLAY[data.category as string] ?? data.category },
    });
  } catch (error) {
    console.error('Error updating cost item:', error);
    return NextResponse.json({ success: false, error: 'Failed to update cost item' }, { status: 500 });
  }
}

// DELETE /api/lab-management/costs/[id]
// Remove a cost line item
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user } = auth;

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
