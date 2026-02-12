import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client lazily to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('ce_requirements')
      .select('*')
      .order('display_name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, requirements: data });
  } catch (error) {
    console.error('Error fetching CE requirements:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch CE requirements' }, { status: 500 });
  }
}
