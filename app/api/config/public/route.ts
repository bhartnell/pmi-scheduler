import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// Only these categories are safe to expose without authentication
const PUBLIC_CATEGORIES = ['branding', 'legal', 'features'];

/**
 * GET /api/config/public
 * Returns public-safe configs (branding, legal, feature flags).
 * No auth required — used by the frontend for branding and feature flags.
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('system_config')
      .select('config_key, config_value, category')
      .in('category', PUBLIC_CATEGORIES)
      .order('config_key');

    if (error) throw error;

    // Return as a flat key -> value map for easy consumption
    const result: Record<string, unknown> = {};
    for (const row of data ?? []) {
      result[row.config_key] = row.config_value;
    }

    return NextResponse.json({ success: true, config: result });
  } catch (error) {
    console.error('Error fetching public config:', error);
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}
