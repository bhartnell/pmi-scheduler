import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// Helper to get the current user record from lab_users
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// ---------------------------------------------------------------------------
// GET /api/deep-links
// Returns all active deep link configurations.
// Any authenticated user can call this; admins get all (including inactive).
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const supabase = getSupabaseAdmin();
    const isAdmin = hasMinRole(currentUser.role, 'admin');

    let query = supabase
      .from('deep_link_configs')
      .select('*')
      .order('created_at', { ascending: true });

    // Non-admins only see active configs
    if (!isAdmin) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, configs: data ?? [] });
  } catch (error) {
    console.error('GET /api/deep-links error:', error);
    return NextResponse.json({ error: 'Failed to fetch deep link configs' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/deep-links
// Create a new deep link config. Admin only.
// Body: { route_pattern, app_scheme?, description? }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!hasMinRole(currentUser.role, 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { route_pattern, app_scheme, description, is_active } = body;

    if (!route_pattern || typeof route_pattern !== 'string' || !route_pattern.trim()) {
      return NextResponse.json({ error: 'route_pattern is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('deep_link_configs')
      .insert({
        route_pattern: route_pattern.trim(),
        app_scheme: (app_scheme ?? 'pmi').trim(),
        description: description ?? null,
        is_active: is_active !== false, // default true
      })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, config: data }, { status: 201 });
  } catch (error) {
    console.error('POST /api/deep-links error:', error);
    return NextResponse.json({ error: 'Failed to create deep link config' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/deep-links
// Update a deep link config (toggle is_active, edit fields). Admin only.
// Body: { id, ...fields }
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!hasMinRole(currentUser.role, 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Only allow safe fields to be updated
    const allowedFields: Record<string, unknown> = {};
    if (typeof updates.route_pattern === 'string') allowedFields.route_pattern = updates.route_pattern.trim();
    if (typeof updates.app_scheme === 'string') allowedFields.app_scheme = updates.app_scheme.trim();
    if (typeof updates.description === 'string' || updates.description === null) allowedFields.description = updates.description;
    if (typeof updates.is_active === 'boolean') allowedFields.is_active = updates.is_active;

    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('deep_link_configs')
      .update(allowedFields)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, config: data });
  } catch (error) {
    console.error('PATCH /api/deep-links error:', error);
    return NextResponse.json({ error: 'Failed to update deep link config' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/deep-links
// Delete a deep link config by id. Admin only.
// Body: { id }
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!hasMinRole(currentUser.role, 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('deep_link_configs')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/deep-links error:', error);
    return NextResponse.json({ error: 'Failed to delete deep link config' }, { status: 500 });
  }
}
