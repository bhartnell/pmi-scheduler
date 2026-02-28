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
// GET /api/admin/database-tools/audit-logs
//
// Query params:
//   ?retention_days=90  - how many days to keep (default 90)
//   ?dry_run=true       - preview count only (default true)
//
// Returns count of audit log records older than retention_days.
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
    const retentionDays = Math.max(30, parseInt(searchParams.get('retention_days') || '90'));

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const supabase = getSupabaseAdmin();
    const { count, error } = await supabase
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .lt('created_at', cutoff.toISOString());

    if (error) throw error;

    return NextResponse.json({
      success: true,
      count: count ?? 0,
      cutoffDate: cutoff.toISOString(),
      retentionDays,
    });
  } catch (error) {
    console.error('Error counting audit logs:', error);
    return NextResponse.json({ error: 'Failed to count audit logs' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/database-tools/audit-logs
//
// Query params:
//   ?retention_days=90  - how many days to keep
//   ?dry_run=true       - if true, only count; do not delete
//
// Removes audit log records older than retention_days.
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
    const retentionDays = Math.max(30, parseInt(searchParams.get('retention_days') || '90'));
    const dryRun = searchParams.get('dry_run') !== 'false';

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const supabase = getSupabaseAdmin();

    if (dryRun) {
      const { count, error } = await supabase
        .from('audit_log')
        .select('id', { count: 'exact', head: true })
        .lt('created_at', cutoff.toISOString());
      if (error) throw error;
      return NextResponse.json({
        success: true,
        dryRun: true,
        count: count ?? 0,
        cutoffDate: cutoff.toISOString(),
      });
    }

    const { count, error } = await supabase
      .from('audit_log')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff.toISOString());

    if (error) throw error;

    return NextResponse.json({
      success: true,
      dryRun: false,
      deleted: count ?? 0,
      cutoffDate: cutoff.toISOString(),
    });
  } catch (error) {
    console.error('Error deleting audit logs:', error);
    return NextResponse.json({ error: 'Failed to delete audit logs' }, { status: 500 });
  }
}
