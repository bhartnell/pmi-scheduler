import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

/**
 * Calculate the next run timestamp for a given schedule type.
 * weekly  → next Sunday at 06:00 UTC
 * monthly → 1st of next month at 06:00 UTC
 */
function calcNextRunAt(schedule: 'weekly' | 'monthly'): string {
  const now = new Date();

  if (schedule === 'weekly') {
    const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7;
    const next = new Date(now);
    next.setUTCDate(now.getUTCDate() + daysUntilSunday);
    next.setUTCHours(6, 0, 0, 0);
    return next.toISOString();
  } else {
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 6, 0, 0, 0));
    return next.toISOString();
  }
}

// ---------------------------------------------------------------------------
// PUT /api/admin/scheduled-exports/[id]
// ---------------------------------------------------------------------------
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, report_type, schedule, recipients, is_active } = body as {
      name?: string;
      report_type?: 'cohort_progress' | 'clinical_hours' | 'lab_completion' | 'student_status';
      schedule?: 'weekly' | 'monthly';
      recipients?: string[];
      is_active?: boolean;
    };

    const supabase = getSupabaseAdmin();

    // Verify the export exists
    const { data: existing, error: fetchError } = await supabase
      .from('scheduled_exports')
      .select('id, schedule, is_active, next_run_at')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Scheduled export not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (report_type !== undefined) updates.report_type = report_type;
    if (recipients !== undefined) updates.recipients = recipients;

    // Recalculate next_run_at when schedule changes or is_active toggles on
    const newSchedule = schedule ?? existing.schedule;
    const newIsActive = is_active ?? existing.is_active;

    if (schedule !== undefined) {
      updates.schedule = schedule;
    }

    if (is_active !== undefined) {
      updates.is_active = is_active;
    }

    // Recalculate next_run_at if: schedule changed OR toggled back to active
    if (schedule !== undefined || (is_active === true && !existing.is_active)) {
      updates.next_run_at = newIsActive ? calcNextRunAt(newSchedule as 'weekly' | 'monthly') : null;
    } else if (is_active === false) {
      updates.next_run_at = null;
    }

    const { data, error } = await supabase
      .from('scheduled_exports')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, export: data });
  } catch (error) {
    console.error('Error updating scheduled export:', error);
    return NextResponse.json({ error: 'Failed to update scheduled export' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/scheduled-exports/[id]
// ---------------------------------------------------------------------------
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('scheduled_exports')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting scheduled export:', error);
    return NextResponse.json({ error: 'Failed to delete scheduled export' }, { status: 500 });
  }
}
