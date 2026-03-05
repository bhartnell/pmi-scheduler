import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import { hasMinRole, type Role } from '@/lib/permissions';

// GET /api/lab-management/checklist-templates
// List all templates, optionally filtered by station_type
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const stationType = request.nextUrl.searchParams.get('station_type');

    let query = supabase
      .from('lab_checklist_templates')
      .select('*')
      .order('station_type', { ascending: true })
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (stationType) {
      query = query.eq('station_type', stationType);
    }

    const { data, error } = await query;

    if (error) {
      if (error.message?.includes('does not exist')) {
        return NextResponse.json({ success: true, templates: [] });
      }
      throw error;
    }

    return NextResponse.json({ success: true, templates: data || [] });
  } catch (error) {
    console.error('Error fetching checklist templates:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch templates' }, { status: 500 });
  }
}

// POST /api/lab-management/checklist-templates
// Create a new template
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('lead_instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { name, station_type, items, is_default = false } = body;

    if (!name || !station_type) {
      return NextResponse.json({ error: 'name and station_type are required' }, { status: 400 });
    }

    // If setting as default, unset existing default for this station_type
    if (is_default) {
      await supabase
        .from('lab_checklist_templates')
        .update({ is_default: false })
        .eq('station_type', station_type)
        .eq('is_default', true);
    }

    const { data, error } = await supabase
      .from('lab_checklist_templates')
      .insert({
        name,
        station_type,
        items: items || [],
        is_default,
        created_by: user.email,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, template: data });
  } catch (error) {
    console.error('Error creating checklist template:', error);
    return NextResponse.json({ success: false, error: 'Failed to create template' }, { status: 500 });
  }
}

// PUT /api/lab-management/checklist-templates
// Update an existing template
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth('lead_instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { id, name, items, is_default } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (items !== undefined) updates.items = items;

    // If setting as default, unset existing default for this station_type
    if (is_default === true) {
      const { data: existing } = await supabase
        .from('lab_checklist_templates')
        .select('station_type')
        .eq('id', id)
        .single();

      if (existing) {
        await supabase
          .from('lab_checklist_templates')
          .update({ is_default: false })
          .eq('station_type', existing.station_type)
          .eq('is_default', true);
      }
      updates.is_default = true;
    } else if (is_default === false) {
      updates.is_default = false;
    }

    const { data, error } = await supabase
      .from('lab_checklist_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, template: data });
  } catch (error) {
    console.error('Error updating checklist template:', error);
    return NextResponse.json({ success: false, error: 'Failed to update template' }, { status: 500 });
  }
}

// DELETE /api/lab-management/checklist-templates
// Delete a template by id query param
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth('lead_instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const id = request.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('lab_checklist_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting checklist template:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete template' }, { status: 500 });
  }
}
