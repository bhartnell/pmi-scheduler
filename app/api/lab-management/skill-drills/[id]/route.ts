import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// GET /api/lab-management/skill-drills/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('skill_drills')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Skill drill not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, drill: data });
  } catch (error) {
    console.error('Error fetching skill drill:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch skill drill' }, { status: 500 });
  }
}

// PUT /api/lab-management/skill-drills/[id]
// Update a skill drill (owner or admin)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  // Check role
  const { data: requestingUser } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', session.user.email)
    .single();

  const userRole = requestingUser?.role || 'guest';
  if (!hasMinRole(userRole, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden: instructor role required' }, { status: 403 });
  }

  try {
    // Fetch existing drill to check ownership
    const { data: existing, error: fetchError } = await supabase
      .from('skill_drills')
      .select('created_by')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Skill drill not found' }, { status: 404 });
      }
      throw fetchError;
    }

    // Only owner or admin+ can update
    const isOwner = existing.created_by === session.user.email;
    const isAdmin = hasMinRole(userRole, 'admin');
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden: you can only edit your own drills' }, { status: 403 });
    }

    const body = await request.json();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.category !== undefined) updateData.category = body.category.trim();
    if (body.estimated_duration !== undefined) updateData.estimated_duration = parseInt(body.estimated_duration);
    if (body.equipment_needed !== undefined) {
      updateData.equipment_needed = Array.isArray(body.equipment_needed)
        ? body.equipment_needed.filter((e: string) => e.trim())
        : [];
    }
    if (body.instructions !== undefined) updateData.instructions = body.instructions?.trim() || null;
    if (body.is_active !== undefined) updateData.is_active = Boolean(body.is_active);

    const { data, error } = await supabase
      .from('skill_drills')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, drill: data });
  } catch (error) {
    console.error('Error updating skill drill:', error);
    return NextResponse.json({ success: false, error: 'Failed to update skill drill' }, { status: 500 });
  }
}

// DELETE /api/lab-management/skill-drills/[id]
// Soft delete: set is_active = false (owner or admin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  // Check role
  const { data: requestingUser } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', session.user.email)
    .single();

  const userRole = requestingUser?.role || 'guest';
  if (!hasMinRole(userRole, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden: instructor role required' }, { status: 403 });
  }

  try {
    // Fetch existing drill to check ownership
    const { data: existing, error: fetchError } = await supabase
      .from('skill_drills')
      .select('created_by, name')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Skill drill not found' }, { status: 404 });
      }
      throw fetchError;
    }

    // Only owner or admin+ can delete
    const isOwner = existing.created_by === session.user.email;
    const isAdmin = hasMinRole(userRole, 'admin');

    // System drills (created_by = 'system') can only be deleted by admin+
    if (existing.created_by === 'system' && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden: system drills can only be deleted by admins' }, { status: 403 });
    }

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden: you can only delete your own drills' }, { status: 403 });
    }

    // Soft delete
    const { error } = await supabase
      .from('skill_drills')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: `"${existing.name}" has been deactivated` });
  } catch (error) {
    console.error('Error deleting skill drill:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete skill drill' }, { status: 500 });
  }
}
