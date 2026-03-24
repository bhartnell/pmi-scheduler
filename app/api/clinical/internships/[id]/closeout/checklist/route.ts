import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { requireAuth } from '@/lib/api-auth';

// Default closeout checklist items for Paramedic program
const DEFAULT_ITEMS = [
  { item_name: 'Final Affective Evaluation', display_order: 1 },
  { item_name: 'Final Skills Checkoff (Psychomotor)', display_order: 2 },
  { item_name: 'Preceptor Final Evaluation', display_order: 3 },
  { item_name: 'Student Course Evaluation', display_order: 4 },
  { item_name: 'Clinical Coordinator Sign-off', display_order: 5 },
  { item_name: 'Program Director Sign-off', display_order: 6 },
];

// Seed default items for an internship if none exist
async function ensureDefaultItems(internshipId: string) {
  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from('internship_closeout_items')
    .select('id')
    .eq('internship_id', internshipId)
    .limit(1);

  if (existing && existing.length > 0) return;

  const rows = DEFAULT_ITEMS.map(item => ({
    internship_id: internshipId,
    item_name: item.item_name,
    display_order: item.display_order,
    is_checked: false,
  }));

  await supabase.from('internship_closeout_items').insert(rows);
}

// GET - Fetch closeout checklist items for an internship
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    // Seed defaults if needed
    await ensureDefaultItems(id);

    const supabase = getSupabaseAdmin();
    const { data: items, error } = await supabase
      .from('internship_closeout_items')
      .select('id, internship_id, item_name, display_order, is_checked, checked_by, checked_at')
      .eq('internship_id', id)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching closeout checklist:', error.message);
      return NextResponse.json({ success: false, error: 'Failed to fetch checklist' }, { status: 500 });
    }

    // Resolve checked_by user names
    const checkedByIds = (items || [])
      .filter(i => i.checked_by)
      .map(i => i.checked_by as string);

    let userMap: Record<string, string> = {};
    if (checkedByIds.length > 0) {
      const { data: users } = await supabase
        .from('lab_users')
        .select('id, name, email')
        .in('id', checkedByIds);

      if (users) {
        for (const u of users) {
          userMap[u.id] = u.name || u.email || u.id;
        }
      }
    }

    const enrichedItems = (items || []).map(item => ({
      ...item,
      checked_by_name: item.checked_by ? (userMap[item.checked_by] || null) : null,
    }));

    const checkedCount = enrichedItems.filter(i => i.is_checked).length;

    return NextResponse.json({
      success: true,
      items: enrichedItems,
      checked_count: checkedCount,
      total_count: enrichedItems.length,
    });
  } catch (error) {
    console.error('Error in closeout checklist GET:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch checklist' }, { status: 500 });
  }
}

// PUT - Toggle a checklist item checked/unchecked
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const { id } = await params;
    const body = await request.json();
    const { item_id, is_checked } = body;

    if (!item_id) {
      return NextResponse.json({ success: false, error: 'item_id is required' }, { status: 400 });
    }

    if (typeof is_checked !== 'boolean') {
      return NextResponse.json({ success: false, error: 'is_checked must be a boolean' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Verify item belongs to this internship
    const { data: existing } = await supabase
      .from('internship_closeout_items')
      .select('id')
      .eq('id', item_id)
      .eq('internship_id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Checklist item not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      is_checked,
      checked_by: is_checked ? user.id : null,
      checked_at: is_checked ? new Date().toISOString() : null,
    };

    const { data: updated, error } = await supabase
      .from('internship_closeout_items')
      .update(updateData)
      .eq('id', item_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating closeout item:', error.message);
      return NextResponse.json({ success: false, error: 'Failed to update item' }, { status: 500 });
    }

    return NextResponse.json({ success: true, item: updated });
  } catch (error) {
    console.error('Error in closeout checklist PUT:', error);
    return NextResponse.json({ success: false, error: 'Failed to update item' }, { status: 500 });
  }
}
