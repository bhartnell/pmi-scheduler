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

// Helper to check if requester is admin
async function isRequesterAdmin(email: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', email)
    .single();
  return data?.role === 'admin';
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const role = searchParams.get('role');
  const activeOnly = searchParams.get('activeOnly') !== 'false';

  try {
    const supabase = getSupabase();
    let query = supabase
      .from('lab_users')
      .select('*')
      .order('created_at', { ascending: false });

    if (role) {
      query = query.eq('role', role);
    }

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, users: data });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();

    const body = await request.json();
    const { email, name } = body;

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
    }

    // Check if user already exists (case-insensitive)
    const { data: existingUser } = await supabase
      .from('lab_users')
      .select('*')
      .ilike('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json({ success: true, user: existingUser, created: false });
    }

    // Create new user with pending role
    const { data: newUser, error } = await supabase
      .from('lab_users')
      .insert({
        name: name || email.split('@')[0],
        email: email.toLowerCase(),
        role: 'pending',
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, user: newUser, created: true });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ success: false, error: 'Failed to create user' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabase();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Check if requester is admin
    const isAdmin = await isRequesterAdmin(session.user.email);
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, role, is_active } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    // Get the admin's lab_users ID for approved_by
    const { data: adminUser } = await supabase
      .from('lab_users')
      .select('id')
      .ilike('email', session.user.email)
      .single();

    const updates: Record<string, any> = {};

    if (role !== undefined) {
      updates.role = role;
      // If changing from pending to another role, set approved_at and approved_by
      if (role !== 'pending') {
        updates.approved_at = new Date().toISOString();
        updates.approved_by = adminUser?.id || null;
      }
    }

    if (is_active !== undefined) {
      updates.is_active = is_active;
    }

    const { data, error } = await supabase
      .from('lab_users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, user: data });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 });
  }
}
