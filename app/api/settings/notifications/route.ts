import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// ---- Types ----

export interface GranularCategoryPrefs {
  in_app: boolean;
  email: boolean;
}

export interface GranularNotificationSettings {
  categories: {
    labs: GranularCategoryPrefs;
    tasks: GranularCategoryPrefs;
    clinical: GranularCategoryPrefs;
    system: GranularCategoryPrefs;
    scheduling: GranularCategoryPrefs;
    feedback: GranularCategoryPrefs;
  };
  quiet_hours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  weekly_digest: boolean;
  mute_all: boolean;
}

// ---- Defaults ----

const DEFAULT_GRANULAR: GranularNotificationSettings = {
  categories: {
    labs:       { in_app: true,  email: true  },
    tasks:      { in_app: true,  email: false },
    clinical:   { in_app: true,  email: true  },
    system:     { in_app: true,  email: false },
    scheduling: { in_app: true,  email: true  },
    feedback:   { in_app: true,  email: false },
  },
  quiet_hours: {
    enabled: false,
    start:   '22:00',
    end:     '07:00',
  },
  weekly_digest: false,
  mute_all:      false,
};

// ---- Helpers ----

function mergeCategoryPrefs(
  saved: Partial<GranularNotificationSettings['categories']>,
): GranularNotificationSettings['categories'] {
  const cats = DEFAULT_GRANULAR.categories;
  const result: GranularNotificationSettings['categories'] = { ...cats };
  for (const key of Object.keys(cats) as Array<keyof typeof cats>) {
    if (saved[key] && typeof saved[key] === 'object') {
      result[key] = {
        in_app: typeof saved[key]!.in_app === 'boolean' ? saved[key]!.in_app : cats[key].in_app,
        email:  typeof saved[key]!.email  === 'boolean' ? saved[key]!.email  : cats[key].email,
      };
    }
  }
  return result;
}

function buildFromStored(raw: Record<string, unknown> | null): GranularNotificationSettings {
  if (!raw) return DEFAULT_GRANULAR;

  const saved = raw as Partial<GranularNotificationSettings>;

  const categories = saved.categories
    ? mergeCategoryPrefs(saved.categories as Partial<GranularNotificationSettings['categories']>)
    : DEFAULT_GRANULAR.categories;

  const qh = saved.quiet_hours && typeof saved.quiet_hours === 'object'
    ? {
        enabled: typeof saved.quiet_hours.enabled === 'boolean' ? saved.quiet_hours.enabled : false,
        start:   typeof saved.quiet_hours.start   === 'string'  ? saved.quiet_hours.start   : '22:00',
        end:     typeof saved.quiet_hours.end     === 'string'  ? saved.quiet_hours.end     : '07:00',
      }
    : DEFAULT_GRANULAR.quiet_hours;

  return {
    categories,
    quiet_hours:    qh,
    weekly_digest:  typeof saved.weekly_digest === 'boolean' ? saved.weekly_digest : false,
    mute_all:       typeof saved.mute_all      === 'boolean' ? saved.mute_all      : false,
  };
}

// ---- GET ----

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const { data } = await supabase
      .from('user_preferences')
      .select('notification_settings')
      .eq('user_email', session.user.email)
      .single();

    const stored = data?.notification_settings?.granular_prefs ?? null;
    const preferences = buildFromStored(stored);

    return NextResponse.json({ success: true, preferences });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch notification preferences';
    console.error('Error fetching granular notification preferences:', error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ---- PUT ----

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as Partial<GranularNotificationSettings>;
    const supabase = getSupabaseAdmin();

    // Validate and normalise the incoming payload
    const categories = body.categories
      ? mergeCategoryPrefs(body.categories as Partial<GranularNotificationSettings['categories']>)
      : DEFAULT_GRANULAR.categories;

    const quiet_hours = body.quiet_hours && typeof body.quiet_hours === 'object'
      ? {
          enabled: typeof body.quiet_hours.enabled === 'boolean' ? body.quiet_hours.enabled : false,
          start:   typeof body.quiet_hours.start   === 'string'  ? body.quiet_hours.start   : '22:00',
          end:     typeof body.quiet_hours.end     === 'string'  ? body.quiet_hours.end     : '07:00',
        }
      : DEFAULT_GRANULAR.quiet_hours;

    const preferences: GranularNotificationSettings = {
      categories,
      quiet_hours,
      weekly_digest: typeof body.weekly_digest === 'boolean' ? body.weekly_digest : false,
      mute_all:      typeof body.mute_all      === 'boolean' ? body.mute_all      : false,
    };

    // Fetch existing notification_settings so we don't overwrite other keys
    const { data: existing } = await supabase
      .from('user_preferences')
      .select('notification_settings')
      .eq('user_email', session.user.email)
      .single();

    const currentSettings: Record<string, unknown> = existing?.notification_settings ?? {};

    const { error } = await supabase
      .from('user_preferences')
      .upsert(
        {
          user_email:           session.user.email,
          notification_settings: { ...currentSettings, granular_prefs: preferences },
          updated_at:           new Date().toISOString(),
        },
        { onConflict: 'user_email' },
      );

    if (error) throw error;

    return NextResponse.json({ success: true, preferences });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update notification preferences';
    console.error('Error updating granular notification preferences:', error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
