import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * PATCH /api/lab-management/smc-admin/[id]
 *   — update any SMC requirement field. skill_id can be set to null to
 *     mark as "no catalog match" (custom/program-specific skill).
 *
 * DELETE /api/lab-management/smc-admin/[id]
 *   — soft delete via is_active=false. Coverage view only looks at
 *     is_active=true rows so the skill falls out of tracking.
 *     Hard delete path accepts ?hard=true for cleanup.
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('lead_instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { id } = await params;
    const body = await request.json();

    // Allowlist the writable fields so clients can't mass-assign
    // created_at / program_id / etc.
    const patch: Record<string, any> = {};
    if ('skill_id' in body) patch.skill_id = body.skill_id || null;
    if ('skill_name' in body) patch.skill_name = String(body.skill_name).trim();
    if ('category' in body) patch.category = body.category || null;
    if ('min_attempts' in body)
      patch.min_attempts = parseInt(String(body.min_attempts), 10) || 1;
    if ('is_platinum' in body) patch.is_platinum = !!body.is_platinum;
    if ('sim_permitted' in body) patch.sim_permitted = !!body.sim_permitted;
    if ('lab_tracked' in body) patch.lab_tracked = !!body.lab_tracked;
    if ('week_number' in body) {
      // Accept null/empty to clear, integer otherwise
      const w = body.week_number;
      patch.week_number =
        w === null || w === '' || w === undefined
          ? null
          : parseInt(String(w), 10) || null;
    }
    if ('notes' in body) patch.notes = body.notes || null;
    if ('is_active' in body) patch.is_active = !!body.is_active;
    if ('display_order' in body)
      patch.display_order = parseInt(String(body.display_order), 10) || 0;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No writable fields in request' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('smc_requirements')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if ((error as any).code === '23505') {
        return NextResponse.json(
          { success: false, error: 'Duplicate — a row with that program/semester/name already exists' },
          { status: 409 }
        );
      }
      console.error('[smc-admin/:id] update error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update SMC requirement' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'SMC requirement not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, row: data });
  } catch (e) {
    console.error('[smc-admin/:id] PATCH error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('lead_instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { id } = await params;
    const hardDelete = request.nextUrl.searchParams.get('hard') === 'true';

    if (hardDelete) {
      const { error } = await supabase
        .from('smc_requirements')
        .delete()
        .eq('id', id);
      if (error) {
        console.error('[smc-admin/:id] hard delete error:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to delete' },
          { status: 500 }
        );
      }
    } else {
      // Soft delete (default) — preserves historical coverage references
      const { error } = await supabase
        .from('smc_requirements')
        .update({ is_active: false })
        .eq('id', id);
      if (error) {
        console.error('[smc-admin/:id] soft delete error:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to deactivate' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[smc-admin/:id] DELETE error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
