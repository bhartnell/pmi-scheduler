import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - Fetch notifications for current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const unreadOnly = searchParams.get('unread') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build query
    let query = supabase
      .from('user_notifications')
      .select('*')
      .eq('user_email', session.user.email)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data: notifications, error } = await query;

    if (error) throw error;

    // Get unread count
    const { count: unreadCount } = await supabase
      .from('user_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_email', session.user.email)
      .eq('is_read', false);

    return NextResponse.json({
      success: true,
      notifications: notifications || [],
      unreadCount: unreadCount || 0,
    });
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

// POST - Create a new notification (admin/system only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin/superadmin for manual notification creation
    const { data: user } = await supabase
      .from('lab_users')
      .select('role')
      .eq('email', session.user.email)
      .single();

    // Allow system triggers (internal calls) or admins
    const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
    const isSystemCall = request.headers.get('x-system-call') === 'true';

    if (!isAdmin && !isSystemCall) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.user_email || !body.title || !body.message) {
      return NextResponse.json(
        { error: 'user_email, title, and message are required' },
        { status: 400 }
      );
    }

    const notificationData = {
      user_email: body.user_email,
      title: body.title,
      message: body.message,
      type: body.type || 'general',
      link_url: body.link_url || null,
      reference_type: body.reference_type || null,
      reference_id: body.reference_id || null,
    };

    const { data, error } = await supabase
      .from('user_notifications')
      .insert(notificationData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, notification: data });
  } catch (error: any) {
    console.error('Error creating notification:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to create notification' },
      { status: 500 }
    );
  }
}
