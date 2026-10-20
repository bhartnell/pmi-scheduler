import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { removeObserverFromBlocks } from '@/lib/osce-invites';

// DELETE - Admin: remove an observer
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // Remove the guest from their calendar events before the signup rows go.
    await removeObserverFromBlocks(supabase, { observerId: id });

    const { error } = await supabase
      .from('osce_observers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting observer:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete observer' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting observer:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
