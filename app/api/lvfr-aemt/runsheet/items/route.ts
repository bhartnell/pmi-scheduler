import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/lvfr-aemt/runsheet/items
 *
 * Add an ad-hoc item to a runsheet session. Used by the "+ Add item"
 * button on the day runsheet — instructor decides mid-day to slot in
 * an extra skill review or quiz, this is the path.
 *
 * Body: {
 *   day_schedule_id: uuid,
 *   title: string,
 *   item_type?: 'chapter' | 'quiz' | 'skills' | 'lab' | 'break' | 'exam' | 'other',
 *   estimated_minutes?: number,
 *   notes?: string,
 * }
 */

const ITEM_TYPES = new Set(['chapter', 'quiz', 'skills', 'lab', 'break', 'exam', 'other']);

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let body: {
    day_schedule_id?: string;
    title?: string;
    item_type?: string;
    estimated_minutes?: number;
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid body' }, { status: 400 });
  }

  if (!body.day_schedule_id) {
    return NextResponse.json({ success: false, error: 'day_schedule_id required' }, { status: 400 });
  }
  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ success: false, error: 'title required' }, { status: 400 });
  }
  const itemType = body.item_type && ITEM_TYPES.has(body.item_type) ? body.item_type : 'other';
  const estMin = typeof body.estimated_minutes === 'number' && body.estimated_minutes >= 0
    ? Math.round(body.estimated_minutes)
    : null;
  // H2 — a manually-added item is intentional, so it gets a checkbox (counts
  // toward "required") UNLESS it's a break, which stays info-only.
  const requirement: 'required' | 'info' = itemType === 'break' ? 'info' : 'required';

  const supabase = getSupabaseAdmin();

  // Place new ad-hoc items at the bottom of the session — sort_order
  // = (max existing) + 10. Buffer of 10 leaves room for drag-reorder
  // moves later without renumbering the whole list.
  const { data: existing } = await supabase
    .from('lvfr_schedule_items')
    .select('sort_order')
    .eq('day_schedule_id', body.day_schedule_id)
    .order('sort_order', { ascending: false })
    .limit(1);
  const nextSort = (existing?.[0]?.sort_order ?? 0) + 10;

  const { data: inserted, error } = await supabase
    .from('lvfr_schedule_items')
    .insert({
      day_schedule_id: body.day_schedule_id,
      title,
      item_type: itemType,
      requirement,
      estimated_minutes: estMin,
      notes: body.notes?.trim() || null,
      sort_order: nextSort,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, id: inserted?.id });
}
