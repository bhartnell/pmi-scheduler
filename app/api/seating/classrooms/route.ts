import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

export async function GET() {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user } = auth;

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
