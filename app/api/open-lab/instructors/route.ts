import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const { data: instructors, error } = await supabase
      .from('lab_users')
      .select('id, name, email, is_open_lab_instructor')
      .eq('is_open_lab_instructor', true)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching open lab instructors:', error);
      return NextResponse.json({ error: 'Failed to fetch instructors' }, { status: 500 });
    }

    return NextResponse.json({ instructors: instructors || [] });
  } catch (err) {
    console.error('Open lab instructors error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
