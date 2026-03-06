import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  canModifyUser,
  canAssignRole,
  isProtectedSuperadmin,
  type Role
} from '@/lib/permissions';
import { notifyRoleApproved } from '@/lib/notifications';
import { logAuditEvent } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const searchParams = request.nextUrl.searchParams;
    const role = searchParams.get('role');
    const activeOnly = searchParams.get('activeOnly') !== 'false';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('lab_users')
      .select('id, name, email, role, photo_url, created_at, last_login, is_active, is_part_time', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (role) {
      query = query.eq('role', role);
    }

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    // One-time audit: log users with admin role when superadmin views list
    if (user.role === 'superadmin' && data) {
      const adminUsers = data.filter((u: any) => u.role === 'admin');
      if (adminUsers.length > 0) {
        console.log('[Admin Audit] Current admin-role users:', adminUsers.map((u: any) => u.email));
      }
    }

    return NextResponse.json({ success: true, users: data, pagination: { limit, offset, total: count || 0 } });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const body = await request.json();
    const { email, name, role = 'pending' } = body;

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
        approved_by: user.id
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
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const body = await request.json();
    const { userId, role, is_active, is_part_time } = body;

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
    if (!canModifyUser(user.role as Role, targetUser.role as Role)) {
      return NextResponse.json({ success: false, error: 'Cannot modify users at or above your role level' }, { status: 403 });
    }

    // Protect superadmin accounts — only the account holder can modify their own protected status
    if (isProtectedSuperadmin(targetUser.email)) {
      if (user.email.toLowerCase() !== targetUser.email.toLowerCase()) {
        return NextResponse.json({ success: false, error: 'Protected superadmin accounts can only be modified by the account holder' }, { status: 403 });
      }
    }

    const updates: Record<string, any> = {};

    // Track if this is a role upgrade from pending
    const isUpgradeFromPending = targetUser.role === 'pending' && role && role !== 'pending';

    if (role !== undefined) {
      // Validate the requesting user can assign this specific role
      if (!canAssignRole(user.role as Role, role as Role)) {
        return NextResponse.json(
          { success: false, error: 'Insufficient permissions to assign this role' },
          { status: 403 }
        );
      }
      updates.role = role;
      // Set approval info when assigning a real role
      if (role !== 'pending' && !targetUser.approved_at) {
        updates.approved_at = new Date().toISOString();
        updates.approved_by = user.id;
      }
    }

    if (is_active !== undefined) {
      updates.is_active = is_active;
    }

    if (is_part_time !== undefined) {
      updates.is_part_time = is_part_time;
    }

    const { data, error } = await supabase
      .from('lab_users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    // Audit log role changes
    if (role !== undefined && role !== targetUser.role) {
      logAuditEvent({
        user: { id: user.id, email: user.email, role: user.role },
        action: 'update',
        resourceType: 'user',
        resourceId: userId,
        resourceDescription: `Role change for ${targetUser.email}`,
        metadata: { oldRole: targetUser.role, newRole: role, changedBy: user.email },
      }).catch(() => {}); // fire and forget
    }

    // Notify user when their role is upgraded from pending
    if (isUpgradeFromPending && data) {
      // Fire and forget - don't block the response
      notifyRoleApproved(data.email, {
        userId: data.id,
        newRole: data.role,
        approverName: user.name || user.email,
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
    const auth = await requireAuth('superadmin');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

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
