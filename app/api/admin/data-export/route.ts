import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';
import { logAuditEvent } from '@/lib/audit';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExportType = 'cohort' | 'students' | 'labs' | 'clinical' | 'assessments' | 'full_backup';
type ExportFormat = 'csv' | 'json';

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
// Helper: CSV escaping
// ---------------------------------------------------------------------------

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Quote the cell if it contains commas, quotes, or newlines
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCsvRow(row: Record<string, unknown>): string {
  return Object.values(row).map(csvCell).join(',');
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]).join(',');
  const body = rows.map(toCsvRow).join('\n');
  return headers + '\n' + body;
}

// ---------------------------------------------------------------------------
// Data Fetchers
// ---------------------------------------------------------------------------

async function fetchCohortData(supabase: ReturnType<typeof getSupabaseAdmin>, cohortId?: string | null) {
  let query = supabase
    .from('cohorts')
    .select(`
      *,
      program:programs(id, name, abbreviation),
      students(id, first_name, last_name, email, status, agency)
    `)
    .order('created_at', { ascending: false });

  if (cohortId) {
    query = query.eq('id', cohortId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function fetchStudentsData(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  cohortId?: string | null,
  startDate?: string | null,
  endDate?: string | null
) {
  let query = supabase
    .from('students')
    .select(`
      id,
      first_name,
      last_name,
      email,
      agency,
      status,
      cohort_id,
      created_at,
      cohort:cohorts(id, cohort_number, program:programs(name, abbreviation))
    `)
    .order('last_name', { ascending: true });

  if (cohortId) {
    query = query.eq('cohort_id', cohortId);
  }
  if (startDate) {
    query = query.gte('created_at', startDate);
  }
  if (endDate) {
    query = query.lte('created_at', endDate + 'T23:59:59');
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function fetchLabsData(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  cohortId?: string | null,
  startDate?: string | null,
  endDate?: string | null
) {
  let query = supabase
    .from('lab_days')
    .select(`
      id,
      date,
      cohort_id,
      is_active,
      created_at,
      cohort:cohorts(id, cohort_number, program:programs(name, abbreviation)),
      lab_stations(
        id,
        station_number,
        station_type,
        scenario_name,
        custom_title
      )
    `)
    .order('date', { ascending: false });

  if (cohortId) {
    query = query.eq('cohort_id', cohortId);
  }
  if (startDate) {
    query = query.gte('date', startDate);
  }
  if (endDate) {
    query = query.lte('date', endDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function fetchClinicalData(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  cohortId?: string | null,
  startDate?: string | null,
  endDate?: string | null
) {
  let query = supabase
    .from('student_internships')
    .select(`
      id,
      student_id,
      cohort_id,
      status,
      current_phase,
      shift_type,
      placement_date,
      internship_start_date,
      expected_end_date,
      created_at,
      students(id, first_name, last_name, email),
      cohorts(id, cohort_number, program:programs(name, abbreviation)),
      agencies(id, name, abbreviation)
    `)
    .order('created_at', { ascending: false });

  if (cohortId) {
    query = query.eq('cohort_id', cohortId);
  }
  if (startDate) {
    query = query.gte('created_at', startDate);
  }
  if (endDate) {
    query = query.lte('created_at', endDate + 'T23:59:59');
  }

  const { data: internships, error: internshipsError } = await query;
  if (internshipsError) throw internshipsError;

  // Also fetch clinical hours summary per student
  let hoursQuery = supabase
    .from('student_clinical_hours')
    .select(`
      id,
      student_id,
      cohort_id,
      total_hours,
      total_shifts,
      psych_hours,
      psych_shifts,
      ed_hours,
      ed_shifts,
      icu_hours,
      icu_shifts,
      ems_field_hours,
      ems_field_shifts,
      updated_at
    `)
    .order('updated_at', { ascending: false });

  if (cohortId) {
    hoursQuery = hoursQuery.eq('cohort_id', cohortId);
  }

  const { data: hours } = await hoursQuery;

  return { internships: internships || [], hours: hours || [] };
}

async function fetchAssessmentsData(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  cohortId?: string | null,
  startDate?: string | null,
  endDate?: string | null
) {
  // Scenario assessments
  let scenarioQuery = supabase
    .from('scenario_assessments')
    .select(`
      id,
      lab_station_id,
      lab_day_id,
      cohort_id,
      rotation_number,
      overall_score,
      flagged_for_review,
      issue_level,
      created_at
    `)
    .order('created_at', { ascending: false });

  if (cohortId) {
    scenarioQuery = scenarioQuery.eq('cohort_id', cohortId);
  }
  if (startDate) {
    scenarioQuery = scenarioQuery.gte('created_at', startDate);
  }
  if (endDate) {
    scenarioQuery = scenarioQuery.lte('created_at', endDate + 'T23:59:59');
  }

  const { data: scenarioAssessments } = await scenarioQuery;

  // Skill signoffs
  let skillQuery = supabase
    .from('skill_signoffs')
    .select(`
      id,
      student_id,
      skill_id,
      lab_day_id,
      signed_off_by,
      signed_off_at,
      revoked_at
    `)
    .order('signed_off_at', { ascending: false });

  if (startDate) {
    skillQuery = skillQuery.gte('signed_off_at', startDate);
  }
  if (endDate) {
    skillQuery = skillQuery.lte('signed_off_at', endDate + 'T23:59:59');
  }

  const { data: skillSignoffs } = await skillQuery;

  return {
    scenario_assessments: scenarioAssessments || [],
    skill_signoffs: skillSignoffs || [],
  };
}

// ---------------------------------------------------------------------------
// Flatten helpers: convert nested objects to flat rows for CSV
// ---------------------------------------------------------------------------

function flattenStudents(students: any[]): Record<string, unknown>[] {
  return students.map((s) => ({
    id: s.id,
    first_name: s.first_name,
    last_name: s.last_name,
    email: s.email,
    agency: s.agency,
    status: s.status,
    cohort_id: s.cohort_id,
    cohort_number: s.cohort?.cohort_number,
    program_name: s.cohort?.program?.name,
    program_abbreviation: s.cohort?.program?.abbreviation,
    created_at: s.created_at,
  }));
}

function flattenLabs(labDays: any[]): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const day of labDays) {
    // One row per lab day (no stations = still one row)
    if (!day.lab_stations || day.lab_stations.length === 0) {
      rows.push({
        lab_day_id: day.id,
        date: day.date,
        cohort_id: day.cohort_id,
        cohort_number: day.cohort?.cohort_number,
        program_name: day.cohort?.program?.name,
        is_active: day.is_active,
        station_id: null,
        station_number: null,
        station_type: null,
        scenario_name: null,
        custom_title: null,
        created_at: day.created_at,
      });
    } else {
      for (const station of day.lab_stations) {
        rows.push({
          lab_day_id: day.id,
          date: day.date,
          cohort_id: day.cohort_id,
          cohort_number: day.cohort?.cohort_number,
          program_name: day.cohort?.program?.name,
          is_active: day.is_active,
          station_id: station.id,
          station_number: station.station_number,
          station_type: station.station_type,
          scenario_name: station.scenario_name,
          custom_title: station.custom_title,
          created_at: day.created_at,
        });
      }
    }
  }
  return rows;
}

function flattenClinical(data: { internships: any[]; hours: any[] }): Record<string, unknown>[] {
  return data.internships.map((i) => ({
    internship_id: i.id,
    student_id: i.student_id,
    student_name: i.students ? `${i.students.first_name} ${i.students.last_name}` : '',
    student_email: i.students?.email,
    cohort_id: i.cohort_id,
    cohort_number: i.cohorts?.cohort_number,
    program_name: i.cohorts?.program?.name,
    agency_name: i.agencies?.name,
    status: i.status,
    current_phase: i.current_phase,
    shift_type: i.shift_type,
    placement_date: i.placement_date,
    internship_start_date: i.internship_start_date,
    expected_end_date: i.expected_end_date,
    created_at: i.created_at,
  }));
}

function flattenAssessments(data: { scenario_assessments: any[]; skill_signoffs: any[] }): Record<string, unknown>[] {
  // Normalize both types to a shared schema so CSV headers are consistent
  const scenarios = data.scenario_assessments.map((a) => ({
    type: 'scenario_assessment',
    id: a.id,
    lab_day_id: a.lab_day_id,
    lab_station_id: a.lab_station_id,
    cohort_id: a.cohort_id,
    student_id: null,
    skill_id: null,
    rotation_number: a.rotation_number,
    overall_score: a.overall_score,
    flagged_for_review: a.flagged_for_review,
    issue_level: a.issue_level,
    signed_off_by: null,
    signed_off_at: null,
    revoked_at: null,
    created_at: a.created_at,
  }));

  const skills = data.skill_signoffs.map((s) => ({
    type: 'skill_signoff',
    id: s.id,
    lab_day_id: s.lab_day_id,
    lab_station_id: null,
    cohort_id: null,
    student_id: s.student_id,
    skill_id: s.skill_id,
    rotation_number: null,
    overall_score: null,
    flagged_for_review: null,
    issue_level: null,
    signed_off_by: s.signed_off_by,
    signed_off_at: s.signed_off_at,
    revoked_at: s.revoked_at,
    created_at: s.signed_off_at,
  }));

  return [...scenarios, ...skills];
}

// ---------------------------------------------------------------------------
// GET /api/admin/data-export
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

    const searchParams = request.nextUrl.searchParams;
    const exportType = (searchParams.get('type') || 'students') as ExportType;
    const cohortId = searchParams.get('cohort_id') || null;
    const startDate = searchParams.get('start_date') || null;
    const endDate = searchParams.get('end_date') || null;
    const format = (searchParams.get('format') || 'csv') as ExportFormat;

    const validTypes: ExportType[] = ['cohort', 'students', 'labs', 'clinical', 'assessments', 'full_backup'];
    if (!validTypes.includes(exportType)) {
      return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
    }

    if (!['csv', 'json'].includes(format)) {
      return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    let fileContent = '';
    let filename = `pmi-export-${exportType}-${timestamp}`;
    let recordCount = 0;

    // ---------------------------------------------------------------------------
    // Build export data based on type
    // ---------------------------------------------------------------------------

    if (exportType === 'cohort') {
      const cohorts = await fetchCohortData(supabase, cohortId);
      recordCount = cohorts.length;

      if (format === 'json') {
        fileContent = JSON.stringify({ export_type: 'cohort', exported_at: new Date().toISOString(), data: cohorts }, null, 2);
      } else {
        // Flatten cohorts for CSV (one row per cohort, without nested students)
        const rows = cohorts.map((c: any) => ({
          id: c.id,
          cohort_number: c.cohort_number,
          program_name: c.program?.name,
          program_abbreviation: c.program?.abbreviation,
          is_active: c.is_active,
          is_archived: c.is_archived,
          start_date: c.start_date,
          expected_end_date: c.expected_end_date,
          current_semester: c.current_semester,
          student_count: Array.isArray(c.students) ? c.students.length : 0,
          created_at: c.created_at,
        }));
        fileContent = toCsv(rows);
      }

    } else if (exportType === 'students') {
      const students = await fetchStudentsData(supabase, cohortId, startDate, endDate);
      recordCount = students.length;

      if (format === 'json') {
        fileContent = JSON.stringify({ export_type: 'students', exported_at: new Date().toISOString(), data: students }, null, 2);
      } else {
        fileContent = toCsv(flattenStudents(students));
      }

    } else if (exportType === 'labs') {
      const labDays = await fetchLabsData(supabase, cohortId, startDate, endDate);
      recordCount = labDays.length;

      if (format === 'json') {
        fileContent = JSON.stringify({ export_type: 'labs', exported_at: new Date().toISOString(), data: labDays }, null, 2);
      } else {
        fileContent = toCsv(flattenLabs(labDays));
      }

    } else if (exportType === 'clinical') {
      const clinicalData = await fetchClinicalData(supabase, cohortId, startDate, endDate);
      recordCount = clinicalData.internships.length + clinicalData.hours.length;

      if (format === 'json') {
        fileContent = JSON.stringify({ export_type: 'clinical', exported_at: new Date().toISOString(), data: clinicalData }, null, 2);
      } else {
        // Internships CSV - one section
        const internshipsFlat = flattenClinical(clinicalData);
        // Hours CSV - separate table appended after
        const hourRows = clinicalData.hours.map((h: any) => ({
          id: h.id,
          student_id: h.student_id,
          cohort_id: h.cohort_id,
          total_hours: h.total_hours,
          total_shifts: h.total_shifts,
          psych_hours: h.psych_hours,
          psych_shifts: h.psych_shifts,
          ed_hours: h.ed_hours,
          ed_shifts: h.ed_shifts,
          icu_hours: h.icu_hours,
          icu_shifts: h.icu_shifts,
          ems_field_hours: h.ems_field_hours,
          ems_field_shifts: h.ems_field_shifts,
          updated_at: h.updated_at,
        }));
        const parts: string[] = [];
        if (internshipsFlat.length > 0) parts.push('# INTERNSHIPS\n' + toCsv(internshipsFlat));
        if (hourRows.length > 0) parts.push('\n# CLINICAL HOURS SUMMARY\n' + toCsv(hourRows));
        fileContent = parts.join('');
      }

    } else if (exportType === 'assessments') {
      const assessData = await fetchAssessmentsData(supabase, cohortId, startDate, endDate);
      recordCount = assessData.scenario_assessments.length + assessData.skill_signoffs.length;

      if (format === 'json') {
        fileContent = JSON.stringify({ export_type: 'assessments', exported_at: new Date().toISOString(), data: assessData }, null, 2);
      } else {
        fileContent = toCsv(flattenAssessments(assessData));
      }

    } else if (exportType === 'full_backup') {
      // All data combined
      const [cohorts, students, labDays, clinicalData, assessData] = await Promise.all([
        fetchCohortData(supabase, cohortId),
        fetchStudentsData(supabase, cohortId, startDate, endDate),
        fetchLabsData(supabase, cohortId, startDate, endDate),
        fetchClinicalData(supabase, cohortId, startDate, endDate),
        fetchAssessmentsData(supabase, cohortId, startDate, endDate),
      ]);

      recordCount =
        cohorts.length +
        students.length +
        labDays.length +
        clinicalData.internships.length +
        clinicalData.hours.length +
        assessData.scenario_assessments.length +
        assessData.skill_signoffs.length;

      if (format === 'json') {
        fileContent = JSON.stringify(
          {
            export_type: 'full_backup',
            exported_at: new Date().toISOString(),
            exported_by: currentUser.email,
            data: {
              cohorts,
              students,
              lab_days: labDays,
              clinical: clinicalData,
              assessments: assessData,
            },
          },
          null,
          2
        );
      } else {
        // For CSV full backup: separate sections with labels
        const sections: string[] = [];

        const cohortRows = cohorts.map((c: any) => ({
          section: 'cohort',
          id: c.id,
          cohort_number: c.cohort_number,
          program_name: c.program?.name,
          is_active: c.is_active,
          start_date: c.start_date,
          expected_end_date: c.expected_end_date,
        }));
        if (cohortRows.length > 0) sections.push('# COHORTS\n' + toCsv(cohortRows));

        const studentRows = flattenStudents(students);
        if (studentRows.length > 0) sections.push('\n# STUDENTS\n' + toCsv(studentRows));

        const labRows = flattenLabs(labDays);
        if (labRows.length > 0) sections.push('\n# LABS\n' + toCsv(labRows));

        const clinicalRows = flattenClinical(clinicalData);
        if (clinicalRows.length > 0) sections.push('\n# CLINICAL\n' + toCsv(clinicalRows));

        const assessRows = flattenAssessments(assessData);
        if (assessRows.length > 0) sections.push('\n# ASSESSMENTS\n' + toCsv(assessRows));

        fileContent = sections.join('');
      }
    }

    const fileSizeBytes = new TextEncoder().encode(fileContent).length;

    // ---------------------------------------------------------------------------
    // Log export to history
    // ---------------------------------------------------------------------------
    try {
      await supabase.from('data_export_history').insert({
        exported_by_email: currentUser.email,
        exported_by_name: currentUser.name,
        export_type: exportType,
        format,
        cohort_id: cohortId || null,
        start_date: startDate || null,
        end_date: endDate || null,
        record_count: recordCount,
        file_size_bytes: fileSizeBytes,
      });
    } catch (historyError) {
      // Don't fail the export if history logging fails
      console.error('Failed to log export history:', historyError);
    }

    // Log to audit log
    await logAuditEvent({
      user: { id: currentUser.id, email: currentUser.email, role: currentUser.role },
      action: 'export',
      resourceType: 'student_list',
      resourceDescription: `Exported ${exportType} data (${recordCount} records) as ${format.toUpperCase()}`,
      metadata: { exportType, format, cohortId, startDate, endDate, recordCount, fileSizeBytes },
    });

    // ---------------------------------------------------------------------------
    // Return file download
    // ---------------------------------------------------------------------------
    const extension = format === 'json' ? 'json' : 'csv';
    const contentType = format === 'json' ? 'application/json' : 'text/csv';
    filename = `${filename}.${extension}`;

    const response = new NextResponse(fileContent, {
      status: 200,
      headers: {
        'Content-Type': `${contentType}; charset=utf-8`,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(fileSizeBytes),
        'X-Export-Record-Count': String(recordCount),
        'X-Export-File-Size': String(fileSizeBytes),
      },
    });

    return response;
  } catch (error) {
    console.error('Error generating export:', error);
    return NextResponse.json({ error: 'Failed to generate export' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// GET recent export history (separate endpoint via query param)
// ---------------------------------------------------------------------------

// POST /api/admin/data-export  -> returns recent export history
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

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('data_export_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    return NextResponse.json({ success: true, history: data || [] });
  } catch (error) {
    console.error('Error fetching export history:', error);
    return NextResponse.json({ error: 'Failed to fetch export history' }, { status: 500 });
  }
}
