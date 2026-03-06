import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// PUT - Mark notification(s) as read
export async function PUT(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ids, all } = body;

    if (all) {
      // Mark all notifications as read for this user
      const { data, error } = await supabase
        .from('user_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_email', session.user.email)
        .eq('is_read', false)
        .select('id');

      if (error) throw error;

      return NextResponse.json({
        success: true,
        updated: data?.length || 0,
        message: 'All notifications marked as read',
      });
    } else if (ids && Array.isArray(ids) && ids.length > 0) {
      // Bulk mark selected notifications as read
      const { data, error } = await supabase
        .from('user_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in('id', ids)
        .eq('user_email', session.user.email)
        .select('id');

      if (error) throw error;

      return NextResponse.json({
        success: true,
        updated: data?.length || 0,
        message: `${data?.length || 0} notification(s) marked as read`,
      });
    } else if (id) {
      // Mark single notification as read
      const { error } = await supabase
        .from('user_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_email', session.user.email); // Ensure user owns this notification

      if (error) throw error;

      return NextResponse.json({ success: true, updated: 1, message: 'Notification marked as read' });
    } else {
      return NextResponse.json(
        { error: 'Provide id, ids[], or all:true' },
        { status: 400 }
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update notification';
    console.error('Error marking notification as read:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
