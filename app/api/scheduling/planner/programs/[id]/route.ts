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

    if (body.class_days !== undefined) updates.class_days = body.class_days;
    if (body.color !== undefined) updates.color = body.color;
    if (body.label !== undefined) updates.label = body.label;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.is_active !== undefined) updates.is_active = body.is_active;

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('pmi_program_schedules')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        cohort:cohorts!pmi_program_schedules_cohort_id_fkey(
          id, cohort_number, start_date, expected_end_date, is_active, semester,
          program:programs(id, name, abbreviation)
        )
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ program: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Update program schedule error:', err);
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

    // Soft delete
    const { error } = await supabase
      .from('pmi_program_schedules')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Delete program schedule error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
