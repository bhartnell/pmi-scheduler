import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// DELETE - Admin: remove an observer (verified to belong to this event)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; observerId: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id, observerId } = await params;
    const supabase = getSupabaseAdmin();

    // Verify the observer belongs to this event
    const { data: observer, error: fetchError } = await supabase
      .from('osce_observers')
      .select('id')
      .eq('id', observerId)
      .eq('event_id', id)
      .single();

    if (fetchError || !observer) {
      return NextResponse.json(
        { success: false, error: 'Observer not found for this event' },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from('osce_observers')
      .delete()
      .eq('id', observerId)
      .eq('event_id', id);

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
