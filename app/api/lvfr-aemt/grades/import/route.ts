import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAgencyRole, canEditLVFR } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// CSV Parser (RFC 4180)
// ---------------------------------------------------------------------------
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  // Strip BOM
  const clean = text.replace(/^\uFEFF/, '');
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '"') {
      if (inQuotes && clean[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      if (current.trim()) lines.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);

  const splitRow = (line: string): string[] => {
    const fields: string[] = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') { field += '"'; i++; }
        else quoted = !quoted;
      } else if (ch === ',' && !quoted) {
        fields.push(field.trim());
        field = '';
      } else {
        field += ch;
      }
    }
    fields.push(field.trim());
    return fields;
  };

  if (lines.length === 0) return { headers: [], rows: [] };
  const [headerLine, ...dataLines] = lines;
  return {
    headers: splitRow(headerLine),
    rows: dataLines.map(splitRow),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function normalizeStr(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Student identifier column detection
const STUDENT_ID_PATTERNS = ['studentid', 'id', 'emstestingid', 'emstesting_id', 'userid'];
const LAST_NAME_PATTERNS = ['lastname', 'last', 'lname', 'surname'];
const FIRST_NAME_PATTERNS = ['firstname', 'first', 'fname', 'givenname'];
const EMAIL_PATTERNS = ['email', 'e-mail', 'emailaddress', 'studentemail'];

function detectStudentColumns(headers: string[]): {
  emstestingIdCol: number;
  lastNameCol: number;
  firstNameCol: number;
  emailCol: number;
  assessmentCols: number[];
} {
  let emstestingIdCol = -1;
  let lastNameCol = -1;
  let firstNameCol = -1;
  let emailCol = -1;
  const assessmentCols: number[] = [];

  for (let i = 0; i < headers.length; i++) {
    const norm = normalizeStr(headers[i]);
    if (STUDENT_ID_PATTERNS.some(p => norm === p || norm.includes(p))) {
      emstestingIdCol = i;
    } else if (LAST_NAME_PATTERNS.some(p => norm === p || norm.includes(p))) {
      lastNameCol = i;
    } else if (FIRST_NAME_PATTERNS.some(p => norm === p || norm.includes(p))) {
      firstNameCol = i;
    } else if (EMAIL_PATTERNS.some(p => norm === p || norm.includes(p))) {
      emailCol = i;
    } else {
      assessmentCols.push(i);
    }
  }

  return { emstestingIdCol, lastNameCol, firstNameCol, emailCol, assessmentCols };
}

function matchAssessment(
  columnHeader: string,
  assessments: { id: string; title: string; category: string }[]
): { id: string; title: string } | null {
  const normHeader = normalizeStr(columnHeader);
  if (!normHeader) return null;

  // Exact match
  for (const a of assessments) {
    if (normalizeStr(a.title) === normHeader) return { id: a.id, title: a.title };
  }

  // Partial match (header contains assessment title or vice versa)
  for (const a of assessments) {
    const normTitle = normalizeStr(a.title);
    if (normHeader.includes(normTitle) || normTitle.includes(normHeader)) {
      return { id: a.id, title: a.title };
    }
  }

  return null;
}

function parseScore(raw: string): number | null {
  if (!raw || raw.trim() === '') return null;
  const cleaned = raw.replace('%', '').trim();
  // Handle "34/40" format
  if (cleaned.includes('/')) {
    const [num, den] = cleaned.split('/').map(s => parseFloat(s.trim()));
    if (!isNaN(num) && !isNaN(den) && den > 0) {
      return Math.round((num / den) * 100 * 10) / 10;
    }
    return null;
  }
  const val = parseFloat(cleaned);
  if (isNaN(val)) return null;
  return val;
}

// ---------------------------------------------------------------------------
// POST /api/lvfr-aemt/grades/import
//
// Parse CSV text, match students/assessments, return preview.
// Body: { csvText, fileName }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (isAgencyRole(user.role)) {
    return NextResponse.json({ error: 'Agency roles are read-only' }, { status: 403 });
  }
  if (!canEditLVFR(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json();
  const { csvText, fileName } = body;

  if (!csvText) {
    return NextResponse.json({ error: 'csvText is required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Parse CSV
  const { headers, rows } = parseCSV(csvText);
  if (headers.length === 0 || rows.length === 0) {
    return NextResponse.json({ error: 'CSV appears empty or malformed' }, { status: 400 });
  }

  // Detect columns
  const cols = detectStudentColumns(headers);

  // Fetch assessments for matching
  const { data: assessments } = await supabase
    .from('lvfr_aemt_assessments')
    .select('id, title, category');
  const assessmentList = assessments || [];

  // Match assessment columns
  const assessmentMappings: { colIndex: number; colHeader: string; assessment: { id: string; title: string } | null }[] = [];
  for (const colIdx of cols.assessmentCols) {
    const matched = matchAssessment(headers[colIdx], assessmentList);
    assessmentMappings.push({ colIndex: colIdx, colHeader: headers[colIdx], assessment: matched });
  }

  // Fetch students for matching
  const { data: lvfrCohorts } = await supabase
    .from('cohorts')
    .select('id')
    .or('cohort_number.ilike.%LVFR%,cohort_number.ilike.%AEMT%');

  const cohortIds = (lvfrCohorts || []).map(c => c.id);

  const { data: dbStudents } = await supabase
    .from('students')
    .select('id, first_name, last_name, email, emstesting_id')
    .in('cohort_id', cohortIds.length > 0 ? cohortIds : ['__none__']);

  const studentList = dbStudents || [];

  // Fetch existing grades
  const { data: existingGrades } = await supabase
    .from('lvfr_aemt_grades')
    .select('student_id, assessment_id, score_percent');
  const existingMap = new Map<string, number>();
  for (const eg of existingGrades || []) {
    existingMap.set(`${eg.student_id}::${eg.assessment_id}`, eg.score_percent);
  }

  // Process each CSV row
  const previewStudents = rows.map((row, rowIndex) => {
    const csvEmstestingId = cols.emstestingIdCol >= 0 ? row[cols.emstestingIdCol]?.trim() || null : null;
    const csvLastName = cols.lastNameCol >= 0 ? row[cols.lastNameCol]?.trim() || '' : '';
    const csvFirstName = cols.firstNameCol >= 0 ? row[cols.firstNameCol]?.trim() || '' : '';
    const csvEmail = cols.emailCol >= 0 ? row[cols.emailCol]?.trim() || null : null;
    const csvName = `${csvLastName}, ${csvFirstName}`;

    // Match student
    let matchedStudent: typeof studentList[0] | null = null;
    let matchType: string | null = null;

    // Priority 1: emstesting_id
    if (csvEmstestingId) {
      matchedStudent = studentList.find(s => s.emstesting_id === csvEmstestingId) || null;
      if (matchedStudent) matchType = 'emstesting_id';
    }

    // Priority 2: email
    if (!matchedStudent && csvEmail) {
      matchedStudent = studentList.find(s => s.email?.toLowerCase() === csvEmail.toLowerCase()) || null;
      if (matchedStudent) matchType = 'email';
    }

    // Priority 3: exact name
    if (!matchedStudent && csvLastName && csvFirstName) {
      matchedStudent = studentList.find(
        s => s.last_name.toLowerCase() === csvLastName.toLowerCase() &&
             s.first_name.toLowerCase() === csvFirstName.toLowerCase()
      ) || null;
      if (matchedStudent) matchType = 'name_exact';
    }

    // Priority 4: fuzzy name (last name match + first initial)
    if (!matchedStudent && csvLastName) {
      matchedStudent = studentList.find(
        s => s.last_name.toLowerCase() === csvLastName.toLowerCase() &&
             csvFirstName && s.first_name.toLowerCase().startsWith(csvFirstName[0].toLowerCase())
      ) || null;
      if (matchedStudent) matchType = 'name_fuzzy';
    }

    // Build grades for this student
    const gradeEntries = assessmentMappings
      .filter(m => m.assessment)
      .map(m => {
        const rawScore = row[m.colIndex] || '';
        const scoreParsed = parseScore(rawScore);
        const key = matchedStudent ? `${matchedStudent.id}::${m.assessment!.id}` : '';
        const existingScore = existingMap.get(key) ?? null;

        return {
          assessmentColumn: m.colHeader,
          matchedAssessmentId: m.assessment!.id,
          matchedAssessmentTitle: m.assessment!.title,
          scoreRaw: rawScore,
          scoreParsed,
          conflict: existingScore !== null && scoreParsed !== null && existingScore !== scoreParsed,
          existingScore,
        };
      })
      .filter(g => g.scoreParsed !== null); // skip empty cells

    return {
      rowIndex,
      csvName,
      csvEmail: csvEmail,
      csvEmstestingId,
      matched: !!matchedStudent,
      matchedStudentId: matchedStudent?.id || null,
      matchedStudentName: matchedStudent ? `${matchedStudent.first_name} ${matchedStudent.last_name}` : null,
      matchType,
      grades: gradeEntries,
    };
  });

  const matchedAssessments = assessmentMappings.filter(m => m.assessment);
  const unmatchedAssessments = assessmentMappings.filter(m => !m.assessment).map(m => m.colHeader);

  const summary = {
    totalStudents: previewStudents.length,
    matchedStudents: previewStudents.filter(s => s.matched).length,
    unmatchedStudents: previewStudents.filter(s => !s.matched).length,
    totalGrades: previewStudents.reduce((sum, s) => sum + s.grades.length, 0),
    conflicts: previewStudents.reduce((sum, s) => sum + s.grades.filter(g => g.conflict).length, 0),
    assessmentsFound: matchedAssessments.length,
    assessmentsUnmatched: unmatchedAssessments,
    fileName: fileName || 'unknown',
  };

  return NextResponse.json({
    success: true,
    preview: { students: previewStudents, summary },
  });
}
