import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('classrooms')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;

    return NextResponse.json({ success: true, classrooms: data });
  } catch (error) {
    console.error('Error fetching classrooms:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch classrooms' }, { status: 500 });
  }
}
