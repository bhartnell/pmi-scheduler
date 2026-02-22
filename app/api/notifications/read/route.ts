import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
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
    const { id, all } = body;

    if (all) {
      // Mark all notifications as read for this user
      const { error } = await supabase
        .from('user_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_email', session.user.email)
        .eq('is_read', false);

      if (error) throw error;

      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    } else if (id) {
      // Mark single notification as read
      const { error } = await supabase
        .from('user_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_email', session.user.email); // Ensure user owns this notification

      if (error) throw error;

      return NextResponse.json({ success: true, message: 'Notification marked as read' });
    } else {
      return NextResponse.json(
        { error: 'Either id or all:true is required' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error marking notification as read:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to update notification' },
      { status: 500 }
    );
  }
}
