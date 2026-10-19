import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { applyInstructorDiff } from '@/lib/calendar-auto-sync';

/**
 * Fire-and-forget calendar push after a join-table assignment change.
 * The block PUT route only syncs when the parent row's instructor
 * columns change, so edits made through pmi_block_instructors need
 * the same diff (add -> sync, remove -> remove). Best-effort: never
 * throws, never blocks the write.
 */
async function fireJoinAutoSync(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  blockId: string,
  instructorId: string,
  action: 'added' | 'removed'
) {
  try {
    const [{ data: block }, { data: user }] = await Promise.all([
      supabase.from('pmi_schedule_blocks').select('id, recurring_group_id').eq('id', blockId).maybeSingle(),
      supabase.from('lab_users').select('email').eq('id', instructorId).maybeSingle(),
    ]);
    if (!block || !user?.email) return;
    const email = (user.email as string).toLowerCase();
    const results = await applyInstructorDiff({
      recurringGroupId: block.recurring_group_id ?? null,
      blockIdForOneOff: block.recurring_group_id ? null : block.id,
      oldEmails: action === 'removed' ? new Set([email]) : new Set<string>(),
      newEmails: action === 'added' ? new Set([email]) : new Set<string>(),
    });
    for (const r of results) {
      if (r.result.status === 'failed') {
        console.warn(`[block-instructors] auto-sync ${r.action} failed for ${r.email}:`, 'error' in r.result ? r.result.error : '');
      } else {
        console.log(`[block-instructors] auto-sync ${r.action} ${r.result.status} for ${r.email}`);
      }
    }
  } catch (err) {
    console.warn('[block-instructors] auto-sync error (non-fatal):', err);
  }
}

export async function POST(
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
    const { instructor_id, role } = body;

    if (!instructor_id) {
      return NextResponse.json({ error: 'instructor_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('pmi_block_instructors')
      .insert({
        schedule_block_id: id,
        instructor_id,
        role: role ?? 'primary',
      })
      .select(`
        *,
        instructor:lab_users!pmi_block_instructors_instructor_id_fkey(id, name, email)
      `)
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Instructor already assigned to this block' }, { status: 409 });
      }
      throw error;
    }

    void fireJoinAutoSync(supabase, id, instructor_id, 'added');

    return NextResponse.json({ assignment: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Assign instructor error:', err);
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
    const body = await request.json();
    const { instructor_id } = body;

    if (!instructor_id) {
      return NextResponse.json({ error: 'instructor_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('pmi_block_instructors')
      .delete()
      .eq('schedule_block_id', id)
      .eq('instructor_id', instructor_id);

    if (error) throw error;

    void fireJoinAutoSync(supabase, id, instructor_id, 'removed');

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Remove instructor error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
