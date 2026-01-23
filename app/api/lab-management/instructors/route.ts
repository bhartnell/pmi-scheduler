import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch users with instructor role or higher (instructor, lead_instructor, admin)
    const { data, error } = await supabase
      .from('lab_users')
      .select('id, name, email, role')
      .in('role', ['instructor', 'lead_instructor', 'admin'])
      .eq('is_active', true)
      .order('name');

    if (error) throw error;

    return NextResponse.json({ success: true, instructors: data });
  } catch (error) {
    console.error('Error fetching instructors:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch instructors' }, { status: 500 });
  }
}
