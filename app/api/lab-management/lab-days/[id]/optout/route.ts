import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/lab-management/lab-days/[id]/optout   body: { reason?: string }
// "Remove me" (TRIM 6/7a-8c). Records that the signed-in user is off this lab
// day so the per-program default roster and the general-lab calendar default
// do not re-add them, removes their own self-signup role rows (and the
// calendar events those wrote), and removes the general-lab default event.
// Station assignments are NOT touched (separate control on the lab day page).
// Self only: the target is always the signed-in user.
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth('volunteer_instructor');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  const { id: labDayId } = await params;

  let reason: string | null = null;
  try {
    const body = await request.json();
    if (typeof body?.reason === 'string' && body.reason.trim()) reason = body.reason.trim().slice(0, 500);
  } catch {
    // no body is fine
  }

  const supabase = getSupabaseAdmin();
  try {
    const { data: labDay } = await supabase.from('lab_days').select('id').eq('id', labDayId).maybeSingle();
    if (!labDay) return NextResponse.json({ success: false, error: 'Lab day not found' }, { status: 404 });

    // Record the opt-out first: if later cleanup steps fail the user is still
    // off the day (default and sync read this row).
    const { error: optErr } = await supabase
      .from('lab_day_optouts')
      .upsert({ lab_day_id: labDayId, user_id: user.id, reason }, { onConflict: 'lab_day_id,user_id' });
    if (optErr) throw optErr;

    // The user's own role rows on this day (self-signup / assigned roles).
    const { data: roleRows } = await supabase
      .from('lab_day_roles')
      .select('id')
      .eq('lab_day_id', labDayId)
      .eq('instructor_id', user.id);
    const roleIds = (roleRows || []).map(r => r.id as string);
    if (roleIds.length > 0) {
      const { error: delErr } = await supabase.from('lab_day_roles').delete().in('id', roleIds);
      if (delErr) throw delErr;
    }

    // Calendar cleanup is best-effort, awaited (Vercel freezes on response).
    try {
      const { removeLabDayRole, removeGeneralLabDefault } = await import('@/lib/google-calendar');
      for (const roleId of roleIds) await removeLabDayRole({ userEmail: user.email, roleId });
      await removeGeneralLabDefault({ userEmail: user.email, labDayId });
    } catch (err) {
      console.error('[optout] calendar cleanup failed:', err);
    }

    return NextResponse.json({ success: true, removed_role_ids: roleIds });
  } catch (error) {
    console.error('Error recording lab day opt-out:', error);
    return NextResponse.json({ success: false, error: 'Failed to remove you from this lab day' }, { status: 500 });
  }
}

// DELETE /api/lab-management/lab-days/[id]/optout
// Clears the signed-in user's opt-out (Sign up again). Self only.
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth('volunteer_instructor');
  if (auth instanceof NextResponse) return auth;
  const { id: labDayId } = await params;
  try {
    const { error } = await getSupabaseAdmin()
      .from('lab_day_optouts')
      .delete()
      .eq('lab_day_id', labDayId)
      .eq('user_id', auth.user.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing lab day opt-out:', error);
    return NextResponse.json({ success: false, error: 'Failed to clear opt-out' }, { status: 500 });
  }
}
