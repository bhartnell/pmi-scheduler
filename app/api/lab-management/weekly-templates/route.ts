import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// GET /api/lab-management/weekly-templates
// List weekly templates, optionally filtered by program_id, semester, week_number
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { searchParams } = request.nextUrl;
    const programId = searchParams.get('program_id');
    const semester = searchParams.get('semester');
    const weekNumber = searchParams.get('week_number');

    let query = supabase
      .from('lab_week_templates')
      .select(`
        *,
        program:programs(id, name, abbreviation)
      `)
      .order('updated_at', { ascending: false });

    if (programId) {
      query = query.eq('program_id', programId);
    }
    if (semester) {
      query = query.eq('semester', semester);
    }
    if (weekNumber) {
      query = query.eq('week_number', parseInt(weekNumber, 10));
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
    console.error('Error fetching weekly templates:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch weekly templates' }, { status: 500 });
  }
}

// POST /api/lab-management/weekly-templates
// Create a new weekly template
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('lead_instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { name, description, program_id, semester, week_number, num_days, days, is_default } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
    }

    if (!days || !Array.isArray(days)) {
      return NextResponse.json({ error: 'days array is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('lab_week_templates')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        program_id: program_id || null,
        semester: semester || null,
        week_number: week_number != null ? parseInt(String(week_number), 10) : null,
        num_days: num_days || days.length || 5,
        days,
        is_default: Boolean(is_default),
        created_by: user.email,
      })
      .select(`
        *,
        program:programs(id, name, abbreviation)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, template: data }, { status: 201 });
  } catch (error) {
    console.error('Error creating weekly template:', error);
    return NextResponse.json({ success: false, error: 'Failed to create weekly template' }, { status: 500 });
  }
}

// PUT /api/lab-management/weekly-templates
// Update an existing weekly template
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth('lead_instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { id, name, description, program_id, semester, week_number, num_days, days, is_default } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (program_id !== undefined) updates.program_id = program_id || null;
    if (semester !== undefined) updates.semester = semester || null;
    if (week_number !== undefined) updates.week_number = week_number != null ? parseInt(String(week_number), 10) : null;
    if (num_days !== undefined) updates.num_days = num_days;
    if (days !== undefined) updates.days = days;
    if (is_default !== undefined) updates.is_default = Boolean(is_default);

    const { data, error } = await supabase
      .from('lab_week_templates')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        program:programs(id, name, abbreviation)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, template: data });
  } catch (error) {
    console.error('Error updating weekly template:', error);
    return NextResponse.json({ success: false, error: 'Failed to update weekly template' }, { status: 500 });
  }
}

// DELETE /api/lab-management/weekly-templates
// Delete a weekly template by id query param
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
      .from('lab_week_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting weekly template:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete weekly template' }, { status: 500 });
  }
}
