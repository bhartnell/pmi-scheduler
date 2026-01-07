import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('programs')
      .select('*')
      .order('display_order');

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    return NextResponse.json({ success: true, programs: data || [] });
  } catch (error) {
    console.error('Error fetching programs:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch programs' }, { status: 500 });
  }
}
