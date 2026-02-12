import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

// Create Supabase client lazily to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Helper to get current user with role
async function getCurrentUser(email: string) {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || currentUser.role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Get counts from various tables
    const [usersRes, scenariosRes, studentsRes, labDaysRes, certsRes] = await Promise.all([
      supabase.from('lab_users').select('id', { count: 'exact', head: true }),
      supabase.from('scenarios').select('id', { count: 'exact', head: true }),
      supabase.from('students').select('id', { count: 'exact', head: true }),
      supabase.from('lab_days').select('id', { count: 'exact', head: true }),
      supabase.from('certifications').select('id', { count: 'exact', head: true })
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        users: usersRes.count || 0,
        scenarios: scenariosRes.count || 0,
        students: studentsRes.count || 0,
        labDays: labDaysRes.count || 0,
        certifications: certsRes.count || 0
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch stats' }, { status: 500 });
  }
}
