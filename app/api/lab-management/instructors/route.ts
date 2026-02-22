import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch users with instructor role or higher
    // Include all roles that can grade/teach at stations
    const { data, error } = await supabase
      .from('lab_users')
      .select('id, name, email, role, is_active')
      .in('role', ['instructor', 'lead_instructor', 'admin', 'superadmin'])
      .order('name');

    if (error) throw error;

    return NextResponse.json({ success: true, instructors: data });
  } catch (error) {
    console.error('Error fetching instructors:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch instructors' }, { status: 500 });
  }
}
