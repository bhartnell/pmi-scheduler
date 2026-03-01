import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// ─── Auth helper ─────────────────────────────────────────────────────────────

async function requireRole(minRole: string) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) };
  }
  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', session.user.email)
    .single();

  if (!user || !hasMinRole(user.role, minRole as any)) {
    return { error: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) };
  }
  return { user };
}

// ─── DELETE: Remove a rotation assignment ─────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole('lead_instructor');
    if (auth.error) return auth.error;

    const supabase = getSupabaseAdmin();
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Rotation ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('clinical_rotations')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting rotation:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete rotation' }, { status: 500 });
  }
}

// ─── PATCH: Update a rotation's status/notes ─────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole('lead_instructor');
    if (auth.error) return auth.error;

    const supabase = getSupabaseAdmin();
    const { id } = await params;
    const body = await request.json();

    const allowedFields = ['status', 'notes', 'shift_type'];
    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updatePayload[field] = body[field];
      }
    }

    const { data, error } = await supabase
      .from('clinical_rotations')
      .update(updatePayload)
      .eq('id', id)
      .select('id, student_id, site_id, rotation_date, shift_type, status, notes')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, rotation: data });
  } catch (error) {
    console.error('Error updating rotation:', error);
    return NextResponse.json({ success: false, error: 'Failed to update rotation' }, { status: 500 });
  }
}
