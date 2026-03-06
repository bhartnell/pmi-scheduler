import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

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
