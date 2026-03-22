import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// CSV helpers
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
  return headers + '\n' + rows.map(r => Object.values(r).map(csvCell).join(',')).join('\n');
}

function flattenRow(row: any): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
        flat[`${key}_${subKey}`] = subValue;
      }
    } else {
      flat[key] = value;
    }
  }
  return flat;
}

// ---------------------------------------------------------------------------
// Table export definitions
// ---------------------------------------------------------------------------

interface TableExport {
  name: string;
  query: () => PromiseLike<{ data: any[] | null; error: any }>;
}

function buildTableExports(supabase: ReturnType<typeof getSupabaseAdmin>): TableExport[] {
  return [
    {
      name: 'students',
      query: () =>
        supabase
          .from('students')
          .select('id, first_name, last_name, email, cohort_id, status, agency, created_at'),
    },
    {
      name: 'cohorts',
      query: () =>
        supabase
          .from('cohorts')
          .select('*, program:programs(name, abbreviation)'),
    },
    {
      name: 'student_groups',
      query: () =>
        supabase
          .from('student_groups')
          .select('*, student_group_assignments(*)'),
    },
    {
      name: 'station_completions',
      query: () =>
        supabase
          .from('station_completions')
          .select('*'),
    },
    {
      name: 'scenario_assessments',
      query: () =>
        supabase
          .from('scenario_assessments')
          .select('*'),
    },
    {
      name: 'skill_assessments',
      query: () =>
        supabase
          .from('skill_assessments')
          .select('*'),
    },
    {
      name: 'student_clinical_hours',
      query: () =>
        supabase
          .from('student_clinical_hours')
          .select('*'),
    },
    {
      name: 'student_internships',
      query: () =>
        supabase
          .from('student_internships')
          .select('*, student:students(first_name, last_name), agency:agencies(name)'),
    },
    {
      name: 'lab_day_attendance',
      query: () =>
        supabase
          .from('lab_day_attendance')
          .select('*, student:students(first_name, last_name), lab_day:lab_days(date)'),
    },
    {
      name: 'skill_signoffs',
      query: () =>
        supabase
          .from('skill_signoffs')
          .select('*'),
    },
  ];
}

// ---------------------------------------------------------------------------
// GET /api/cron/data-export
//
// Vercel cron endpoint. Runs weekly (Sunday night).
// Exports critical tables to CSV and stores them in Supabase Storage.
// Auth: Bearer token via CRON_SECRET env var (standard Vercel cron pattern).
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[DATA-EXPORT] Unauthorized cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  console.log('[DATA-EXPORT] Cron started at', new Date().toISOString());

  try {
    const supabase = getSupabaseAdmin();

    // Ensure storage bucket exists (idempotent)
    await supabase.storage
      .createBucket('data-exports', {
        public: false,
        fileSizeLimit: 52428800, // 50MB
      })
      .catch(() => {}); // Ignore if already exists

    const dateLabel = new Date().toISOString().slice(0, 10);
    const folderPath = `weekly/${dateLabel}`;

    console.log('[DATA-EXPORT] Exporting to folder:', folderPath);

    // -----------------------------------------------------------------------
    // Export each table
    // -----------------------------------------------------------------------

    const tableExports = buildTableExports(supabase);
    const filesList: { name: string; path: string; size: number; row_count: number }[] = [];
    let totalSize = 0;
    let totalRecords = 0;

    for (const tableExport of tableExports) {
      console.log(`[DATA-EXPORT] Querying table: ${tableExport.name}`);

      const { data: rows, error: queryError } = await tableExport.query();

      if (queryError) {
        console.error(`[DATA-EXPORT] Error querying ${tableExport.name}:`, queryError.message);
        continue;
      }

      if (!rows || rows.length === 0) {
        console.log(`[DATA-EXPORT] Table ${tableExport.name} is empty, skipping`);
        continue;
      }

      const csvContent = toCsv(rows.map(flattenRow));
      const filePath = `${folderPath}/${tableExport.name}.csv`;
      const fileSize = new TextEncoder().encode(csvContent).length;

      const { error: uploadError } = await supabase.storage
        .from('data-exports')
        .upload(filePath, csvContent, {
          contentType: 'text/csv',
          upsert: true,
        });

      if (uploadError) {
        console.error(`[DATA-EXPORT] Error uploading ${tableExport.name}:`, uploadError.message);
        continue;
      }

      filesList.push({
        name: tableExport.name,
        path: filePath,
        size: fileSize,
        row_count: rows.length,
      });

      totalSize += fileSize;
      totalRecords += rows.length;

      console.log(
        `[DATA-EXPORT] Exported ${tableExport.name}: ${rows.length} rows, ${fileSize} bytes`
      );
    }

    console.log(
      `[DATA-EXPORT] All tables exported: ${filesList.length} files, ${totalRecords} records, ${totalSize} bytes`
    );

    // -----------------------------------------------------------------------
    // Record the export in data_export_archives
    // -----------------------------------------------------------------------

    const { error: archiveError } = await supabase.from('data_export_archives').insert({
      export_type: 'weekly',
      label: `Weekly Export ${dateLabel}`,
      folder_path: folderPath,
      files: filesList,
      total_size: totalSize,
      total_records: totalRecords,
      created_by: 'system/cron',
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (archiveError) {
      console.error('[DATA-EXPORT] Error recording archive:', archiveError.message);
    } else {
      console.log('[DATA-EXPORT] Archive record created successfully');
    }

    // -----------------------------------------------------------------------
    // Cleanup old weekly exports (>90 days)
    // -----------------------------------------------------------------------

    let cleanedCount = 0;

    const { data: expired } = await supabase
      .from('data_export_archives')
      .select('id, folder_path, files')
      .eq('export_type', 'weekly')
      .lt('expires_at', new Date().toISOString());

    for (const archive of expired || []) {
      const filePaths = (archive.files as any[]).map((f) => f.path);
      if (filePaths.length > 0) {
        await supabase.storage.from('data-exports').remove(filePaths);
      }
      await supabase.from('data_export_archives').delete().eq('id', archive.id);
      cleanedCount++;
    }

    if (cleanedCount > 0) {
      console.log(`[DATA-EXPORT] Cleaned up ${cleanedCount} expired archive(s)`);
    }

    // -----------------------------------------------------------------------
    // Done
    // -----------------------------------------------------------------------

    const elapsed = Date.now() - startTime;
    console.log(`[DATA-EXPORT] Cron completed in ${elapsed}ms`);

    return NextResponse.json({
      success: true,
      exported: filesList.length,
      totalRecords,
      totalSize,
      dateLabel,
      cleaned: cleanedCount,
    });
  } catch (err) {
    const elapsed = Date.now() - startTime;
    console.error(`[DATA-EXPORT] Cron failed after ${elapsed}ms:`, (err as Error)?.message || err);
    return NextResponse.json(
      { error: 'Internal server error', message: (err as Error)?.message },
      { status: 500 }
    );
  }
}
