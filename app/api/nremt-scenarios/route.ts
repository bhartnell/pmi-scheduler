import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  try {
    const skillCode = request.nextUrl.searchParams.get('skill_code');
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('nremt_scenarios')
      .select('id, skill_code, title, scenario_data, is_active, created_at')
      .eq('is_active', true)
      .order('title', { ascending: true });

    if (skillCode) {
      query = query.eq('skill_code', skillCode);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching NREMT scenarios:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch scenarios' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, scenarios: data || [] });
  } catch (error) {
    console.error('Error in GET /api/nremt-scenarios:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
