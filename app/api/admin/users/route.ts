import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  canAccessAdmin,
  canModifyUser,
  canDeleteUsers,
  isProtectedSuperadmin,
  type Role
} from '@/lib/permissions';
import { notifyRoleApproved } from '@/lib/notifications';

// Create Supabase client lazily to avoid build-time errors
// Helper to get current user with role
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const role = searchParams.get('role');
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    const supabase = getSupabaseAdmin();
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
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { email, name, role = 'instructor' } = body;

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('lab_users')
      .select('*')
      .ilike('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json({ success: false, error: 'User already exists' }, { status: 400 });
    }

    // Create new user
    const { data: newUser, error } = await supabase
      .from('lab_users')
      .insert({
        name: name || email.split('@')[0],
        email: email.toLowerCase(),
        role,
        is_active: true,
        approved_at: new Date().toISOString(),
        approved_by: currentUser.id
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, user: newUser });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ success: false, error: 'Failed to create user' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, role, is_active } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Get target user
    const { data: targetUser } = await supabase
      .from('lab_users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Check permissions
    if (!canModifyUser(currentUser.role as Role, targetUser.role as Role)) {
      return NextResponse.json({ success: false, error: 'Cannot modify users at or above your role level' }, { status: 403 });
    }

    // Protect superadmin accounts
    if (isProtectedSuperadmin(targetUser.email)) {
      if (role && role !== 'superadmin') {
        return NextResponse.json({ success: false, error: 'Protected superadmin accounts cannot be demoted' }, { status: 403 });
      }
      if (is_active === false) {
        return NextResponse.json({ success: false, error: 'Protected superadmin accounts cannot be deactivated' }, { status: 403 });
      }
    }

    const updates: Record<string, any> = {};

    // Track if this is a role upgrade from pending
    const isUpgradeFromPending = targetUser.role === 'pending' && role && role !== 'pending';

    if (role !== undefined) {
      updates.role = role;
      // Set approval info when assigning a real role
      if (role !== 'pending' && !targetUser.approved_at) {
        updates.approved_at = new Date().toISOString();
        updates.approved_by = currentUser.id;
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

    // Notify user when their role is upgraded from pending
    if (isUpgradeFromPending && data) {
      // Fire and forget - don't block the response
      notifyRoleApproved(data.email, {
        userId: data.id,
        newRole: data.role,
        approverName: currentUser.name || currentUser.email,
      }).catch(err => console.error('Failed to send role approval notification:', err));
    }

    return NextResponse.json({ success: true, user: data });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canDeleteUsers(currentUser.role)) {
      return NextResponse.json({ success: false, error: 'Superadmin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Get target user
    const { data: targetUser } = await supabase
      .from('lab_users')
      .select('email')
      .eq('id', userId)
      .single();

    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Protect superadmin accounts
    if (isProtectedSuperadmin(targetUser.email)) {
      return NextResponse.json({ success: false, error: 'Protected superadmin accounts cannot be deleted' }, { status: 403 });
    }

    const { error } = await supabase
      .from('lab_users')
      .delete()
      .eq('id', userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete user' }, { status: 500 });
  }
}
