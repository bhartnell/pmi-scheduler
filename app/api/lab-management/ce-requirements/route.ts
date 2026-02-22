import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

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
