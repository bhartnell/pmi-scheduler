import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import { hasMinRole } from '@/lib/permissions';

type RouteContext = { params: Promise<{ id: string; noteId: string }> };

const VALID_CATEGORIES = [
  'general', 'timing', 'station_feedback', 'student_performance',
  'equipment', 'improvement', 'positive',
];

// ---------------------------------------------------------------------------
// PUT /api/lab-management/lab-days/[id]/debrief-notes/[noteId]
// Edit own note only
// ---------------------------------------------------------------------------
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const { id: labDayId, noteId } = await params;
  const supabase = getSupabaseAdmin();

  try {
    // Look up the user's lab_users id
    const { data: labUser } = await supabase
      .from('lab_users')
      .select('id')
      .ilike('email', user.email)
      .maybeSingle();

    // Fetch the note
    const { data: existing } = await supabase
      .from('lab_day_debrief_notes')
      .select('id, author_id')
      .eq('id', noteId)
      .eq('lab_day_id', labDayId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Ownership check
    if (!labUser || existing.author_id !== labUser.id) {
      return NextResponse.json(
        { error: 'Forbidden: you can only edit your own notes' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { content, category } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'content is required and must be non-empty' },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {
      content: content.trim(),
      updated_at: new Date().toISOString(),
    };

    if (category && VALID_CATEGORIES.includes(category)) {
      updates.category = category;
    }

    const { data, error } = await supabase
      .from('lab_day_debrief_notes')
      .update(updates)
      .eq('id', noteId)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, note: data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('does not exist')) {
      return NextResponse.json(
        { success: false, error: 'Debrief notes feature is not yet configured.' },
        { status: 503 }
      );
    }
    console.error('Error updating debrief note:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update debrief note' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/lab-management/lab-days/[id]/debrief-notes/[noteId]
// Delete own note, or admin can delete any
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const { id: labDayId, noteId } = await params;
  const supabase = getSupabaseAdmin();

  try {
    // Look up the user's lab_users id
    const { data: labUser } = await supabase
      .from('lab_users')
      .select('id')
      .ilike('email', user.email)
      .maybeSingle();

    // Fetch the note
    const { data: existing } = await supabase
      .from('lab_day_debrief_notes')
      .select('id, author_id')
      .eq('id', noteId)
      .eq('lab_day_id', labDayId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Ownership or admin check
    const isOwner = labUser && existing.author_id === labUser.id;
    const isAdmin = hasMinRole(user.role, 'admin');

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: you can only delete your own notes' },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from('lab_day_debrief_notes')
      .delete()
      .eq('id', noteId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('does not exist')) {
      return NextResponse.json(
        { success: false, error: 'Debrief notes feature is not yet configured.' },
        { status: 503 }
      );
    }
    console.error('Error deleting debrief note:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete debrief note' },
      { status: 500 }
    );
  }
}
