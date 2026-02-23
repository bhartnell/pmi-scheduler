import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canCreateLabDays } from '@/lib/permissions';

// GET /api/lab-management/templates
// Returns all templates owned by the current user plus all shared templates
export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('lab_day_templates')
      .select('id, name, description, template_data, is_shared, created_by, created_at, updated_at')
      .or(`created_by.eq.${session.user.email},is_shared.eq.true`)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, templates: data || [] });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch templates' }, { status: 500 });
  }
}

// POST /api/lab-management/templates
// Creates a new lab day template
export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch user role for permission check
  try {
    const supabase = getSupabaseAdmin();

    const { data: userRecord } = await supabase
      .from('users')
      .select('role')
      .eq('email', session.user.email)
      .single();

    if (!userRecord || !canCreateLabDays(userRecord.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, template_data, is_shared } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
    }

    if (!template_data || typeof template_data !== 'object') {
      return NextResponse.json({ error: 'Template data is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('lab_day_templates')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        template_data,
        is_shared: Boolean(is_shared),
        created_by: session.user.email,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, template: data }, { status: 201 });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json({ success: false, error: 'Failed to create template' }, { status: 500 });
  }
}
