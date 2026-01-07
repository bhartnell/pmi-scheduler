// app/api/lab-management/programs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('programs')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;

    return NextResponse.json({ success: true, programs: data });
  } catch (error) {
    console.error('Error fetching programs:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch programs' }, { status: 500 });
  }
}
