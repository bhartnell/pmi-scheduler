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
    const { notification_ids, all, action } = body;

    const isArchiving = action !== 'unarchive';

    if (all) {
      // Archive/unarchive ALL notifications for this user
      let query = supabase
        .from('user_notifications')
        .update({ is_archived: isArchiving })
        .eq('user_email', session.user.email);

      // When archiving all, only target non-archived; when unarchiving, only target archived
      if (isArchiving) {
        query = query.eq('is_archived', false);
      } else {
        query = query.eq('is_archived', true);
      }

      const { data, error } = await query.select('id');

      if (error) throw error;

      return NextResponse.json({
        success: true,
        updated: data?.length || 0,
        action: isArchiving ? 'archived' : 'unarchived',
      });
    }

    if (!notification_ids || !Array.isArray(notification_ids) || notification_ids.length === 0) {
      return NextResponse.json(
        { error: 'notification_ids array or all:true is required' },
        { status: 400 }
      );
    }

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
