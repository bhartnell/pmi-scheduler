import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    if (!hasMinRole(user.role, 'lead_instructor')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const updates: Record<string, unknown> = {};
    if (body.course_code !== undefined) updates.course_code = body.course_code;
    if (body.course_name !== undefined) updates.course_name = body.course_name;
    if (body.duration_type !== undefined) updates.duration_type = body.duration_type;
    if (body.day_index !== undefined) updates.day_index = body.day_index;
    if (body.start_time !== undefined) updates.start_time = body.start_time;
    if (body.end_time !== undefined) updates.end_time = body.end_time;
    if (body.block_type !== undefined) updates.block_type = body.block_type;
    if (body.is_online !== undefined) updates.is_online = body.is_online;
    if (body.color !== undefined) updates.color = body.color || null;
    if (body.notes !== undefined) updates.notes = body.notes || null;
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order;
    if (body.program_type !== undefined) updates.program_type = body.program_type;
    if (body.semester_number !== undefined) updates.semester_number = body.semester_number;
    if (body.default_instructor_id !== undefined) updates.default_instructor_id = body.default_instructor_id || null;
    if (body.default_instructor_name !== undefined) updates.default_instructor_name = body.default_instructor_name || null;
    if (body.default_instructor_ids !== undefined) updates.default_instructor_ids = Array.isArray(body.default_instructor_ids) ? body.default_instructor_ids : [];

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('pmi_course_templates')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ template: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Update course template error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    if (!hasMinRole(user.role, 'lead_instructor')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('pmi_course_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Delete course template error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
