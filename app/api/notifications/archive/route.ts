import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// PUT - Archive or unarchive notifications
export async function PUT(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { notification_ids, action } = body;

    if (!notification_ids || !Array.isArray(notification_ids) || notification_ids.length === 0) {
      return NextResponse.json(
        { error: 'notification_ids array is required' },
        { status: 400 }
      );
    }

    const isArchiving = action !== 'unarchive';

    const { data, error } = await supabase
      .from('user_notifications')
      .update({ is_archived: isArchiving })
      .in('id', notification_ids)
      .eq('user_email', session.user.email) // Ensure user owns these notifications
      .select('id');

    if (error) throw error;

    return NextResponse.json({
      success: true,
      updated: data?.length || 0,
      action: isArchiving ? 'archived' : 'unarchived',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to archive notifications';
    console.error('Error archiving notifications:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
