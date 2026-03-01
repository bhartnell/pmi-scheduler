import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';
import { logAuditEvent } from '@/lib/audit';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OperationType = 'update_status' | 'assign_cohort' | 'delete_records' | 'export_records';
type FilterOperator = 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in_list';

interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: string | string[];
}

interface BulkOperationRequest {
  operation: OperationType;
  target_table: string;
  filters: FilterCondition[];
  parameters: Record<string, unknown>;
  dry_run?: boolean;
}

// ---------------------------------------------------------------------------
// Allowed tables whitelist (security: never allow arbitrary table names)
// ---------------------------------------------------------------------------

const ALLOWED_TABLES = ['students', 'lab_days', 'shifts', 'lab_users', 'student_internships'] as const;
type AllowedTable = typeof ALLOWED_TABLES[number];

// Columns allowed for filtering per table (prevents SQL injection via field names)
const ALLOWED_FILTER_FIELDS: Record<AllowedTable, string[]> = {
  students: ['status', 'cohort_id', 'agency', 'created_at', 'first_name', 'last_name'],
  lab_days: ['is_active', 'cohort_id', 'date', 'created_at'],
  shifts: ['status', 'department', 'date', 'created_at', 'instructor_id'],
  lab_users: ['role', 'is_active', 'created_at', 'email'],
  student_internships: ['status', 'cohort_id', 'current_phase', 'created_at'],
};

// Columns allowed to be updated per table
const ALLOWED_UPDATE_FIELDS: Record<AllowedTable, string[]> = {
  students: ['status', 'cohort_id'],
  lab_days: ['is_active', 'cohort_id'],
  shifts: ['status'],
  lab_users: ['role', 'is_active'],
  student_internships: ['status', 'current_phase'],
};

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
// Helper: apply filters to a Supabase query
// ---------------------------------------------------------------------------

function applyFilters(
  query: ReturnType<ReturnType<typeof getSupabaseAdmin>['from']>,
  table: AllowedTable,
  filters: FilterCondition[]
) {
  const allowedFields = ALLOWED_FILTER_FIELDS[table] || [];

  for (const filter of filters) {
    // Validate field name
    if (!allowedFields.includes(filter.field)) {
      continue;
    }

    const field = filter.field;
    const value = filter.value;

    switch (filter.operator) {
      case 'equals':
        query = (query as any).eq(field, value);
        break;
      case 'not_equals':
        query = (query as any).neq(field, value);
        break;
      case 'contains':
        query = (query as any).ilike(field, `%${value}%`);
        break;
      case 'greater_than':
        query = (query as any).gt(field, value);
        break;
      case 'less_than':
        query = (query as any).lt(field, value);
        break;
      case 'in_list':
        if (Array.isArray(value)) {
          query = (query as any).in(field, value);
        } else {
          // Support comma-separated string
          const items = String(value).split(',').map((v) => v.trim()).filter(Boolean);
          query = (query as any).in(field, items);
        }
        break;
    }
  }

  return query;
}

// ---------------------------------------------------------------------------
// Helper: CSV builder for export
// ---------------------------------------------------------------------------

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]).join(',');
  const body = rows.map((row) => Object.values(row).map(csvCell).join(',')).join('\n');
  return headers + '\n' + body;
}

// ---------------------------------------------------------------------------
// GET /api/admin/bulk-operations — list recent operation history
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '50'), 100);

    const { data, error } = await supabase
      .from('bulk_operation_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({ success: true, operations: data || [] });
  } catch (error) {
    console.error('Error fetching bulk operation history:', error);
    return NextResponse.json({ error: 'Failed to fetch operation history' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/bulk-operations — execute a bulk operation
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body: BulkOperationRequest = await request.json();
    const { operation, target_table, filters = [], parameters = {}, dry_run = false } = body;

    // Validate table
    if (!ALLOWED_TABLES.includes(target_table as AllowedTable)) {
      return NextResponse.json({ error: `Table "${target_table}" is not allowed for bulk operations` }, { status: 400 });
    }
    const table = target_table as AllowedTable;

    // Validate operation
    const validOperations: OperationType[] = ['update_status', 'assign_cohort', 'delete_records', 'export_records'];
    if (!validOperations.includes(operation)) {
      return NextResponse.json({ error: `Operation "${operation}" is not supported` }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // -------------------------------------------------------------------------
    // Step 1: Query matching records (used by all operations)
    // -------------------------------------------------------------------------

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let previewQuery: any = supabase.from(table).select('*');
    previewQuery = applyFilters(previewQuery, table, filters);

    const { data: matchingRecords, error: previewError } = await (previewQuery as any);
    if (previewError) {
      console.error('Error previewing records:', previewError);
      return NextResponse.json({ error: 'Failed to query matching records' }, { status: 500 });
    }

    const records = matchingRecords || [];
    const affectedCount = records.length;

    // If dry_run, return preview without executing
    if (dry_run) {
      return NextResponse.json({
        success: true,
        dry_run: true,
        affected_count: affectedCount,
        preview: records.slice(0, 20), // Return up to 20 sample records
        total_matching: affectedCount,
      });
    }

    if (affectedCount === 0) {
      return NextResponse.json({
        success: true,
        affected_count: 0,
        message: 'No records matched the specified filters',
      });
    }

    // -------------------------------------------------------------------------
    // Step 2: Execute the operation
    // -------------------------------------------------------------------------

    let operationStatus: string = 'completed';
    let rollbackData: unknown = null;
    let operationId: string | null = null;
    let exportContent: string | null = null;
    let exportFormat: string = 'csv';

    const recordIds = records.map((r: any) => r.id);

    if (operation === 'update_status') {
      const newStatus = parameters.new_status as string;
      if (!newStatus) {
        return NextResponse.json({ error: 'new_status parameter is required for update_status operation' }, { status: 400 });
      }

      if (!ALLOWED_UPDATE_FIELDS[table].includes('status')) {
        return NextResponse.json({ error: `Table "${table}" does not support status updates` }, { status: 400 });
      }

      // Store original values for rollback
      rollbackData = records.map((r: any) => ({ id: r.id, status: r.status }));

      const { error: updateError } = await supabase
        .from(table)
        .update({ status: newStatus })
        .in('id', recordIds);

      if (updateError) {
        operationStatus = 'failed';
        console.error('Bulk update_status error:', updateError);
        return NextResponse.json({ error: 'Failed to update records' }, { status: 500 });
      }

    } else if (operation === 'assign_cohort') {
      const cohortId = parameters.cohort_id as string;
      if (!cohortId) {
        return NextResponse.json({ error: 'cohort_id parameter is required for assign_cohort operation' }, { status: 400 });
      }

      if (!ALLOWED_UPDATE_FIELDS[table].includes('cohort_id')) {
        return NextResponse.json({ error: `Table "${table}" does not support cohort assignment` }, { status: 400 });
      }

      // Store original values for rollback
      rollbackData = records.map((r: any) => ({ id: r.id, cohort_id: r.cohort_id }));

      const { error: updateError } = await supabase
        .from(table)
        .update({ cohort_id: cohortId })
        .in('id', recordIds);

      if (updateError) {
        operationStatus = 'failed';
        console.error('Bulk assign_cohort error:', updateError);
        return NextResponse.json({ error: 'Failed to assign cohort' }, { status: 500 });
      }

    } else if (operation === 'delete_records') {
      const confirmed = parameters.confirmed as boolean;
      if (!confirmed) {
        return NextResponse.json({ error: 'confirmed parameter must be true to delete records' }, { status: 400 });
      }

      // Store full records for potential audit (not actually rollback-able after deletion)
      rollbackData = records.map((r: any) => ({ ...r }));

      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .in('id', recordIds);

      if (deleteError) {
        operationStatus = 'failed';
        console.error('Bulk delete error:', deleteError);
        return NextResponse.json({ error: 'Failed to delete records' }, { status: 500 });
      }

    } else if (operation === 'export_records') {
      exportFormat = (parameters.format as string) || 'csv';

      if (exportFormat === 'json') {
        exportContent = JSON.stringify(
          {
            export_type: `bulk_${table}`,
            exported_at: new Date().toISOString(),
            exported_by: currentUser.email,
            record_count: affectedCount,
            filters,
            data: records,
          },
          null,
          2
        );
      } else {
        exportContent = toCsv(records);
      }
    }

    // -------------------------------------------------------------------------
    // Step 3: Log the operation
    // -------------------------------------------------------------------------

    const { data: logEntry, error: logError } = await supabase
      .from('bulk_operation_logs')
      .insert({
        operation_type: operation,
        target_table: table,
        affected_count: affectedCount,
        parameters,
        status: operationStatus,
        rollback_data: rollbackData,
        performed_by: currentUser.email,
      })
      .select('id')
      .single();

    if (logError) {
      console.error('Failed to log bulk operation:', logError);
      // Don't fail the response - operation already succeeded
    } else {
      operationId = logEntry?.id || null;
    }

    // Audit log
    await logAuditEvent({
      user: { id: currentUser.id, email: currentUser.email, role: currentUser.role },
      action: operation === 'delete_records' ? 'delete' : operation === 'export_records' ? 'export' : 'update',
      resourceType: 'student_list',
      resourceDescription: `Bulk ${operation} on ${table}: ${affectedCount} records`,
      metadata: { operation, target_table: table, filters, parameters, affected_count: affectedCount, operation_id: operationId },
    });

    // -------------------------------------------------------------------------
    // Step 4: Return result
    // -------------------------------------------------------------------------

    // For export operations, return the file content
    if (operation === 'export_records' && exportContent !== null) {
      const extension = exportFormat === 'json' ? 'json' : 'csv';
      const contentType = exportFormat === 'json' ? 'application/json' : 'text/csv';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `bulk-export-${table}-${timestamp}.${extension}`;

      return new NextResponse(exportContent, {
        status: 200,
        headers: {
          'Content-Type': `${contentType}; charset=utf-8`,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'X-Operation-Id': operationId || '',
          'X-Affected-Count': String(affectedCount),
        },
      });
    }

    return NextResponse.json({
      success: true,
      operation_id: operationId,
      affected_count: affectedCount,
      status: operationStatus,
      message: `Successfully ${operation === 'delete_records' ? 'deleted' : 'updated'} ${affectedCount} records`,
    });

  } catch (error) {
    console.error('Error executing bulk operation:', error);
    return NextResponse.json({ error: 'Failed to execute bulk operation' }, { status: 500 });
  }
}
