import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// ─────────────────────────────────────────────────
// Data source schema definitions
// ─────────────────────────────────────────────────

export const DATA_SOURCE_SCHEMA: Record<string, {
  label: string;
  table: string;
  columns: Array<{ key: string; label: string; type: 'text' | 'number' | 'date' | 'boolean' }>;
}> = {
  students: {
    label: 'Students',
    table: 'students',
    columns: [
      { key: 'id', label: 'ID', type: 'text' },
      { key: 'first_name', label: 'First Name', type: 'text' },
      { key: 'last_name', label: 'Last Name', type: 'text' },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'agency', label: 'Agency', type: 'text' },
      { key: 'cohort_id', label: 'Cohort ID', type: 'text' },
      { key: 'created_at', label: 'Created At', type: 'date' },
    ],
  },
  lab_days: {
    label: 'Lab Days',
    table: 'lab_days',
    columns: [
      { key: 'id', label: 'ID', type: 'text' },
      { key: 'lab_date', label: 'Lab Date', type: 'date' },
      { key: 'cohort_id', label: 'Cohort ID', type: 'text' },
      { key: 'location', label: 'Location', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'text' },
      { key: 'is_cancelled', label: 'Cancelled', type: 'boolean' },
      { key: 'created_at', label: 'Created At', type: 'date' },
    ],
  },
  shifts: {
    label: 'Shifts',
    table: 'shifts',
    columns: [
      { key: 'id', label: 'ID', type: 'text' },
      { key: 'shift_date', label: 'Shift Date', type: 'date' },
      { key: 'start_time', label: 'Start Time', type: 'text' },
      { key: 'end_time', label: 'End Time', type: 'text' },
      { key: 'location', label: 'Location', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'text' },
      { key: 'created_at', label: 'Created At', type: 'date' },
    ],
  },
  attendance: {
    label: 'Attendance',
    table: 'lab_day_attendance',
    columns: [
      { key: 'id', label: 'ID', type: 'text' },
      { key: 'lab_day_id', label: 'Lab Day ID', type: 'text' },
      { key: 'student_id', label: 'Student ID', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'text' },
      { key: 'created_at', label: 'Created At', type: 'date' },
    ],
  },
  clinical_hours: {
    label: 'Clinical Hours',
    table: 'student_clinical_hours',
    columns: [
      { key: 'id', label: 'ID', type: 'text' },
      { key: 'student_id', label: 'Student ID', type: 'text' },
      { key: 'total_hours', label: 'Total Hours', type: 'number' },
      { key: 'required_hours', label: 'Required Hours', type: 'number' },
      { key: 'updated_at', label: 'Updated At', type: 'date' },
    ],
  },
  certifications: {
    label: 'Certifications',
    table: 'student_certifications',
    columns: [
      { key: 'id', label: 'ID', type: 'text' },
      { key: 'student_id', label: 'Student ID', type: 'text' },
      { key: 'certification_type', label: 'Certification Type', type: 'text' },
      { key: 'issued_date', label: 'Issued Date', type: 'date' },
      { key: 'expiry_date', label: 'Expiry Date', type: 'date' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'created_at', label: 'Created At', type: 'date' },
    ],
  },
  grades: {
    label: 'Grades',
    table: 'scenario_assessments',
    columns: [
      { key: 'id', label: 'ID', type: 'text' },
      { key: 'team_lead_id', label: 'Team Lead (Student) ID', type: 'text' },
      { key: 'cohort_id', label: 'Cohort ID', type: 'text' },
      { key: 'overall_score', label: 'Overall Score', type: 'number' },
      { key: 'scenario_id', label: 'Scenario ID', type: 'text' },
      { key: 'assessed_at', label: 'Assessed At', type: 'date' },
      { key: 'created_at', label: 'Created At', type: 'date' },
    ],
  },
};

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

async function getCallerRole(email: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', email)
    .single();
  return data?.role ?? null;
}

type FilterRow = {
  column: string;
  operator: string;
  value: string;
  value2?: string;
};

function applyFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  filters: FilterRow[]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  for (const f of filters) {
    if (!f.column || !f.operator) continue;
    switch (f.operator) {
      case 'equals':
        query = query.eq(f.column, f.value);
        break;
      case 'not_equals':
        query = query.neq(f.column, f.value);
        break;
      case 'contains':
        query = query.ilike(f.column, `%${f.value}%`);
        break;
      case 'gt':
        query = query.gt(f.column, f.value);
        break;
      case 'lt':
        query = query.lt(f.column, f.value);
        break;
      case 'between':
        if (f.value && f.value2) {
          query = query.gte(f.column, f.value).lte(f.column, f.value2);
        }
        break;
      case 'is_null':
        query = query.is(f.column, null);
        break;
    }
  }
  return query;
}

// ─────────────────────────────────────────────────
// GET /api/reports/builder?action=schema|run
// ─────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const callerRole = await getCallerRole(session.user.email);
  if (!callerRole || !hasMinRole(callerRole, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action') || 'schema';

  // ── Return schema ─────────────────────────────────────────────
  if (action === 'schema') {
    const schema = Object.entries(DATA_SOURCE_SCHEMA).map(([key, val]) => ({
      key,
      label: val.label,
      columns: val.columns,
    }));
    return NextResponse.json({ success: true, schema });
  }

  // ── Run report ────────────────────────────────────────────────
  if (action === 'run') {
    const dataSource = searchParams.get('data_source');
    if (!dataSource || !DATA_SOURCE_SCHEMA[dataSource]) {
      return NextResponse.json({ error: 'Invalid or missing data_source' }, { status: 400 });
    }

    const sourceConfig = DATA_SOURCE_SCHEMA[dataSource];
    const validColumnKeys = new Set(sourceConfig.columns.map((c) => c.key));

    // Parse columns
    const columnsParam = searchParams.getAll('columns[]');
    const selectedColumns = columnsParam.length > 0
      ? columnsParam.filter((c) => validColumnKeys.has(c))
      : sourceConfig.columns.map((c) => c.key);

    if (selectedColumns.length === 0) {
      return NextResponse.json({ error: 'No valid columns selected' }, { status: 400 });
    }

    // Parse filters
    let filters: FilterRow[] = [];
    const filtersParam = searchParams.get('filters');
    if (filtersParam) {
      try {
        filters = JSON.parse(filtersParam);
      } catch {
        filters = [];
      }
    }

    // Parse sort
    const sortBy = searchParams.get('sort_by');
    const sortDirection = searchParams.get('sort_direction') === 'desc' ? false : true;
    const groupBy = searchParams.get('group_by');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 500);

    try {
      const supabase = getSupabaseAdmin();

      // Build select string - include group_by if not already selected
      let selectCols = [...selectedColumns];
      if (groupBy && !selectCols.includes(groupBy) && validColumnKeys.has(groupBy)) {
        selectCols = [groupBy, ...selectCols];
      }

      let query = supabase
        .from(sourceConfig.table)
        .select(selectCols.join(','));

      // Apply filters
      query = applyFilters(query, filters);

      // Sort
      if (sortBy && validColumnKeys.has(sortBy)) {
        query = query.order(sortBy, { ascending: sortDirection });
      } else if (selectCols.includes('created_at')) {
        query = query.order('created_at', { ascending: false });
      }

      // Limit
      query = query.limit(limit);

      const { data, error, count } = await query;

      if (error) {
        console.error('Report query error:', error);
        return NextResponse.json({ error: 'Query failed: ' + error.message }, { status: 500 });
      }

      // Get total count (separate query without limit)
      let totalCount: number | null = null;
      try {
        let countQuery = supabase
          .from(sourceConfig.table)
          .select('id', { count: 'exact', head: true });
        countQuery = applyFilters(countQuery, filters);
        const { count: tc } = await countQuery;
        totalCount = tc;
      } catch {
        totalCount = count;
      }

      return NextResponse.json({
        success: true,
        data: data || [],
        total_count: totalCount,
        columns: selectCols,
        source_label: sourceConfig.label,
      });
    } catch (err) {
      console.error('Report builder run error:', err);
      return NextResponse.json({ error: 'Failed to run report' }, { status: 500 });
    }
  }

  // ── List saved templates ──────────────────────────────────────
  if (action === 'templates') {
    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from('report_templates')
        .select('*')
        .or(`created_by.eq.${session.user.email},is_shared.eq.true`)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      return NextResponse.json({ success: true, templates: data || [] });
    } catch (err) {
      console.error('Error fetching templates:', err);
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

// ─────────────────────────────────────────────────
// POST /api/reports/builder — Save template
// ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const callerRole = await getCallerRole(session.user.email);
  if (!callerRole || !hasMinRole(callerRole, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, description, data_source, columns, filters, sort_by, sort_direction, group_by, is_shared } = body;

    if (!name || !data_source || !columns || columns.length === 0) {
      return NextResponse.json({ error: 'name, data_source, and columns are required' }, { status: 400 });
    }

    if (!DATA_SOURCE_SCHEMA[data_source]) {
      return NextResponse.json({ error: 'Invalid data_source' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('report_templates')
      .insert({
        name,
        description: description || null,
        data_source,
        columns,
        filters: filters || [],
        sort_by: sort_by || null,
        sort_direction: sort_direction || 'asc',
        group_by: group_by || null,
        is_shared: is_shared || false,
        created_by: session.user.email,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, template: data });
  } catch (err) {
    console.error('Error saving template:', err);
    return NextResponse.json({ error: 'Failed to save template' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────
// PUT /api/reports/builder — Update template
// ─────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const callerRole = await getCallerRole(session.user.email);
  if (!callerRole || !hasMinRole(callerRole, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, name, description, data_source, columns, filters, sort_by, sort_direction, group_by, is_shared } = body;

    if (!id) {
      return NextResponse.json({ error: 'Template id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from('report_templates')
      .select('id, created_by')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Only creator or admin+ can update
    if (existing.created_by !== session.user.email && !hasMinRole(callerRole, 'admin')) {
      return NextResponse.json({ error: 'Forbidden: not your template' }, { status: 403 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (data_source !== undefined) {
      if (!DATA_SOURCE_SCHEMA[data_source]) {
        return NextResponse.json({ error: 'Invalid data_source' }, { status: 400 });
      }
      updates.data_source = data_source;
    }
    if (columns !== undefined) updates.columns = columns;
    if (filters !== undefined) updates.filters = filters;
    if (sort_by !== undefined) updates.sort_by = sort_by;
    if (sort_direction !== undefined) updates.sort_direction = sort_direction;
    if (group_by !== undefined) updates.group_by = group_by;
    if (is_shared !== undefined) updates.is_shared = is_shared;

    const { data, error } = await supabase
      .from('report_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, template: data });
  } catch (err) {
    console.error('Error updating template:', err);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────
// DELETE /api/reports/builder?id=<uuid>
// ─────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const callerRole = await getCallerRole(session.user.email);
  if (!callerRole || !hasMinRole(callerRole, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from('report_templates')
      .select('id, created_by')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (existing.created_by !== session.user.email && !hasMinRole(callerRole, 'admin')) {
      return NextResponse.json({ error: 'Forbidden: not your template' }, { status: 403 });
    }

    const { error } = await supabase
      .from('report_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting template:', err);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
