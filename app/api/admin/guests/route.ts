import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { canManageGuestAccess } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

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
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canManageGuestAccess(currentUser.role)) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('guest_access')
      .select(`
        *,
        lab_day:lab_days(
          id,
          date,
          cohort:cohorts(
            cohort_number,
            program:programs(abbreviation)
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, guests: data });
  } catch (error) {
    console.error('Error fetching guests:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch guests' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canManageGuestAccess(currentUser.role)) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, access_code, lab_day_id, assigned_role, expires_at } = body;

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }

    // Check if access code already exists
    if (access_code) {
      const { data: existing } = await supabase
        .from('guest_access')
        .select('id')
        .eq('access_code', access_code)
        .single();

      if (existing) {
        return NextResponse.json({ success: false, error: 'Access code already exists' }, { status: 400 });
      }
    }

    const { data, error } = await supabase
      .from('guest_access')
      .insert({
        name: name.trim(),
        email: email?.trim() || null,
        access_code: access_code || null,
        lab_day_id: lab_day_id || null,
        assigned_role: assigned_role || null,
        expires_at: expires_at || null,
        created_by: currentUser.id
      })
      .select(`
        *,
        lab_day:lab_days(
          id,
          date,
          cohort:cohorts(
            cohort_number,
            program:programs(abbreviation)
          )
        )
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, guest: data });
  } catch (error) {
    console.error('Error creating guest:', error);
    return NextResponse.json({ success: false, error: 'Failed to create guest' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canManageGuestAccess(currentUser.role)) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, email, lab_day_id, assigned_role, expires_at } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Guest ID is required' }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name.trim();
    if (email !== undefined) updates.email = email?.trim() || null;
    if (lab_day_id !== undefined) updates.lab_day_id = lab_day_id || null;
    if (assigned_role !== undefined) updates.assigned_role = assigned_role || null;
    if (expires_at !== undefined) updates.expires_at = expires_at || null;

    const { data, error } = await supabase
      .from('guest_access')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        lab_day:lab_days(
          id,
          date,
          cohort:cohorts(
            cohort_number,
            program:programs(abbreviation)
          )
        )
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, guest: data });
  } catch (error) {
    console.error('Error updating guest:', error);
    return NextResponse.json({ success: false, error: 'Failed to update guest' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canManageGuestAccess(currentUser.role)) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Guest ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('guest_access')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting guest:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete guest' }, { status: 500 });
  }
}
