import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('ce_requirements')
      .select('id, display_name, total_hours_required, cycle_years, category_requirements, is_active')
      .order('display_name', { ascending: true });

    if (error) throw error;

    const response = NextResponse.json({ success: true, requirements: data });
    response.headers.set('Cache-Control', 'private, max-age=86400, stale-while-revalidate=3600');
    return response;
  } catch (error) {
    console.error('Error fetching CE requirements:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch CE requirements' }, { status: 500 });
  }
}
