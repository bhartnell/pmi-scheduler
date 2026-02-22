import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { isDirector } from '@/lib/endorsements';
import { getSupabaseAdmin } from '@/lib/supabase';

// Helper to get current user
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// GET - Fetch all pending signups (directors only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Check if user is a director or admin
    const userIsDirector = await isDirector(currentUser.id);
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'superadmin';

    if (!userIsDirector && !isAdmin) {
      return NextResponse.json({ success: false, error: 'Only directors can view pending signups' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch all pending signups with shift and instructor details
    const { data: signups, error } = await supabase
      .from('shift_signups')
      .select(`
        *,
        shift:shift_id(id, title, date, start_time, end_time, department, location),
        instructor:instructor_id(id, name, email)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Process the data to handle Supabase FK returns
    const processedSignups = (signups || []).map(signup => ({
      ...signup,
      shift: Array.isArray(signup.shift) ? signup.shift[0] : signup.shift,
      instructor: Array.isArray(signup.instructor) ? signup.instructor[0] : signup.instructor
    }));

    return NextResponse.json({ success: true, signups: processedSignups });
  } catch (error) {
    console.error('Error fetching pending signups:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch pending signups' }, { status: 500 });
  }
}
