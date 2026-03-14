import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ImportType = 'students' | 'clinical_hours' | 'skill_evaluations' | 'attendance';

interface ColumnMapping {
  csvColumn: string;
  dbField: string;
}

interface PreviewRequest {
  importType: ImportType;
  rows: Record<string, string>[];
  headers: string[];
  columnMappings: ColumnMapping[];
}

interface MatchResult {
  row: Record<string, string>;
  rowIndex: number;
  matched: boolean;
  matchedId?: string;
  matchedName?: string;
  matchType?: string;
  issues: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Fuzzy matching helpers
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

  // Exact match first
  for (const c of candidates) {
    if (normalizeStr(c.name) === norm) return c;
  }

  // Levenshtein distance match (threshold: 30% of length)
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

    const body = (await request.json()) as PreviewRequest;
    const { importType, rows, columnMappings } = body;

    if (!importType || !rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing importType or rows' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Map CSV rows to DB fields using column mappings
    const mappedRows = rows.map((row) => {
      const mapped: Record<string, string> = {};
      for (const mapping of columnMappings) {
        if (mapping.csvColumn && mapping.dbField) {
          mapped[mapping.dbField] = row[mapping.csvColumn] || '';
        }
      }
      // Keep original row data for display
      mapped._original = JSON.stringify(row);
      return mapped;
    });

    let results: MatchResult[] = [];

    switch (importType) {
      case 'students':
        results = await previewStudents(supabase, mappedRows);
        break;
      case 'clinical_hours':
        results = await previewClinicalHours(supabase, mappedRows);
        break;
      case 'skill_evaluations':
        results = await previewSkillEvaluations(supabase, mappedRows);
        break;
      case 'attendance':
        results = await previewAttendance(supabase, mappedRows);
        break;
      default:
        return NextResponse.json(
          { success: false, error: `Unknown import type: ${importType}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      preview: results.slice(0, 10),
      totalRows: results.length,
      matchedCount: results.filter((r) => r.matched).length,
      issueCount: results.filter((r) => r.issues.length > 0).length,
      allResults: results,
    });
  } catch (error) {
    console.error('Data import preview error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to preview import data' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Preview: Students
// ---------------------------------------------------------------------------

async function previewStudents(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  rows: Record<string, string>[]
): Promise<MatchResult[]> {
  // Fetch existing students for duplicate detection
  const { data: existingStudents } = await supabase
    .from('students')
    .select('id, first_name, last_name, email');

  // Fetch cohorts for matching
  const { data: cohorts } = await supabase
    .from('cohorts')
    .select('id, cohort_number, program:programs(abbreviation)');

  const studentList = existingStudents || [];
  const cohortList = cohorts || [];

  return rows.map((row, idx) => {
    const issues: string[] = [];
    const warnings: string[] = [];
    let matched = false;
    let matchedId: string | undefined;
    let matchedName: string | undefined;
    let matchType: string | undefined;

    if (!row.first_name?.trim() && !row.last_name?.trim()) {
      issues.push('Missing name');
    }

    // Check email match
    if (row.email?.trim()) {
      const emailMatch = studentList.find(
        (s) => s.email?.toLowerCase() === row.email.toLowerCase().trim()
      );
      if (emailMatch) {
        matched = true;
        matchedId = emailMatch.id;
        matchedName = `${emailMatch.first_name} ${emailMatch.last_name}`;
        matchType = 'email (will update)';
      }
    }

    // Check name match if no email match
    if (!matched && row.first_name?.trim() && row.last_name?.trim()) {
      const nameMatch = studentList.find(
        (s) =>
          s.first_name?.toLowerCase() === row.first_name.toLowerCase().trim() &&
          s.last_name?.toLowerCase() === row.last_name.toLowerCase().trim()
      );
      if (nameMatch) {
        matched = true;
        matchedId = nameMatch.id;
        matchedName = `${nameMatch.first_name} ${nameMatch.last_name}`;
        matchType = 'name (will update)';
        warnings.push('Matched by name only — verify identity');
      }
    }

    if (!matched) {
      matchType = 'new student';
    }

    // Validate cohort
    if (row.cohort_number?.trim()) {
      const cohortNum = parseFloat(row.cohort_number.trim());
      const cohortMatch = cohortList.find(
        (c) => Number(c.cohort_number) === cohortNum
      );
      if (!cohortMatch) {
        issues.push(`Cohort #${row.cohort_number} not found`);
      }
    }

    return {
      row,
      rowIndex: idx,
      matched,
      matchedId,
      matchedName,
      matchType,
      issues,
      warnings,
    };
  });
}

// ---------------------------------------------------------------------------
// Preview: Clinical Hours
// ---------------------------------------------------------------------------

async function previewClinicalHours(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  rows: Record<string, string>[]
): Promise<MatchResult[]> {
  const { data: students } = await supabase
    .from('students')
    .select('id, first_name, last_name, email');

  const studentList = students || [];
  const studentCandidates = studentList.map((s) => ({
    id: s.id,
    name: `${s.first_name} ${s.last_name}`,
    email: s.email,
  }));

  return rows.map((row, idx) => {
    const issues: string[] = [];
    const warnings: string[] = [];
    let matched = false;
    let matchedId: string | undefined;
    let matchedName: string | undefined;
    let matchType: string | undefined;

    // Try email match first
    if (row.email?.trim()) {
      const emailMatch = studentCandidates.find(
        (s) => s.email?.toLowerCase() === row.email.toLowerCase().trim()
      );
      if (emailMatch) {
        matched = true;
        matchedId = emailMatch.id;
        matchedName = emailMatch.name;
        matchType = 'email';
      }
    }

    // Try name match
    if (!matched && row.student_name?.trim()) {
      const nameMatch = fuzzyMatch(row.student_name, studentCandidates);
      if (nameMatch) {
        matched = true;
        matchedId = nameMatch.id;
        matchedName = nameMatch.name;
        matchType = 'name (fuzzy)';
        if (normalizeStr(row.student_name) !== normalizeStr(nameMatch.name)) {
          warnings.push(`Fuzzy matched "${row.student_name}" to "${nameMatch.name}"`);
        }
      }
    }

    if (!matched) {
      issues.push('Could not match student');
    }

    // Validate hour fields are numeric
    const hourFields = [
      'ed_hours', 'icu_hours', 'ob_hours', 'or_hours', 'psych_hours',
      'peds_ed_hours', 'peds_icu_hours', 'ems_field_hours',
      'cardiology_hours', 'ems_ridealong_hours',
    ];
    for (const field of hourFields) {
      if (row[field]?.trim() && isNaN(parseFloat(row[field]))) {
        issues.push(`${field} is not a number: "${row[field]}"`);
      }
    }

    return {
      row,
      rowIndex: idx,
      matched,
      matchedId,
      matchedName,
      matchType,
      issues,
      warnings,
    };
  });
}

// ---------------------------------------------------------------------------
// Preview: Skill Evaluations
// ---------------------------------------------------------------------------

async function previewSkillEvaluations(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  rows: Record<string, string>[]
): Promise<MatchResult[]> {
  const { data: students } = await supabase
    .from('students')
    .select('id, first_name, last_name, email');

  const { data: skills } = await supabase
    .from('skills')
    .select('id, name, category');

  const studentList = (students || []).map((s) => ({
    id: s.id,
    name: `${s.first_name} ${s.last_name}`,
  }));

  const skillList = (skills || []).map((s) => ({
    id: s.id,
    name: s.name,
  }));

  return rows.map((row, idx) => {
    const issues: string[] = [];
    const warnings: string[] = [];
    let matched = false;
    let matchedId: string | undefined;
    let matchedName: string | undefined;
    let matchType: string | undefined;

    // Match student
    let studentMatch: { id: string; name: string } | null = null;
    if (row.student_name?.trim()) {
      studentMatch = fuzzyMatch(row.student_name, studentList);
      if (studentMatch) {
        matched = true;
        matchedId = studentMatch.id;
        matchedName = studentMatch.name;
        matchType = 'student matched';
        if (normalizeStr(row.student_name) !== normalizeStr(studentMatch.name)) {
          warnings.push(`Student fuzzy: "${row.student_name}" -> "${studentMatch.name}"`);
        }
      } else {
        issues.push(`Student not found: "${row.student_name}"`);
      }
    } else {
      issues.push('Missing student name');
    }

    // Match skill
    if (row.skill_name?.trim()) {
      const skillMatch = fuzzyMatch(row.skill_name, skillList);
      if (skillMatch) {
        if (normalizeStr(row.skill_name) !== normalizeStr(skillMatch.name)) {
          warnings.push(`Skill fuzzy: "${row.skill_name}" -> "${skillMatch.name}"`);
        }
      } else {
        issues.push(`Skill not found: "${row.skill_name}"`);
      }
    } else {
      issues.push('Missing skill name');
    }

    // Validate date
    if (row.date?.trim()) {
      const d = new Date(row.date);
      if (isNaN(d.getTime())) {
        issues.push(`Invalid date: "${row.date}"`);
      }
    }

    return {
      row,
      rowIndex: idx,
      matched,
      matchedId,
      matchedName,
      matchType,
      issues,
      warnings,
    };
  });
}

// ---------------------------------------------------------------------------
// Preview: Attendance
// ---------------------------------------------------------------------------

async function previewAttendance(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  rows: Record<string, string>[]
): Promise<MatchResult[]> {
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

  return rows.map((row, idx) => {
    const issues: string[] = [];
    const warnings: string[] = [];
    let matched = false;
    let matchedId: string | undefined;
    let matchedName: string | undefined;
    let matchType: string | undefined;

    // Match student
    if (row.student_name?.trim()) {
      const studentMatch = fuzzyMatch(row.student_name, studentList);
      if (studentMatch) {
        matched = true;
        matchedId = studentMatch.id;
        matchedName = studentMatch.name;
        matchType = 'student matched';
        if (normalizeStr(row.student_name) !== normalizeStr(studentMatch.name)) {
          warnings.push(`Student fuzzy: "${row.student_name}" -> "${studentMatch.name}"`);
        }
      } else {
        issues.push(`Student not found: "${row.student_name}"`);
      }
    } else {
      issues.push('Missing student name');
    }

    // Match lab day by date
    if (row.date?.trim()) {
      const inputDate = new Date(row.date);
      if (isNaN(inputDate.getTime())) {
        issues.push(`Invalid date: "${row.date}"`);
      } else {
        const dateStr = inputDate.toISOString().split('T')[0];
        const labDayMatch = labDayList.find((ld) => {
          if (!ld.date) return false;
          const ldDate = new Date(ld.date).toISOString().split('T')[0];
          return ldDate === dateStr;
        });
        if (!labDayMatch) {
          issues.push(`No lab day found for date: ${dateStr}`);
        }
      }
    } else {
      issues.push('Missing date');
    }

    // Validate status
    if (row.status?.trim()) {
      const validStatuses = ['present', 'absent', 'late', 'excused'];
      if (!validStatuses.includes(row.status.toLowerCase().trim())) {
        issues.push(`Invalid status: "${row.status}" (must be present/absent/late/excused)`);
      }
    }

    return {
      row,
      rowIndex: idx,
      matched,
      matchedId,
      matchedName,
      matchType,
      issues,
      warnings,
    };
  });
}
