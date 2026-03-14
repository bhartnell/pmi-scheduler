import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/admin/data-exports - List all export archives
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const searchParams = request.nextUrl.searchParams;
    const exportType = searchParams.get('type'); // optional filter

    let query = supabase
      .from('data_export_archives')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (exportType) {
      query = query.eq('export_type', exportType);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, archives: data || [] });
  } catch (err) {
    console.error('GET /api/admin/data-exports error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/data-exports - Trigger a manual export or semester/course archive
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const body = await request.json();
    // body.action: 'manual' | 'semester_end' | 'course_end'
    // body.cohort_id?: string (for course_end)
    // body.label?: string (e.g., "Spring 2026")

    const supabase = getSupabaseAdmin();

    // Ensure bucket exists
    await supabase.storage.createBucket('data-exports', {
      public: false, fileSizeLimit: 52428800
    }).catch(() => {});

    const dateLabel = new Date().toISOString().slice(0, 10);
    let folderPath: string;
    let exportType: string;
    let label: string;
    let expiresAt: string | null = null;

    if (body.action === 'semester_end') {
      exportType = 'semester_end';
      label = body.label || `Semester Archive ${dateLabel}`;
      folderPath = `semester-end/${label.toLowerCase().replace(/\s+/g, '-')}`;
    } else if (body.action === 'course_end') {
      exportType = 'course_end';
      label = body.label || `Course Archive ${dateLabel}`;
      folderPath = `course-end/${label.toLowerCase().replace(/\s+/g, '-')}`;
    } else {
      exportType = 'manual';
      label = `Manual Export ${dateLabel}`;
      folderPath = `manual/${dateLabel}-${Date.now().toString(36)}`;
      expiresAt = null; // Manual exports don't expire
    }

    // Create archive record as in_progress
    const { data: archive, error: insertError } = await supabase
      .from('data_export_archives')
      .insert({
        export_type: exportType,
        label,
        cohort_id: body.cohort_id || null,
        folder_path: folderPath,
        files: [],
        created_by: user.email,
        expires_at: expiresAt,
        status: 'in_progress',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // CSV helper functions
    const csvCell = (v: unknown) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const toCsv = (rows: Record<string, unknown>[]) => {
      if (!rows.length) return '';
      return Object.keys(rows[0]).join(',') + '\n' + rows.map(r => Object.values(r).map(csvCell).join(',')).join('\n');
    };
    const flattenRow = (row: any) => {
      const flat: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          for (const [sk, sv] of Object.entries(v as Record<string, unknown>)) flat[`${k}_${sk}`] = sv;
        } else flat[k] = v;
      }
      return flat;
    };

    const filesList: { name: string; path: string; size: number; row_count: number }[] = [];
    let totalSize = 0;
    let totalRecords = 0;

    // Define queries - filter by cohort_id if provided
    const tables = [
      { name: 'students', query: () => {
        let q = supabase.from('students').select('id, first_name, last_name, email, cohort_id, status, agency, created_at');
        if (body.cohort_id) q = q.eq('cohort_id', body.cohort_id);
        return q;
      }},
      { name: 'cohorts', query: () => {
        let q = supabase.from('cohorts').select('*, program:programs(name, abbreviation)');
        if (body.cohort_id) q = q.eq('id', body.cohort_id);
        return q;
      }},
      { name: 'student_groups', query: () => {
        let q = supabase.from('student_groups').select('*');
        if (body.cohort_id) q = q.eq('cohort_id', body.cohort_id);
        return q;
      }},
      { name: 'station_completions', query: () => supabase.from('station_completions').select('*') },
      { name: 'scenario_assessments', query: () => {
        let q = supabase.from('scenario_assessments').select('*');
        if (body.cohort_id) q = q.eq('cohort_id', body.cohort_id);
        return q;
      }},
      { name: 'skill_assessments', query: () => {
        let q = supabase.from('skill_assessments').select('*');
        if (body.cohort_id) q = q.eq('cohort_id', body.cohort_id);
        return q;
      }},
      { name: 'student_clinical_hours', query: () => {
        let q = supabase.from('student_clinical_hours').select('*');
        if (body.cohort_id) q = q.eq('cohort_id', body.cohort_id);
        return q;
      }},
      { name: 'student_internships', query: () => {
        let q = supabase.from('student_internships').select('*, student:students(first_name, last_name), agency:agencies(name)');
        if (body.cohort_id) q = q.eq('cohort_id', body.cohort_id);
        return q;
      }},
      { name: 'skill_signoffs', query: () => supabase.from('skill_signoffs').select('*') },
    ];

    for (const table of tables) {
      try {
        const { data: rows } = await table.query();
        if (!rows || rows.length === 0) continue;

        const csvContent = toCsv(rows.map(flattenRow));
        const filePath = `${folderPath}/${table.name}.csv`;
        const size = new TextEncoder().encode(csvContent).length;

        await supabase.storage.from('data-exports').upload(filePath, csvContent, {
          contentType: 'text/csv',
          upsert: true,
        });

        filesList.push({ name: `${table.name}.csv`, path: filePath, size, row_count: rows.length });
        totalSize += size;
        totalRecords += rows.length;
      } catch (err) {
        console.error(`Error exporting ${table.name}:`, err);
      }
    }

    // Update archive record
    await supabase
      .from('data_export_archives')
      .update({
        files: filesList,
        total_size: totalSize,
        total_records: totalRecords,
        status: 'completed',
      })
      .eq('id', archive.id);

    return NextResponse.json({
      success: true,
      archive: { ...archive, files: filesList, total_size: totalSize, total_records: totalRecords, status: 'completed' }
    });
  } catch (err) {
    console.error('POST /api/admin/data-exports error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
