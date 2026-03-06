import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const supabase = getSupabaseAdmin();

    // Check if user owns this record or is admin
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      const { data: record } = await supabase
        .from('ce_records')
        .select('instructor_id')
        .eq('id', id)
        .single();

      if (record?.instructor_id !== user.id) {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
      }
    }

    const { error } = await supabase
      .from('ce_records')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting CE record:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete CE record' }, { status: 500 });
  }
}
