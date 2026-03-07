import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

export async function GET() {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user } = auth;

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('programs')
      .select('id, name, display_name, abbreviation, is_active')
      .order('name');

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    const response = NextResponse.json({ success: true, programs: data || [] });
    response.headers.set('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1200');
    return response;
  } catch (error) {
    console.error('Error fetching programs:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch programs' }, { status: 500 });
  }
}
