import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/audit';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ImportType = 'students' | 'clinical_hours' | 'skill_evaluations' | 'attendance';

interface ColumnMapping {
  csvColumn: string;
  dbField: string;
}

interface ExecuteRequest {
  importType: ImportType;
  rows: Record<string, string>[];
  columnMappings: ColumnMapping[];
  fileName: string;
}

interface ImportRowResult {
  rowIndex: number;
  status: 'imported' | 'updated' | 'skipped' | 'failed';
  message?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeStr(s: string): string {
  return (s || '').toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

function fuzzyMatch(input: string, candidates: { id: string; name: string }[]): { id: string; name: string } | null {
  const norm = normalizeStr(input);
  if (!norm) return null;
  for (const c of candidates) {
    if (normalizeStr(c.name) === norm) return c;
  }
  let best: { id: string; name: string } | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const cn = normalizeStr(c.name);
    const dist = levenshtein(norm, cn);
    const threshold = Math.max(3, Math.floor(Math.max(norm.length, cn.length) * 0.3));
    if (dist < bestDist && dist <= threshold) {
      bestDist = dist;
      best = c;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const body = (await request.json()) as ExecuteRequest;
    const { importType, rows, columnMappings, fileName } = body;

    if (!importType || !rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing importType or rows' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Map CSV rows to DB fields
    const mappedRows = rows.map((row) => {
      const mapped: Record<string, string> = {};
      for (const mapping of columnMappings) {
        if (mapping.csvColumn && mapping.dbField) {
          mapped[mapping.dbField] = row[mapping.csvColumn] || '';
        }
      }
      return mapped;
    });

    let results: ImportRowResult[] = [];

    switch (importType) {
      case 'students':
        results = await executeStudents(supabase, mappedRows, user.email);
        break;
      case 'clinical_hours':
        results = await executeClinicalHours(supabase, mappedRows);
        break;
      case 'skill_evaluations':
        results = await executeSkillEvaluations(supabase, mappedRows, user.email);
        break;
      case 'attendance':
        results = await executeAttendance(supabase, mappedRows, user.email);
        break;
      default:
        return NextResponse.json(
          { success: false, error: `Unknown import type: ${importType}` },
          { status: 400 }
        );
    }

    const imported = results.filter((r) => r.status === 'imported').length;
    const updated = results.filter((r) => r.status === 'updated').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    const errorLog = results
      .filter((r) => r.status === 'failed')
      .map((r) => ({ row: r.rowIndex, message: r.message }));

    // Log to import_history
    await supabase.from('import_history').insert({
      import_type: importType,
      file_name: fileName || 'unknown.csv',
      records_total: rows.length,
      records_imported: imported + updated,
      records_failed: failed,
      error_log: errorLog.length > 0 ? errorLog : null,
      imported_by: user.email,
    });

    // Audit log
    await logAuditEvent({
      user: { email: user.email, role: user.role },
      action: 'create',
      resourceType: 'student_list',
      resourceId: importType,
      resourceDescription: `Data import (${importType}): ${imported} imported, ${updated} updated, ${failed} failed from ${fileName}`,
      metadata: {
        importType,
        fileName,
        total: rows.length,
        imported,
        updated,
        failed,
        skipped,
      },
    });

    return NextResponse.json({
      success: true,
      summary: { imported, updated, failed, skipped, total: rows.length },
      results,
    });
  } catch (error) {
    console.error('Data import execute error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to execute import' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Execute: Students
// ---------------------------------------------------------------------------

async function executeStudents(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  rows: Record<string, string>[],
  importerEmail: string
): Promise<ImportRowResult[]> {
  const { data: existingStudents } = await supabase
    .from('students')
    .select('id, first_name, last_name, email');

  const { data: cohorts } = await supabase
    .from('cohorts')
    .select('id, cohort_number');

  const studentList = existingStudents || [];
  const cohortList = cohorts || [];
  const results: ImportRowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (!row.first_name?.trim() || !row.last_name?.trim()) {
        results.push({ rowIndex: i, status: 'skipped', message: 'Missing name' });
        continue;
      }

      // Resolve cohort
      let cohortId: string | null = null;
      if (row.cohort_number?.trim()) {
        const cohortNum = parseInt(row.cohort_number.trim());
        const cohortMatch = cohortList.find((c) => c.cohort_number === cohortNum);
        if (cohortMatch) {
          cohortId = cohortMatch.id;
        } else {
          results.push({ rowIndex: i, status: 'failed', message: `Cohort #${row.cohort_number} not found` });
          continue;
        }
      }

      // Check for existing student by email
      let existingStudent = null;
      if (row.email?.trim()) {
        existingStudent = studentList.find(
          (s) => s.email?.toLowerCase() === row.email.toLowerCase().trim()
        );
      }

      // Check for existing student by name
      if (!existingStudent && row.first_name?.trim() && row.last_name?.trim()) {
        existingStudent = studentList.find(
          (s) =>
            s.first_name?.toLowerCase() === row.first_name.toLowerCase().trim() &&
            s.last_name?.toLowerCase() === row.last_name.toLowerCase().trim()
        );
      }

      const studentData: Record<string, unknown> = {
        first_name: row.first_name.trim(),
        last_name: row.last_name.trim(),
      };
      if (row.email?.trim()) studentData.email = row.email.trim();
      if (cohortId) studentData.cohort_id = cohortId;
      if (row.status?.trim()) studentData.status = row.status.trim().toLowerCase();
      if (row.agency?.trim()) studentData.agency = row.agency.trim();
      if (row.phone?.trim()) studentData.phone = row.phone.trim();

      if (existingStudent) {
        // Update
        const { error } = await supabase
          .from('students')
          .update(studentData)
          .eq('id', existingStudent.id);
        if (error) throw error;
        results.push({ rowIndex: i, status: 'updated', message: `Updated ${existingStudent.first_name} ${existingStudent.last_name}` });
      } else {
        // Insert
        const { error } = await supabase
          .from('students')
          .insert(studentData);
        if (error) throw error;
        results.push({ rowIndex: i, status: 'imported', message: `Created ${row.first_name} ${row.last_name}` });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      results.push({ rowIndex: i, status: 'failed', message: msg });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Execute: Clinical Hours
// ---------------------------------------------------------------------------

async function executeClinicalHours(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  rows: Record<string, string>[]
): Promise<ImportRowResult[]> {
  const { data: students } = await supabase
    .from('students')
    .select('id, first_name, last_name, email, cohort_id');

  const studentList = (students || []).map((s) => ({
    id: s.id,
    name: `${s.first_name} ${s.last_name}`,
    email: s.email,
    cohort_id: s.cohort_id,
  }));

  const results: ImportRowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      // Match student
      let student = null;
      if (row.email?.trim()) {
        student = studentList.find(
          (s) => s.email?.toLowerCase() === row.email.toLowerCase().trim()
        );
      }
      if (!student && row.student_name?.trim()) {
        student = fuzzyMatch(row.student_name, studentList) as typeof studentList[number] | null;
      }

      if (!student) {
        results.push({ rowIndex: i, status: 'failed', message: 'Student not found' });
        continue;
      }

      const hoursData: Record<string, unknown> = {
        student_id: student.id,
        cohort_id: student.cohort_id,
      };

      const hourFields = [
        'ed_hours', 'icu_hours', 'ob_hours', 'or_hours', 'psych_hours',
        'peds_ed_hours', 'peds_icu_hours', 'ems_field_hours',
        'cardiology_hours', 'ems_ridealong_hours',
      ];
      const shiftFields = [
        'ed_shifts', 'icu_shifts', 'ob_shifts', 'or_shifts', 'psych_shifts',
        'peds_ed_shifts', 'peds_icu_shifts', 'ems_field_shifts',
        'cardiology_shifts', 'ems_ridealong_shifts',
      ];

      for (const field of hourFields) {
        if (row[field]?.trim()) {
          const val = parseFloat(row[field]);
          if (!isNaN(val)) hoursData[field] = val;
        }
      }
      for (const field of shiftFields) {
        if (row[field]?.trim()) {
          const val = parseInt(row[field]);
          if (!isNaN(val)) hoursData[field] = val;
        }
      }

      // Calculate totals
      let totalHours = 0;
      let totalShifts = 0;
      for (const field of hourFields) {
        if (typeof hoursData[field] === 'number') totalHours += hoursData[field] as number;
      }
      for (const field of shiftFields) {
        if (typeof hoursData[field] === 'number') totalShifts += hoursData[field] as number;
      }
      if (row.total_hours?.trim()) {
        totalHours = parseFloat(row.total_hours) || totalHours;
      }
      if (row.total_shifts?.trim()) {
        totalShifts = parseInt(row.total_shifts) || totalShifts;
      }
      hoursData.total_hours = totalHours;
      hoursData.total_shifts = totalShifts;

      // Upsert by student_id
      const { data: existing } = await supabase
        .from('student_clinical_hours')
        .select('id')
        .eq('student_id', student.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('student_clinical_hours')
          .update(hoursData)
          .eq('id', existing.id);
        if (error) throw error;
        results.push({ rowIndex: i, status: 'updated', message: `Updated hours for ${student.name}` });
      } else {
        const { error } = await supabase
          .from('student_clinical_hours')
          .insert(hoursData);
        if (error) throw error;
        results.push({ rowIndex: i, status: 'imported', message: `Created hours for ${student.name}` });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      results.push({ rowIndex: i, status: 'failed', message: msg });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Execute: Skill Evaluations
// ---------------------------------------------------------------------------

async function executeSkillEvaluations(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  rows: Record<string, string>[],
  importerEmail: string
): Promise<ImportRowResult[]> {
  const { data: students } = await supabase
    .from('students')
    .select('id, first_name, last_name');

  const { data: skills } = await supabase
    .from('skills')
    .select('id, name');

  const studentList = (students || []).map((s) => ({
    id: s.id,
    name: `${s.first_name} ${s.last_name}`,
  }));

  const skillList = (skills || []).map((s) => ({
    id: s.id,
    name: s.name,
  }));

  const results: ImportRowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      // Match student
      const studentMatch = row.student_name?.trim()
        ? fuzzyMatch(row.student_name, studentList)
        : null;
      if (!studentMatch) {
        results.push({ rowIndex: i, status: 'failed', message: `Student not found: "${row.student_name}"` });
        continue;
      }

      // Match skill
      const skillMatch = row.skill_name?.trim()
        ? fuzzyMatch(row.skill_name, skillList)
        : null;
      if (!skillMatch) {
        results.push({ rowIndex: i, status: 'failed', message: `Skill not found: "${row.skill_name}"` });
        continue;
      }

      const signoffData: Record<string, unknown> = {
        student_id: studentMatch.id,
        skill_id: skillMatch.id,
        signed_off_by: row.evaluator?.trim() || importerEmail,
        signed_off_at: row.date?.trim() ? new Date(row.date).toISOString() : new Date().toISOString(),
      };

      // Upsert by unique constraint (student_id, skill_id)
      const { data: existing } = await supabase
        .from('skill_signoffs')
        .select('id')
        .eq('student_id', studentMatch.id)
        .eq('skill_id', skillMatch.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('skill_signoffs')
          .update(signoffData)
          .eq('id', existing.id);
        if (error) throw error;
        results.push({ rowIndex: i, status: 'updated', message: `Updated ${skillMatch.name} for ${studentMatch.name}` });
      } else {
        const { error } = await supabase
          .from('skill_signoffs')
          .insert(signoffData);
        if (error) throw error;
        results.push({ rowIndex: i, status: 'imported', message: `Signed off ${skillMatch.name} for ${studentMatch.name}` });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      results.push({ rowIndex: i, status: 'failed', message: msg });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Execute: Attendance
// ---------------------------------------------------------------------------

async function executeAttendance(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  rows: Record<string, string>[],
  importerEmail: string
): Promise<ImportRowResult[]> {
  const { data: students } = await supabase
    .from('students')
    .select('id, first_name, last_name');

  const { data: labDays } = await supabase
    .from('lab_days')
    .select('id, date, title');

  const studentList = (students || []).map((s) => ({
    id: s.id,
    name: `${s.first_name} ${s.last_name}`,
  }));

  const labDayList = labDays || [];
  const results: ImportRowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      // Match student
      const studentMatch = row.student_name?.trim()
        ? fuzzyMatch(row.student_name, studentList)
        : null;
      if (!studentMatch) {
        results.push({ rowIndex: i, status: 'failed', message: `Student not found: "${row.student_name}"` });
        continue;
      }

      // Match lab day by date
      if (!row.date?.trim()) {
        results.push({ rowIndex: i, status: 'failed', message: 'Missing date' });
        continue;
      }

      const inputDate = new Date(row.date);
      if (isNaN(inputDate.getTime())) {
        results.push({ rowIndex: i, status: 'failed', message: `Invalid date: "${row.date}"` });
        continue;
      }

      const dateStr = inputDate.toISOString().split('T')[0];
      const labDayMatch = labDayList.find((ld) => {
        if (!ld.date) return false;
        const ldDate = new Date(ld.date).toISOString().split('T')[0];
        return ldDate === dateStr;
      });

      if (!labDayMatch) {
        results.push({ rowIndex: i, status: 'failed', message: `No lab day for date: ${dateStr}` });
        continue;
      }

      // Validate status
      const status = (row.status?.trim() || 'present').toLowerCase();
      const validStatuses = ['present', 'absent', 'late', 'excused'];
      if (!validStatuses.includes(status)) {
        results.push({ rowIndex: i, status: 'failed', message: `Invalid status: "${row.status}"` });
        continue;
      }

      const attendanceData = {
        lab_day_id: labDayMatch.id,
        student_id: studentMatch.id,
        status,
        marked_by: importerEmail,
      };

      // Upsert by unique (lab_day_id, student_id)
      const { data: existing } = await supabase
        .from('lab_day_attendance')
        .select('id')
        .eq('lab_day_id', labDayMatch.id)
        .eq('student_id', studentMatch.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('lab_day_attendance')
          .update(attendanceData)
          .eq('id', existing.id);
        if (error) throw error;
        results.push({ rowIndex: i, status: 'updated', message: `Updated attendance for ${studentMatch.name} on ${dateStr}` });
      } else {
        const { error } = await supabase
          .from('lab_day_attendance')
          .insert(attendanceData);
        if (error) throw error;
        results.push({ rowIndex: i, status: 'imported', message: `Recorded ${status} for ${studentMatch.name} on ${dateStr}` });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      results.push({ rowIndex: i, status: 'failed', message: msg });
    }
  }

  return results;
}
