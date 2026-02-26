import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

async function getCallerRole(email: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', email)
    .single();
  return data?.role ?? null;
}

// Compliance document columns in the wide-table
const DOC_COLUMNS = [
  { key: 'mmr_complete', label: 'MMR' },
  { key: 'vzv_complete', label: 'Varicella (VZV)' },
  { key: 'hep_b_complete', label: 'Hepatitis B' },
  { key: 'tdap_complete', label: 'Tdap' },
  { key: 'covid_complete', label: 'COVID-19' },
  { key: 'tb_test_1_complete', label: 'TB Test' },
  { key: 'physical_complete', label: 'Physical Exam' },
  { key: 'health_insurance_complete', label: 'Health Insurance' },
  { key: 'bls_complete', label: 'BLS Certification' },
  { key: 'flu_shot_complete', label: 'Flu Shot' },
  { key: 'hospital_orientation_complete', label: 'Hospital Orientation' },
  { key: 'background_check_complete', label: 'Background Check' },
  { key: 'drug_test_complete', label: 'Drug Test' },
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const callerRole = await getCallerRole(session.user.email);
  if (!callerRole || !hasMinRole(callerRole, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: studentId } = await params;

  try {
    const supabase = getSupabaseAdmin();

    // Fetch all portfolio data in parallel
    const [
      { data: student, error: studentError },
      { data: skillSignoffs },
      { data: scenarioAssessments },
      { data: summativeScores },
      { data: attendanceRecords },
      { data: complianceDoc },
      { data: complianceRecords },
      { data: clinicalHours },
      { data: teamLeadEntries },
    ] = await Promise.all([
      // Student info with cohort
      supabase
        .from('students')
        .select(`
          id,
          first_name,
          last_name,
          email,
          photo_url,
          status,
          agency,
          student_id,
          prior_cert_level,
          years_ems_experience,
          created_at,
          cohort:cohorts(
            id,
            cohort_number,
            start_date,
            expected_end_date,
            program:programs(name, abbreviation)
          )
        `)
        .eq('id', studentId)
        .single(),

      // Skill signoffs with skill names
      supabase
        .from('skill_signoffs')
        .select(`
          id,
          signed_off_at,
          signed_off_by,
          revoked_at,
          skill:skills!skill_id(id, name, category)
        `)
        .eq('student_id', studentId)
        .is('revoked_at', null)
        .order('signed_off_at', { ascending: true }),

      // Scenario assessments where student was team lead
      supabase
        .from('scenario_assessments')
        .select(`
          id,
          overall_score,
          created_at,
          lab_day_id,
          lab_day:lab_days(date, week_number, day_number),
          station:lab_stations!lab_station_id(
            station_number,
            scenario:scenarios(title, category)
          ),
          grader:lab_users!graded_by(name)
        `)
        .eq('team_lead_id', studentId)
        .order('created_at', { ascending: true }),

      // Summative evaluation scores
      supabase
        .from('summative_evaluation_scores')
        .select(`
          id,
          total_score,
          passed,
          grading_complete,
          graded_at,
          leadership_scene_score,
          patient_assessment_score,
          patient_management_score,
          interpersonal_score,
          integration_score,
          critical_criteria_failed,
          evaluation:summative_evaluations!evaluation_id(
            evaluation_date,
            examiner_name,
            scenario:summative_scenarios!scenario_id(title, scenario_number)
          )
        `)
        .eq('student_id', studentId)
        .order('graded_at', { ascending: true }),

      // Attendance records
      supabase
        .from('lab_day_attendance')
        .select(`
          id,
          status,
          notes,
          marked_at,
          lab_day:lab_days!lab_day_id(id, date, week_number, day_number)
        `)
        .eq('student_id', studentId)
        .order('marked_at', { ascending: true }),

      // Compliance wide-table
      supabase
        .from('student_compliance_docs')
        .select('*')
        .eq('student_id', studentId)
        .single(),

      // Normalized compliance records
      supabase
        .from('student_compliance_records')
        .select(`
          id,
          status,
          expiration_date,
          verified_at,
          doc_type:compliance_document_types!doc_type_id(name, is_required, expiration_months)
        `)
        .eq('student_id', studentId)
        .order('doc_type_id'),

      // Clinical hours by department
      supabase
        .from('student_clinical_hours')
        .select('department, hours, shifts')
        .eq('student_id', studentId),

      // Team lead log entries
      supabase
        .from('team_lead_log')
        .select(`
          id,
          date,
          lab_day:lab_days!lab_day_id(date, week_number, day_number),
          lab_station:lab_stations!lab_station_id(station_number, station_type)
        `)
        .eq('student_id', studentId)
        .order('date', { ascending: true }),
    ]);

    if (studentError || !student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // --- Process skills ---
    const skills = (skillSignoffs || []).map(s => {
      const skillData = s.skill as unknown as { id: string; name: string; category: string | null } | null;
      return {
        id: s.id,
        skill_name: skillData?.name || 'Unknown Skill',
        skill_category: skillData?.category || null,
        signed_off_at: s.signed_off_at,
        signed_off_by: s.signed_off_by,
      };
    });

    // --- Process scenario assessments ---
    const scoreToGrade = (score: number | null): string => {
      if (score === null || score === undefined) return 'N/A';
      if (score >= 4) return 'A';
      if (score >= 3) return 'B';
      if (score >= 2) return 'C';
      if (score >= 1) return 'D';
      return 'F';
    };

    const scenarios = (scenarioAssessments || []).map(a => {
      const stationData = a.station as unknown as { station_number: number; scenario: { title: string; category: string } | null } | null;
      const graderData = a.grader as unknown as { name: string } | null;
      const labDayData = a.lab_day as unknown as { date: string; week_number: number; day_number: number } | null;
      return {
        id: a.id,
        scenario_title: stationData?.scenario?.title || `Station ${stationData?.station_number || '?'}`,
        scenario_category: stationData?.scenario?.category || null,
        date: labDayData?.date || a.created_at,
        week_number: labDayData?.week_number || null,
        day_number: labDayData?.day_number || null,
        score: a.overall_score,
        grade: scoreToGrade(a.overall_score),
        instructor: graderData?.name || 'Unknown',
      };
    });

    // Average scenario score
    const scoredScenarios = scenarios.filter(s => s.score !== null);
    const avgScenarioScore = scoredScenarios.length > 0
      ? scoredScenarios.reduce((sum, s) => sum + (s.score || 0), 0) / scoredScenarios.length
      : null;

    // --- Process summative evaluations ---
    const summative = (summativeScores || []).map(s => {
      const evalData = s.evaluation as unknown as { evaluation_date: string; examiner_name: string; scenario: { title: string; scenario_number: number } | null } | null;
      return {
        id: s.id,
        scenario_title: evalData?.scenario?.title || `Scenario ${evalData?.scenario?.scenario_number || '?'}`,
        scenario_number: evalData?.scenario?.scenario_number || null,
        evaluation_date: evalData?.evaluation_date || null,
        examiner_name: evalData?.examiner_name || 'Unknown',
        total_score: s.total_score,
        passed: s.passed,
        grading_complete: s.grading_complete,
        graded_at: s.graded_at,
        scores: {
          leadership_scene: s.leadership_scene_score,
          patient_assessment: s.patient_assessment_score,
          patient_management: s.patient_management_score,
          interpersonal: s.interpersonal_score,
          integration: s.integration_score,
        },
        critical_criteria_failed: s.critical_criteria_failed,
      };
    });

    // --- Process attendance ---
    const attendanceList = (attendanceRecords || []).map(a => {
      const labDayData = a.lab_day as unknown as { id: string; date: string; week_number: number; day_number: number } | null;
      return {
        id: a.id,
        lab_day_date: labDayData?.date || null,
        week_number: labDayData?.week_number || null,
        day_number: labDayData?.day_number || null,
        status: a.status,
        notes: a.notes,
        marked_at: a.marked_at,
      };
    });

    const attendanceSummary = {
      total: attendanceList.length,
      present: attendanceList.filter(a => a.status === 'present').length,
      absent: attendanceList.filter(a => a.status === 'absent').length,
      excused: attendanceList.filter(a => a.status === 'excused').length,
      late: attendanceList.filter(a => a.status === 'late').length,
      records: attendanceList,
    };

    // --- Process compliance ---
    // First try normalized records, fall back to wide-table
    let complianceItems: { name: string; status: string; expiration_date: string | null; is_required: boolean }[] = [];

    if (complianceRecords && complianceRecords.length > 0) {
      complianceItems = complianceRecords.map(r => {
        const docType = r.doc_type as unknown as { name: string; is_required: boolean; expiration_months: number | null } | null;
        return {
          name: docType?.name || 'Unknown Document',
          status: r.status,
          expiration_date: r.expiration_date,
          is_required: docType?.is_required ?? true,
        };
      });
    } else if (complianceDoc) {
      // Fall back to wide-table format
      complianceItems = DOC_COLUMNS.map(col => ({
        name: col.label,
        status: complianceDoc[col.key] === true ? 'complete' : 'missing',
        expiration_date: null,
        is_required: true,
      }));
    }

    const complianceSummary = {
      total: complianceItems.length,
      complete: complianceItems.filter(c => c.status === 'complete').length,
      missing: complianceItems.filter(c => c.status === 'missing').length,
      expiring: complianceItems.filter(c => c.status === 'expiring').length,
      expired: complianceItems.filter(c => c.status === 'expired').length,
      items: complianceItems,
    };

    // --- Process clinical hours ---
    const totalClinicalHours = (clinicalHours || []).reduce((sum, h) => sum + (h.hours || 0), 0);
    const hoursByDept: Record<string, { hours: number; shifts: number }> = {};
    (clinicalHours || []).forEach(h => {
      if (h.department) {
        hoursByDept[h.department] = {
          hours: (hoursByDept[h.department]?.hours || 0) + (h.hours || 0),
          shifts: (hoursByDept[h.department]?.shifts || 0) + (h.shifts || 0),
        };
      }
    });

    const clinicalSummary = {
      totalHours: totalClinicalHours,
      totalShifts: (clinicalHours || []).reduce((sum, h) => sum + (h.shifts || 0), 0),
      byDepartment: hoursByDept,
    };

    // --- Process team lead log ---
    const teamLeadCount = (teamLeadEntries || []).length;

    return NextResponse.json({
      success: true,
      portfolio: {
        student,
        generatedAt: new Date().toISOString(),
        skills: {
          total: skills.length,
          items: skills,
        },
        scenarios: {
          total: scenarios.length,
          averageScore: avgScenarioScore,
          items: scenarios,
        },
        summativeEvaluations: {
          total: summative.length,
          passed: summative.filter(s => s.passed === true).length,
          items: summative,
        },
        attendance: attendanceSummary,
        compliance: complianceSummary,
        clinicalHours: clinicalSummary,
        teamLeadCount,
      },
    });
  } catch (error) {
    console.error('Error fetching student portfolio:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch portfolio' }, { status: 500 });
  }
}
