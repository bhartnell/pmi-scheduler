import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

interface EmailPreferences {
  enabled: boolean;
  mode: 'immediate' | 'daily_digest' | 'off';
  digest_time: string;
  categories: {
    tasks: boolean;
    labs: boolean;
    scheduling: boolean;
    feedback: boolean;
    clinical: boolean;
    system: boolean;
  };
}

const DEFAULT_EMAIL_PREFS: EmailPreferences = {
  enabled: true,
  mode: 'immediate',
  digest_time: '08:00',
  categories: {
    tasks: true,
    labs: true,
    scheduling: true,
    feedback: true,
    clinical: true,
    system: true,
  },
};

// GET - Fetch user's email notification preferences
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const { data } = await supabase
      .from('user_preferences')
      .select('email_preferences')
      .ilike('user_email', session.user.email)
      .single();

    const preferences: EmailPreferences = data?.email_preferences
      ? { ...DEFAULT_EMAIL_PREFS, ...data.email_preferences }
      : DEFAULT_EMAIL_PREFS;

    return NextResponse.json({
      success: true,
      preferences,
      userEmail: session.user.email,
    });
  } catch (error: any) {
    console.error('Error fetching email preferences:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch email preferences' },
      { status: 500 }
    );
  }
}

// PUT - Update user's email notification preferences
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const supabase = getSupabaseAdmin();

    // Validate and build preferences object
    const preferences: EmailPreferences = {
      enabled: typeof body.enabled === 'boolean' ? body.enabled : DEFAULT_EMAIL_PREFS.enabled,
      mode: ['immediate', 'daily_digest', 'off'].includes(body.mode)
        ? body.mode
        : DEFAULT_EMAIL_PREFS.mode,
      digest_time: typeof body.digest_time === 'string' ? body.digest_time : DEFAULT_EMAIL_PREFS.digest_time,
      categories: {
        tasks: typeof body.categories?.tasks === 'boolean' ? body.categories.tasks : true,
        labs: typeof body.categories?.labs === 'boolean' ? body.categories.labs : true,
        scheduling: typeof body.categories?.scheduling === 'boolean' ? body.categories.scheduling : true,
        feedback: typeof body.categories?.feedback === 'boolean' ? body.categories.feedback : true,
        clinical: typeof body.categories?.clinical === 'boolean' ? body.categories.clinical : true,
        system: typeof body.categories?.system === 'boolean' ? body.categories.system : true,
      },
    };

    const { error } = await supabase
      .from('user_preferences')
      .upsert(
        {
          user_email: session.user.email,
          email_preferences: preferences,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_email' }
      );

    if (error) throw error;

    return NextResponse.json({ success: true, preferences });
  } catch (error: any) {
    console.error('Error updating email preferences:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to update email preferences' },
      { status: 500 }
    );
  }
}
