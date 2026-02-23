import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createNotification } from '@/lib/notifications';
import { getSupabaseAdmin } from '@/lib/supabase';

const VALID_STATUSES = ['new', 'read', 'in_progress', 'needs_investigation', 'resolved', 'archived'];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  // Parse header — handle potential BOM and whitespace
  const header = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.trim().toLowerCase());

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parse — handles quoted fields with commas
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        if (inQuotes && line[j + 1] === '"') {
          current += '"';
          j++; // skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row: Record<string, string> = {};
    header.forEach((col, idx) => {
      row[col] = values[idx] || '';
    });
    rows.push(row);
  }

  return rows;
}

// Map display labels back to DB values
function normalizeStatus(raw: string): string | null {
  const lower = raw.toLowerCase().trim();
  // Direct match
  if (VALID_STATUSES.includes(lower)) return lower;
  // Label-to-value mapping
  const labelMap: Record<string, string> = {
    'new': 'new',
    'read': 'read',
    'in progress': 'in_progress',
    'needs investigation': 'needs_investigation',
    'resolved': 'resolved',
    'archived': 'archived',
  };
  return labelMap[lower] || null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    const { data: user } = await supabase
      .from('lab_users')
      .select('role')
      .eq('email', session.user.email)
      .single();

    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
      return NextResponse.json({ success: false, error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'CSV file is empty or has no data rows' }, { status: 400 });
    }

    // Validate required columns
    const firstRow = rows[0];
    if (!('id' in firstRow)) {
      return NextResponse.json({ success: false, error: 'CSV must have an "id" column' }, { status: 400 });
    }
    if (!('status' in firstRow)) {
      return NextResponse.json({ success: false, error: 'CSV must have a "status" column' }, { status: 400 });
    }

    const results = {
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 for 1-based + header row
      const id = row.id?.trim();
      const rawStatus = row.status?.trim();
      const resolutionNotes = row['resolution notes'] || row['resolution_notes'] || '';

      // Validate UUID
      if (!id || !UUID_REGEX.test(id)) {
        results.errors.push(`Row ${rowNum}: Invalid or missing ID "${id}"`);
        continue;
      }

      // Normalize status (handle both DB values and display labels)
      const newStatus = normalizeStatus(rawStatus || '');
      if (!newStatus) {
        results.errors.push(`Row ${rowNum}: Invalid status "${rawStatus}"`);
        continue;
      }

      // Fetch current report
      const { data: current, error: fetchError } = await supabase
        .from('feedback_reports')
        .select('id, status, user_email, report_type, page_url, description')
        .eq('id', id)
        .single();

      if (fetchError || !current) {
        results.errors.push(`Row ${rowNum}: Feedback report not found for ID "${id}"`);
        continue;
      }

      // Skip if status hasn't changed and no resolution notes to update
      const statusChanged = current.status !== newStatus;
      const hasNotes = resolutionNotes.trim().length > 0;

      if (!statusChanged && !hasNotes) {
        results.skipped++;
        continue;
      }

      // Build update payload
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (statusChanged) {
        updateData.status = newStatus;

        if (newStatus === 'read') {
          updateData.read_at = new Date().toISOString();
          updateData.read_by = session.user.email;
        } else if (newStatus === 'resolved') {
          updateData.resolved_at = new Date().toISOString();
          updateData.resolved_by = session.user.email;
        } else if (newStatus === 'archived') {
          updateData.archived_at = new Date().toISOString();
        }
      }

      if (hasNotes) {
        updateData.resolution_notes = resolutionNotes.trim();
      }

      const { error: updateError } = await supabase
        .from('feedback_reports')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        results.errors.push(`Row ${rowNum}: Failed to update — ${updateError.message}`);
        continue;
      }

      results.updated++;

      // Auto-notify the reporter on status change
      if (statusChanged && current.user_email) {
        try {
          const typeLabel = current.report_type === 'bug' ? 'bug report' :
                           current.report_type === 'feature' ? 'feature request' : 'feedback';
          const pageRef = current.page_url ? ` on ${current.page_url}` : '';
          const statusLabel = newStatus.replace(/_/g, ' ');

          await createNotification({
            userEmail: current.user_email,
            title: 'Feedback Updated',
            message: `Your ${typeLabel}${pageRef} was marked as ${statusLabel}`,
            type: 'feedback_resolved',
            linkUrl: '/lab-management/admin/feedback',
            referenceType: 'feedback_report',
            referenceId: id,
          });
        } catch (notifyError) {
          // Don't fail the import if notification fails
          console.error(`Failed to notify ${current.user_email}:`, notifyError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error: any) {
    console.error('Error importing feedback:', error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Failed to import feedback',
    }, { status: 500 });
  }
}
