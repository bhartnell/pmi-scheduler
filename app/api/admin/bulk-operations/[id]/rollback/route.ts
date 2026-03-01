import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';
import { logAuditEvent } from '@/lib/audit';

// ---------------------------------------------------------------------------
// Helper: get current user
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

// ---------------------------------------------------------------------------
// POST /api/admin/bulk-operations/[id]/rollback
// Rollback a previous update_status or assign_cohort operation
// ---------------------------------------------------------------------------

export async function POST(
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
    if (!id) {
      return NextResponse.json({ error: 'Operation ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch the original operation log
    const { data: operationLog, error: fetchError } = await supabase
      .from('bulk_operations_history')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !operationLog) {
      return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
    }

    // Only update operations are rollback-able
    const rollbackableOperations = ['update_status', 'assign_cohort'];
    if (!rollbackableOperations.includes(operationLog.operation_type)) {
      return NextResponse.json({
        error: `Operation type "${operationLog.operation_type}" cannot be rolled back. Only update_status and assign_cohort operations are reversible.`,
      }, { status: 400 });
    }

    // Validate rollback data exists
    const rollbackData = operationLog.rollback_data as Array<{ id: string; [key: string]: unknown }> | null;
    if (!rollbackData || !Array.isArray(rollbackData) || rollbackData.length === 0) {
      return NextResponse.json({ error: 'No rollback data available for this operation' }, { status: 400 });
    }

    const table = operationLog.target_table;

    // Allowed tables for safety
    const ALLOWED_TABLES = ['students', 'lab_days', 'shifts', 'lab_users', 'student_internships'];
    if (!ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: 'Cannot rollback operations on this table' }, { status: 400 });
    }

    // -------------------------------------------------------------------------
    // Execute rollback: restore original values for each record
    // -------------------------------------------------------------------------

    let successCount = 0;
    let failCount = 0;

    for (const originalRecord of rollbackData) {
      const { id: recordId, ...fieldsToRestore } = originalRecord;

      if (!recordId) continue;

      const { error: restoreError } = await supabase
        .from(table)
        .update(fieldsToRestore)
        .eq('id', recordId);

      if (restoreError) {
        console.error(`Failed to restore record ${recordId}:`, restoreError);
        failCount++;
      } else {
        successCount++;
      }
    }

    // -------------------------------------------------------------------------
    // Log the rollback as a new operation entry
    // -------------------------------------------------------------------------

    await supabase.from('bulk_operations_history').insert({
      operation_type: `rollback_${operationLog.operation_type}`,
      target_table: table,
      affected_count: successCount,
      filters: {},
      changes: { original_operation_id: id, success_count: successCount, fail_count: failCount },
      is_dry_run: false,
      rollback_data: null,
      executed_by: currentUser.email,
    });

    // Audit log
    await logAuditEvent({
      user: { id: currentUser.id, email: currentUser.email, role: currentUser.role },
      action: 'update',
      resourceType: 'student_list',
      resourceDescription: `Rolled back bulk operation ${id} on ${table}: ${successCount} records restored`,
      metadata: {
        original_operation_id: id,
        original_operation_type: operationLog.operation_type,
        target_table: table,
        success_count: successCount,
        fail_count: failCount,
      },
    });

    return NextResponse.json({
      success: true,
      restored_count: successCount,
      failed_count: failCount,
      message:
        failCount === 0
          ? `Successfully rolled back ${successCount} records`
          : `Rolled back ${successCount} records; ${failCount} failed`,
    });

  } catch (error) {
    console.error('Error rolling back bulk operation:', error);
    return NextResponse.json({ error: 'Failed to rollback operation' }, { status: 500 });
  }
}
