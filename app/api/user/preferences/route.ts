import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase';

// Role-based default configurations
const ROLE_DEFAULTS: Record<string, { widgets: string[]; quickLinks: string[] }> = {
  superadmin: {
    widgets: ['notifications', 'my_labs', 'quick_links', 'needs_attention', 'overview_stats', 'recent_feedback'],
    quickLinks: ['scenarios', 'students', 'schedule', 'emt_tracker', 'clinical', 'feedback', 'admin'],
  },
  admin: {
    widgets: ['notifications', 'my_labs', 'quick_links', 'needs_attention', 'overview_stats', 'recent_feedback'],
    quickLinks: ['scenarios', 'students', 'schedule', 'emt_tracker', 'clinical', 'feedback', 'admin'],
  },
  lead_instructor: {
    widgets: ['notifications', 'my_labs', 'quick_links', 'open_stations', 'overview_stats'],
    quickLinks: ['scenarios', 'students', 'schedule', 'emt_tracker', 'clinical'],
  },
  instructor: {
    widgets: ['notifications', 'my_labs', 'quick_links', 'open_stations'],
    quickLinks: ['scenarios', 'students', 'schedule', 'my_certs'],
  },
  guest: {
    widgets: ['notifications', 'quick_links'],
    quickLinks: ['scenarios', 'students'],
  },
};

// GET - Fetch user preferences
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user preferences
    const { data: preferences, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_email', session.user.email)
      .single();

    // If no preferences exist, return role-based defaults
    if (error || !preferences) {
      // Get user role
      const { data: user } = await supabase
        .from('lab_users')
        .select('role')
        .eq('email', session.user.email)
        .single();

      const role = user?.role || 'instructor';
      const defaults = ROLE_DEFAULTS[role] || ROLE_DEFAULTS.instructor;

      return NextResponse.json({
        success: true,
        preferences: {
          dashboard_widgets: defaults.widgets,
          quick_links: defaults.quickLinks,
          notification_settings: {
            email_lab_assignments: true,
            email_lab_reminders: true,
            email_feedback_updates: false,
            show_desktop_notifications: false,
          },
        },
        isDefault: true,
        role,
      });
    }

    return NextResponse.json({
      success: true,
      preferences: {
        dashboard_widgets: preferences.dashboard_widgets || [],
        quick_links: preferences.quick_links || [],
        notification_settings: preferences.notification_settings || {},
      },
      isDefault: false,
    });
  } catch (error: any) {
    console.error('Error fetching preferences:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch preferences' },
      { status: 500 }
    );
  }
}

// PUT - Update user preferences
export async function PUT(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Build update data
    const updateData: any = {
      user_email: session.user.email,
      updated_at: new Date().toISOString(),
    };

    if (body.dashboard_widgets !== undefined) {
      updateData.dashboard_widgets = body.dashboard_widgets;
    }

    if (body.quick_links !== undefined) {
      updateData.quick_links = body.quick_links;
    }

    if (body.notification_settings !== undefined) {
      updateData.notification_settings = body.notification_settings;
    }

    // Upsert preferences
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert(updateData, {
        onConflict: 'user_email',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      preferences: data,
    });
  } catch (error: any) {
    console.error('Error updating preferences:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to update preferences' },
      { status: 500 }
    );
  }
}

// DELETE - Reset preferences to defaults
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete user preferences (they'll get defaults on next fetch)
    const { error } = await supabase
      .from('user_preferences')
      .delete()
      .eq('user_email', session.user.email);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Preferences reset to defaults',
    });
  } catch (error: any) {
    console.error('Error resetting preferences:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to reset preferences' },
      { status: 500 }
    );
  }
}
