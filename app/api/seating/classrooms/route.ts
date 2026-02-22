import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

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
