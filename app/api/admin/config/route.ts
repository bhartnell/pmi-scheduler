import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';

const VALID_CATEGORIES = ['email', 'notifications', 'security', 'features', 'branding', 'legal'] as const;

async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

/**
 * GET /api/admin/config
 * Returns all system configs. Optionally filter by ?category=
 * Requires admin+ role.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    let query = supabase
      .from('system_config')
      .select('*')
      .order('category')
      .order('config_key');

    if (category && VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, configs: data ?? [] });
  } catch (error) {
    console.error('Error fetching system configs:', error);
    return NextResponse.json({ error: 'Failed to fetch configs' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/config
 * Update a config value.
 * Body: { config_key: string, config_value: unknown }
 * Requires admin+ role.
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json() as { config_key?: string; config_value?: unknown };
    const { config_key, config_value } = body;

    if (!config_key) {
      return NextResponse.json({ error: 'config_key is required' }, { status: 400 });
    }

    if (config_value === undefined) {
      return NextResponse.json({ error: 'config_value is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Verify the key exists
    const { data: existing, error: fetchError } = await supabase
      .from('system_config')
      .select('id, config_key')
      .eq('config_key', config_key)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Config key not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('system_config')
      .update({
        config_value,
        updated_by: currentUser.email,
        updated_at: new Date().toISOString(),
      })
      .eq('config_key', config_key)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, config: data });
  } catch (error) {
    console.error('Error updating system config:', error);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
