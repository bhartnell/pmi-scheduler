import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isSuperadmin } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// Helper – resolve current user from session email
// ---------------------------------------------------------------------------
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, role')
    .ilike('email', email)
    .single();
  return data;
}

// ---------------------------------------------------------------------------
// GET /api/admin/database-tools/notifications
//
// Query params:
//   ?days=30              - notifications older than this many days
//   ?include_unread=false - whether to include unread notifications
//
// Returns count of old notification records.
// Requires superadmin role.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !isSuperadmin(currentUser.role)) {
      return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const days = Math.max(7, parseInt(searchParams.get('days') || '30'));
    const includeUnread = searchParams.get('include_unread') === 'true';

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('user_notifications')
      .select('id', { count: 'exact', head: true })
      .lt('created_at', cutoff.toISOString());

    if (!includeUnread) {
      query = query.eq('is_read', true);
    }

    const { count, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      count: count ?? 0,
      cutoffDate: cutoff.toISOString(),
      days,
      includeUnread,
    });
  } catch (error) {
    console.error('Error counting notifications:', error);
    return NextResponse.json({ error: 'Failed to count notifications' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/database-tools/notifications
//
// Query params:
//   ?days=30              - delete notifications older than this many days
//   ?include_unread=false - whether to also delete unread notifications
//   ?dry_run=true         - preview only (default true)
//
// Removes old notification records.
// Requires superadmin role.
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !isSuperadmin(currentUser.role)) {
      return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const days = Math.max(7, parseInt(searchParams.get('days') || '30'));
    const includeUnread = searchParams.get('include_unread') === 'true';
    const dryRun = searchParams.get('dry_run') !== 'false';

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const supabase = getSupabaseAdmin();

    if (dryRun) {
      let countQuery = supabase
        .from('user_notifications')
        .select('id', { count: 'exact', head: true })
        .lt('created_at', cutoff.toISOString());
      if (!includeUnread) {
        countQuery = countQuery.eq('is_read', true);
      }
      const { count, error } = await countQuery;
      if (error) throw error;
      return NextResponse.json({
        success: true,
        dryRun: true,
        count: count ?? 0,
        cutoffDate: cutoff.toISOString(),
      });
    }

    let deleteQuery = supabase
      .from('user_notifications')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff.toISOString());

    if (!includeUnread) {
      deleteQuery = deleteQuery.eq('is_read', true);
    }

    const { count, error } = await deleteQuery;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      dryRun: false,
      deleted: count ?? 0,
      cutoffDate: cutoff.toISOString(),
    });
  } catch (error) {
    console.error('Error deleting notifications:', error);
    return NextResponse.json({ error: 'Failed to delete notifications' }, { status: 500 });
  }
}
