import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase';

// Default notification category preferences by role
const ROLE_DEFAULTS: Record<string, Record<string, boolean>> = {
  superadmin: {
    tasks: true,
    labs: true,
    scheduling: true,
    feedback: true,
    clinical: true,
    system: true,
  },
  admin: {
    tasks: true,
    labs: true,
    scheduling: true,
    feedback: true,
    clinical: true,
    system: true,
  },
  lead_instructor: {
    tasks: true,
    labs: true,
    scheduling: true,
    feedback: false,
    clinical: true,
    system: true,
  },
  instructor: {
    tasks: true,
    labs: true,
    scheduling: true,
    feedback: false,
    clinical: false,
    system: true,
  },
  guest: {
    tasks: false,
    labs: true,
    scheduling: false,
    feedback: false,
    clinical: false,
    system: true,
  },
};

export interface NotificationCategoryPreferences {
  tasks: boolean;
  labs: boolean;
  scheduling: boolean;
  feedback: boolean;
  clinical: boolean;
  system: boolean;
}

// GET - Fetch user's notification category preferences
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Get user role for defaults
    const { data: user } = await supabase
      .from('lab_users')
      .select('role')
      .eq('email', session.user.email)
      .single();

    const role = user?.role || 'instructor';
    const defaults = ROLE_DEFAULTS[role] || ROLE_DEFAULTS.instructor;

    // Get user preferences
    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('notification_settings')
      .eq('user_email', session.user.email)
      .single();

    // Extract category preferences from notification_settings
    const notificationSettings = prefs?.notification_settings || {};
    const categoryPrefs = notificationSettings.category_preferences || null;

    // If user has set preferences, use them; otherwise use role defaults
    const categories: NotificationCategoryPreferences = categoryPrefs || defaults;

    const response = NextResponse.json({
      success: true,
      preferences: {
        categories,
        // Include other notification settings for reference
        email_lab_assignments: notificationSettings.email_lab_assignments ?? true,
        email_lab_reminders: notificationSettings.email_lab_reminders ?? true,
        email_feedback_updates: notificationSettings.email_feedback_updates ?? false,
        show_desktop_notifications: notificationSettings.show_desktop_notifications ?? false,
      },
      isDefault: !categoryPrefs,
      role,
    });
    response.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=60');
    return response;
  } catch (error: any) {
    console.error('Error fetching notification preferences:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch preferences' },
      { status: 500 }
    );
  }
}

// PUT - Update user's notification category preferences
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const supabase = getSupabaseAdmin();

    // Get current notification settings
    const { data: currentPrefs } = await supabase
      .from('user_preferences')
      .select('notification_settings')
      .eq('user_email', session.user.email)
      .single();

    const currentSettings = currentPrefs?.notification_settings || {};

    // Merge category preferences
    const updatedSettings = {
      ...currentSettings,
    };

    // Support both legacy shape (body.categories) and new unified shape (body.category_preferences)
    const inAppCategories = body.category_preferences || body.categories;
    if (inAppCategories) {
      updatedSettings.category_preferences = {
        tasks: inAppCategories.tasks ?? true,
        labs: inAppCategories.labs ?? true,
        scheduling: inAppCategories.scheduling ?? true,
        feedback: inAppCategories.feedback ?? true,
        clinical: inAppCategories.clinical ?? true,
        system: inAppCategories.system ?? true,
      };
    }

    // Update other settings if provided
    if (body.email_lab_assignments !== undefined) {
      updatedSettings.email_lab_assignments = body.email_lab_assignments;
    }
    if (body.email_lab_reminders !== undefined) {
      updatedSettings.email_lab_reminders = body.email_lab_reminders;
    }
    if (body.email_feedback_updates !== undefined) {
      updatedSettings.email_feedback_updates = body.email_feedback_updates;
    }
    if (body.show_desktop_notifications !== undefined) {
      updatedSettings.show_desktop_notifications = body.show_desktop_notifications;
    }

    // Upsert preferences
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert({
        user_email: session.user.email,
        notification_settings: updatedSettings,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_email',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      preferences: {
        categories: updatedSettings.category_preferences,
        email_lab_assignments: updatedSettings.email_lab_assignments,
        email_lab_reminders: updatedSettings.email_lab_reminders,
        email_feedback_updates: updatedSettings.email_feedback_updates,
        show_desktop_notifications: updatedSettings.show_desktop_notifications,
      },
    });
  } catch (error: any) {
    console.error('Error updating notification preferences:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to update preferences' },
      { status: 500 }
    );
  }
}

// DELETE - Reset to role-based defaults
export async function DELETE() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Get current notification settings
    const { data: currentPrefs } = await supabase
      .from('user_preferences')
      .select('notification_settings')
      .eq('user_email', session.user.email)
      .single();

    if (currentPrefs) {
      const currentSettings = currentPrefs.notification_settings || {};
      // Remove category_preferences to reset to defaults
      delete currentSettings.category_preferences;

      await supabase
        .from('user_preferences')
        .update({
          notification_settings: currentSettings,
          updated_at: new Date().toISOString(),
        })
        .eq('user_email', session.user.email);
    }

    return NextResponse.json({
      success: true,
      message: 'Notification preferences reset to defaults',
    });
  } catch (error: any) {
    console.error('Error resetting notification preferences:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to reset preferences' },
      { status: 500 }
    );
  }
}
