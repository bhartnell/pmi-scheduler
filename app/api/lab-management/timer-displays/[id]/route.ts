import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
// PATCH - Update token (activate/deactivate)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (typeof body.is_active === 'boolean') {
      updates.is_active = body.is_active;
    }
    if (typeof body.room_name === 'string') {
      updates.room_name = body.room_name.trim();
    }

    const { data, error } = await getSupabaseAdmin()
      .from('timer_display_tokens')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, token: data });
  } catch (error) {
    console.error('Error updating timer display token:', error);
    return NextResponse.json({ success: false, error: 'Failed to update token' }, { status: 500 });
  }
}

// DELETE - Remove token
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await getSupabaseAdmin()
      .from('timer_display_tokens')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting timer display token:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete token' }, { status: 500 });
  }
}
