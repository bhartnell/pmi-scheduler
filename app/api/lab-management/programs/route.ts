import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
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
    response.headers.set('Cache-Control', 'private, max-age=86400, stale-while-revalidate=3600');
    return response;
  } catch (error) {
    console.error('Error fetching programs:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch programs' }, { status: 500 });
  }
}
