import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * PATCH /api/lvfr-aemt/runsheet/items/[id]
 *
 * Update a runsheet item. Common cases:
 *   - { is_completed: true }  → checkoff (sets completed_at + completed_by to caller)
 *   - { is_completed: false } → un-check (clears completed_at + completed_by)
 *   - { title, estimated_minutes, item_type, notes } → edit
 *
 * Returns the updated row so the optimistic UI can reconcile.
 *
 * DELETE /api/lvfr-aemt/runsheet/items/[id]
 *
 * Remove an item entirely. Both seeded and ad-hoc items can be
 * deleted — re-seeding from blocks will re-create deleted seeded
 * items, which is intentional (delete is "remove from today's
 * runsheet", not "ban this block").
 */

const ITEM_TYPES = new Set(['chapter', 'quiz', 'skills', 'lab', 'break', 'exam', 'other']);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
  }

  let body: {
    is_completed?: boolean;
    title?: string;
    item_type?: string;
    estimated_minutes?: number | null;
    notes?: string | null;
    sort_order?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid body' }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.is_completed === 'boolean') {
    update.is_completed = body.is_completed;
    if (body.is_completed) {
      update.completed_at = new Date().toISOString();
      update.completed_by = user.id;
    } else {
      update.completed_at = null;
      update.completed_by = null;
    }
  }
  if (typeof body.title === 'string') {
    const t = body.title.trim();
    if (!t) {
      return NextResponse.json({ success: false, error: 'title cannot be empty' }, { status: 400 });
    }
    update.title = t;
  }
  if (typeof body.item_type === 'string') {
    if (!ITEM_TYPES.has(body.item_type)) {
      return NextResponse.json({ success: false, error: `invalid item_type "${body.item_type}"` }, { status: 400 });
    }
    update.item_type = body.item_type;
  }
  if (body.estimated_minutes === null || typeof body.estimated_minutes === 'number') {
    update.estimated_minutes = body.estimated_minutes;
  }
  if (body.notes === null || typeof body.notes === 'string') {
    update.notes = body.notes;
  }
  if (typeof body.sort_order === 'number') {
    update.sort_order = body.sort_order;
  }

  const supabase = getSupabaseAdmin();
  const { data: updated, error } = await supabase
    .from('lvfr_schedule_items')
    .update(update)
    .eq('id', id)
    .select('id, title, item_type, estimated_minutes, sort_order, is_completed, completed_at, completed_by, notes')
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Hydrate the actor name for the optimistic-update consumer.
  let completedByName: string | null = null;
  if (updated?.completed_by) {
    const { data: u } = await supabase
      .from('lab_users')
      .select('name')
      .eq('id', updated.completed_by)
      .single();
    completedByName = u?.name ?? null;
  }

  return NextResponse.json({
    success: true,
    item: { ...updated, completed_by_name: completedByName },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('lvfr_schedule_items').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
