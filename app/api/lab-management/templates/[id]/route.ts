import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/lab-management/templates/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('lab_day_templates')
      .select('id, name, description, template_data, is_shared, created_by, created_at, updated_at')
      .eq('id', id)
      .or(`created_by.eq.${session.user.email},is_shared.eq.true`)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, template: data });
  } catch (error) {
    console.error('Error fetching template:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch template' }, { status: 500 });
  }
}

// PUT /api/lab-management/templates/[id]
// Owner-only update
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();

    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from('lab_day_templates')
      .select('id, created_by')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }
      throw fetchError;
    }

    if (existing.created_by !== session.user.email) {
      return NextResponse.json({ error: 'Forbidden - you can only edit your own templates' }, { status: 403 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.name !== undefined) {
      if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
        return NextResponse.json({ error: 'Template name cannot be empty' }, { status: 400 });
      }
      updates.name = body.name.trim();
    }

    if (body.description !== undefined) {
      updates.description = body.description?.trim() || null;
    }

    if (body.template_data !== undefined) {
      if (!body.template_data || typeof body.template_data !== 'object') {
        return NextResponse.json({ error: 'Invalid template data' }, { status: 400 });
      }
      updates.template_data = body.template_data;
    }

    if (body.is_shared !== undefined) {
      updates.is_shared = Boolean(body.is_shared);
    }

    const { data, error } = await supabase
      .from('lab_day_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, template: data });
  } catch (error) {
    console.error('Error updating template:', error);
    return NextResponse.json({ success: false, error: 'Failed to update template' }, { status: 500 });
  }
}

// DELETE /api/lab-management/templates/[id]
// Owner-only delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();

    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from('lab_day_templates')
      .select('id, created_by')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }
      throw fetchError;
    }

    if (existing.created_by !== session.user.email) {
      return NextResponse.json({ error: 'Forbidden - you can only delete your own templates' }, { status: 403 });
    }

    const { error } = await supabase
      .from('lab_day_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete template' }, { status: 500 });
  }
}
