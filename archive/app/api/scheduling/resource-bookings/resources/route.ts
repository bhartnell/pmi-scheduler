import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// Helper to get current user from lab_users
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// GET - List all bookable resources
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get('type');
    const activeOnly = searchParams.get('active_only') !== 'false';

    let query = supabase
      .from('bookable_resources')
      .select('*')
      .order('name');

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    if (typeFilter) {
      query = query.eq('type', typeFilter);
    }

    const { data: resources, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, resources: resources || [] });
  } catch (error) {
    console.error('Error fetching bookable resources:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch resources' },
      { status: 500 }
    );
  }
}

// POST - Create a new bookable resource (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (!hasMinRole(currentUser.role, 'admin')) {
      return NextResponse.json({ success: false, error: 'Forbidden — admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { name, type, description, location, capacity, requires_approval } = body;

    if (!name || !type) {
      return NextResponse.json(
        { success: false, error: 'name and type are required' },
        { status: 400 }
      );
    }

    const VALID_TYPES = ['room', 'equipment', 'sim_lab', 'other'];
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid resource type' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: resource, error } = await supabase
      .from('bookable_resources')
      .insert({
        name,
        type,
        description: description || null,
        location: location || null,
        capacity: capacity ? Number(capacity) : null,
        requires_approval: requires_approval === true,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, resource });
  } catch (error) {
    console.error('Error creating bookable resource:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create resource' },
      { status: 500 }
    );
  }
}

// PATCH - Update a resource (admin only)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (!hasMinRole(currentUser.role, 'admin')) {
      return NextResponse.json({ success: false, error: 'Forbidden — admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, type, description, location, capacity, requires_approval, is_active } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (type !== undefined) updates.type = type;
    if (description !== undefined) updates.description = description || null;
    if (location !== undefined) updates.location = location || null;
    if (capacity !== undefined) updates.capacity = capacity ? Number(capacity) : null;
    if (requires_approval !== undefined) updates.requires_approval = requires_approval;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data: resource, error } = await supabase
      .from('bookable_resources')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, resource });
  } catch (error) {
    console.error('Error updating bookable resource:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update resource' },
      { status: 500 }
    );
  }
}
