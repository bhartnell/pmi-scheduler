import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase';

// Default category preferences by role (same as preferences API)
const ROLE_DEFAULTS: Record<string, Record<string, boolean>> = {
  superadmin: { tasks: true, labs: true, scheduling: true, feedback: true, clinical: true, system: true },
  admin: { tasks: true, labs: true, scheduling: true, feedback: true, clinical: true, system: true },
  lead_instructor: { tasks: true, labs: true, scheduling: true, feedback: false, clinical: true, system: true },
  instructor: { tasks: true, labs: true, scheduling: true, feedback: false, clinical: false, system: true },
  guest: { tasks: false, labs: true, scheduling: false, feedback: false, clinical: false, system: true },
};

// GET - Fetch notifications for current user
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const unreadOnly = searchParams.get('unread') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const categoryFilter = searchParams.get('category'); // Optional category filter
    const applyPrefs = searchParams.get('applyPrefs') !== 'false'; // Default true

    // Get user role and preferences
    const { data: user } = await supabase
      .from('lab_users')
      .select('role')
      .eq('email', session.user.email)
      .single();

    const role = user?.role || 'instructor';

    // Get user's notification preferences
    let enabledCategories: string[] = [];
    if (applyPrefs) {
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('notification_settings')
        .eq('user_email', session.user.email)
        .single();

      const categoryPrefs = prefs?.notification_settings?.category_preferences || ROLE_DEFAULTS[role] || ROLE_DEFAULTS.instructor;

      // Build list of enabled categories
      enabledCategories = Object.entries(categoryPrefs)
        .filter(([_, enabled]) => enabled)
        .map(([cat]) => cat);
    }

    // Build query
    let query = supabase
      .from('user_notifications')
      .select('id, type, title, message, link_url, is_read, created_at, reference_type, reference_id, category', { count: 'exact' })
      .eq('user_email', session.user.email)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    // Apply category filter if specified
    if (categoryFilter) {
      query = query.eq('category', categoryFilter);
    } else if (applyPrefs && enabledCategories.length > 0 && enabledCategories.length < 6) {
      // Only filter if user has disabled some categories
      query = query.in('category', enabledCategories);
    }

    const { data: notifications, error, count: totalCount } = await query;

    if (error) throw error;

    // Get unread count (also respecting category filters)
    let countQuery = supabase
      .from('user_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_email', session.user.email)
      .eq('is_read', false);

    if (applyPrefs && enabledCategories.length > 0 && enabledCategories.length < 6) {
      countQuery = countQuery.in('category', enabledCategories);
    }

    const { count: unreadCount } = await countQuery;

    return NextResponse.json({
      success: true,
      notifications: notifications || [],
      unreadCount: unreadCount || 0,
      enabledCategories: applyPrefs ? enabledCategories : undefined,
      pagination: { limit, offset, total: totalCount || 0 },
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
    const supabase = getSupabaseAdmin();

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

    // Map type to category if not provided
    const TYPE_TO_CATEGORY: Record<string, string> = {
      task_assigned: 'tasks', task_completed: 'tasks', task_comment: 'tasks',
      lab_assignment: 'labs', lab_reminder: 'labs',
      shift_available: 'scheduling', shift_confirmed: 'scheduling',
      feedback_new: 'feedback', feedback_resolved: 'feedback',
      clinical_hours: 'clinical', compliance_due: 'clinical',
      role_approved: 'system', general: 'system',
    };

    const notificationType = body.type || 'general';
    const notificationCategory = body.category || TYPE_TO_CATEGORY[notificationType] || 'system';

    const notificationData = {
      user_email: body.user_email,
      title: body.title,
      message: body.message,
      type: notificationType,
      category: notificationCategory,
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

// DELETE - Delete notifications for current user
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (body.all) {
      // Delete all notifications for this user
      const { data, error } = await supabase
        .from('user_notifications')
        .delete()
        .eq('user_email', session.user.email)
        .select('id');

      if (error) throw error;

      return NextResponse.json({
        success: true,
        deleted: data?.length || 0,
        message: `${data?.length || 0} notification(s) cleared`
      });
    }

    // Delete specific notification by id
    if (body.id) {
      const { error } = await supabase
        .from('user_notifications')
        .delete()
        .eq('id', body.id)
        .eq('user_email', session.user.email);

      if (error) throw error;

      return NextResponse.json({ success: true, deleted: 1 });
    }

    return NextResponse.json({ error: 'Provide "all: true" or "id"' }, { status: 400 });
  } catch (error: any) {
    console.error('Error deleting notifications:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to delete notifications' },
      { status: 500 }
    );
  }
}
