import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Default email preferences — enabled out of the box, users opt-out via settings
const DEFAULT_EMAIL_PREFS = {
  enabled: true,
  mode: 'immediate' as const, // 'immediate' | 'daily_digest' | 'off'
  digest_time: '08:00',
  categories: {
    tasks: true,
    labs: true,
    scheduling: true,
    feedback: true,
    clinical: true,
    system: true
  }
};

// GET - Get current user's email preferences
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabase();

    // Get preferences by user_email (the unique key in user_preferences table)
    const { data: prefs, error } = await supabase
      .from('user_preferences')
      .select('email_preferences')
      .ilike('user_email', session.user.email)
      .single();

    // If no row found, that's fine — return defaults
    if (error && error.code !== 'PGRST116') {
      // PGRST116 = "no rows returned" - not a real error
      console.error('Error querying preferences:', error);
    }

    const emailPrefs = prefs?.email_preferences || DEFAULT_EMAIL_PREFS;

    return NextResponse.json({
      success: true,
      preferences: emailPrefs,
      userEmail: session.user.email
    });
  } catch (error) {
    console.error('Error fetching email preferences:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch preferences' }, { status: 500 });
  }
}

// PUT - Update email preferences
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { enabled, mode, digest_time, categories } = body;

    const supabase = getSupabase();

    // Build the new preferences object
    const newPrefs = {
      enabled: enabled ?? DEFAULT_EMAIL_PREFS.enabled,
      mode: mode ?? DEFAULT_EMAIL_PREFS.mode,
      digest_time: digest_time ?? DEFAULT_EMAIL_PREFS.digest_time,
      categories: {
        tasks: categories?.tasks ?? DEFAULT_EMAIL_PREFS.categories.tasks,
        labs: categories?.labs ?? DEFAULT_EMAIL_PREFS.categories.labs,
        scheduling: categories?.scheduling ?? DEFAULT_EMAIL_PREFS.categories.scheduling,
        feedback: categories?.feedback ?? DEFAULT_EMAIL_PREFS.categories.feedback,
        clinical: categories?.clinical ?? DEFAULT_EMAIL_PREFS.categories.clinical,
        system: categories?.system ?? DEFAULT_EMAIL_PREFS.categories.system
      }
    };

    // Validate mode
    if (!['immediate', 'daily_digest', 'off'].includes(newPrefs.mode)) {
      return NextResponse.json({ success: false, error: 'Invalid mode' }, { status: 400 });
    }

    // Validate digest_time format (HH:MM)
    if (!/^\d{2}:\d{2}$/.test(newPrefs.digest_time)) {
      return NextResponse.json({ success: false, error: 'Invalid digest_time format' }, { status: 400 });
    }

    // Upsert preferences using user_email (the unique key in user_preferences table)
    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_email: session.user.email,
        email_preferences: newPrefs,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_email'
      });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      preferences: newPrefs
    });
  } catch (error) {
    console.error('Error updating email preferences:', error);
    return NextResponse.json({ success: false, error: 'Failed to update preferences' }, { status: 500 });
  }
}
