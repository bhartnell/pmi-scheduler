import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/student/my-progress
 *
 * Returns an aggregated progress snapshot for the authenticated student:
 *   - progress overview (skills, scenarios, clinical hours, attendance)
 *   - skills completion grouped by category
 *   - scenario assessment history
 *   - clinical hours summary
 *   - attendance record
 *   - compliance documents
 *   - upcoming labs
 *
 * Access: student role only. Data is always scoped to the requesting student.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // -----------------------------------------------
    // 1. Resolve lab_users record by email
    // -----------------------------------------------
    const { data: labUser, error: labUserError } = await supabase
      .from('lab_users')
      .select('id, email, role, name')
      .ilike('email', session.user.email)
      .single();

    if (labUserError || !labUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (labUser.role !== 'student') {
      return NextResponse.json(
        { error: 'Access denied: student role required' },
        { status: 403 }
      );
    }

    // -----------------------------------------------
    // 2. Resolve students record by email
    // -----------------------------------------------
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select(`
        id,
        first_name,
        last_name,
        email,
        status,
        cohort_id,
        cohort:cohorts(
          id,
          cohort_number,
          program:programs(name, abbreviation)
        )
      `)
      .ilike('email', session.user.email)
      .single();

    if (studentError || !student) {
      // No student record yet - return placeholder empty data
      return NextResponse.json({
        success: true,
        studentFound: false,
        message: 'Student record not found. Please contact your instructor.',
        overview: {
          skillsCompleted: 0,
          skillsTotal: 0,
          scenariosAssessed: 0,
          clinicalHours: 0,
          clinicalHoursRequired: 0,
          attendancePresent: 0,
          attendanceTotal: 0,
          attendanceRate: 0,
        },
        skills: [],
        scenarios: [],
        clinicalHours: null,
        attendance: [],
        compliance: [],
        upcomingLabs: [],
      });
    }

    const studentId = student.id;

    // -----------------------------------------------
    // 3. Skills completion
    //    skill_signoffs joined with skills (if exists)
    // -----------------------------------------------
    let skills: any[] = [];
    let skillsTotal = 0;
    let skillsCompleted = 0;

    try {
      // Fetch all skill signoffs for this student
      const { data: signoffs } = await supabase
        .from('skill_signoffs')
        .select(`
          id,
          skill_id,
          signed_off_by,
          signed_off_at,
          revoked_at,
          skill:skills(id, name, category, description)
        `)
        .eq('student_id', studentId)
        .is('revoked_at', null)
        .order('signed_off_at', { ascending: false });

      // Also fetch all skills to show the complete list
      const { data: allSkills } = await supabase
        .from('skills')
        .select('id, name, category, description, is_active')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (allSkills && allSkills.length > 0) {
        skillsTotal = allSkills.length;

        // Build a map of signed-off skill IDs
        const signoffMap = new Map<string, any>();
        (signoffs || []).forEach((s: any) => {
          signoffMap.set(s.skill_id, s);
        });

        skills = allSkills.map((skill: any) => {
          const signoff = signoffMap.get(skill.id);
          return {
            id: skill.id,
            name: skill.name,
            category: skill.category || 'other',
            description: skill.description || null,
            completed: !!signoff,
            signedOffAt: signoff?.signed_off_at || null,
            signedOffBy: signoff?.signed_off_by || null,
          };
        });

        skillsCompleted = skills.filter((s) => s.completed).length;
      } else if (signoffs && signoffs.length > 0) {
        // No skills table yet but signoffs exist - surface them as-is
        skills = (signoffs || []).map((s: any) => ({
          id: s.skill_id,
          name: (s.skill as any)?.name || 'Unknown Skill',
          category: (s.skill as any)?.category || 'other',
          description: (s.skill as any)?.description || null,
          completed: true,
          signedOffAt: s.signed_off_at,
          signedOffBy: s.signed_off_by,
        }));
        skillsCompleted = skills.length;
        skillsTotal = skills.length;
      }
    } catch {
      // Table may not exist yet - leave skills empty
    }

    // -----------------------------------------------
    // 4. Scenario assessment history
    //    scenario_assessments where team_lead_id = studentId
    // -----------------------------------------------
    let scenarios: any[] = [];
    let scenariosAssessed = 0;

    try {
      const { data: assessments } = await supabase
        .from('scenario_assessments')
        .select(`
          id,
          overall_score,
          pass_fail,
          created_at,
          lab_day:lab_days(id, date),
          station:lab_stations(
            id,
            scenario:scenarios(id, title, category)
          ),
          assessor:lab_users(name, email)
        `)
        .eq('team_lead_id', studentId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (assessments && assessments.length > 0) {
        scenariosAssessed = assessments.length;
        scenarios = assessments.map((a: any) => {
          const score = a.overall_score ?? null;
          const passed =
            a.pass_fail != null
              ? a.pass_fail
              : score != null
              ? score >= 70
              : null;
          return {
            id: a.id,
            scenarioTitle:
              (a.station as any)?.scenario?.title || 'Unknown Scenario',
            category: (a.station as any)?.scenario?.category || null,
            date: (a.lab_day as any)?.date || a.created_at,
            score: score,
            passed: passed,
            assessorName: (a.assessor as any)?.name || null,
          };
        });
      }
    } catch {
      // Table may not exist yet
    }

    // -----------------------------------------------
    // 5. Clinical hours summary
    //    student_clinical_hours (wide table, one row per student)
    // -----------------------------------------------
    let clinicalHours: any = null;

    try {
      const { data: hoursRecord } = await supabase
        .from('student_clinical_hours')
        .select(
          'id, psych_hours, psych_shifts, ed_hours, ed_shifts, icu_hours, icu_shifts, ob_hours, ob_shifts, or_hours, or_shifts, peds_ed_hours, peds_ed_shifts, peds_icu_hours, peds_icu_shifts, ems_field_hours, ems_field_shifts, cardiology_hours, cardiology_shifts, ems_ridealong_hours, ems_ridealong_shifts, total_hours, total_shifts, updated_at'
        )
        .eq('student_id', studentId)
        .maybeSingle();

      if (hoursRecord) {
        clinicalHours = hoursRecord;
      }
    } catch {
      // Table may not exist yet
    }

    const clinicalTotalHours = clinicalHours?.total_hours ?? 0;
    // Required hours are program-specific; we use a sensible default (108h for paramedic)
    const clinicalHoursRequired = 108;

    // -----------------------------------------------
    // 6. Attendance record
    //    lab_day_attendance for this student, joined with lab_days
    // -----------------------------------------------
    let attendance: any[] = [];
    let attendancePresent = 0;
    let attendanceTotal = 0;

    try {
      const { data: attendanceRecords } = await supabase
        .from('lab_day_attendance')
        .select(`
          id,
          status,
          notes,
          marked_at,
          lab_day:lab_days(id, date, title)
        `)
        .eq('student_id', studentId)
        .order('marked_at', { ascending: false })
        .limit(500);

      if (attendanceRecords && attendanceRecords.length > 0) {
        attendanceTotal = attendanceRecords.length;
        attendancePresent = attendanceRecords.filter(
          (r: any) => r.status === 'present' || r.status === 'late'
        ).length;

        attendance = attendanceRecords.map((r: any) => ({
          id: r.id,
          labDate: (r.lab_day as any)?.date || null,
          labTitle: (r.lab_day as any)?.title || null,
          status: r.status,
          notes: r.notes || null,
          markedAt: r.marked_at,
        }));
      }
    } catch {
      // Table may not exist yet
    }

    const attendanceRate =
      attendanceTotal > 0
        ? Math.round((attendancePresent / attendanceTotal) * 100)
        : 0;

    // -----------------------------------------------
    // 7. Compliance documents
    //    student_compliance_records + compliance_document_types (normalized)
    //    Falls back to student_compliance_docs wide-table if records absent
    // -----------------------------------------------
    let compliance: any[] = [];

    try {
      const { data: docTypes } = await supabase
        .from('compliance_document_types')
        .select('id, name, description, is_required, expiration_months, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      const { data: complianceRecords } = await supabase
        .from('student_compliance_records')
        .select('id, doc_type_id, status, expiration_date, notes, verified_at')
        .eq('student_id', studentId);

      if (docTypes && docTypes.length > 0) {
        const recordMap = new Map<string, any>();
        (complianceRecords || []).forEach((r: any) => {
          recordMap.set(r.doc_type_id, r);
        });

        compliance = docTypes.map((dt: any) => {
          const record = recordMap.get(dt.id);
          const now = new Date();
          let status = record?.status || 'missing';

          // Auto-derive expiring/expired from expiration_date if not set
          if (record?.expiration_date) {
            const exp = new Date(record.expiration_date);
            const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            if (exp < now) {
              status = 'expired';
            } else if (exp < thirtyDaysOut) {
              status = 'expiring';
            }
          }

          return {
            id: dt.id,
            name: dt.name,
            description: dt.description || null,
            isRequired: dt.is_required,
            status,
            expirationDate: record?.expiration_date || null,
            notes: record?.notes || null,
            verifiedAt: record?.verified_at || null,
          };
        });
      }
    } catch {
      // Tables may not exist yet
    }

    // -----------------------------------------------
    // 8. Upcoming labs
    //    lab_days where student cohort matches and date >= today
    // -----------------------------------------------
    let upcomingLabs: any[] = [];

    try {
      if (student.cohort_id) {
        const today = new Date().toISOString().split('T')[0];

        const { data: labDays } = await supabase
          .from('lab_days')
          .select('id, date, title, location, start_time, end_time')
          .eq('cohort_id', student.cohort_id)
          .gte('date', today)
          .order('date', { ascending: true })
          .limit(10);

        if (labDays && labDays.length > 0) {
          upcomingLabs = labDays.map((d: any) => ({
            id: d.id,
            date: d.date,
            title: d.title || null,
            location: d.location || null,
            startTime: d.start_time || null,
            endTime: d.end_time || null,
          }));
        }
      }
    } catch {
      // Table may not exist yet
    }

    // -----------------------------------------------
    // Build final response
    // -----------------------------------------------
    console.log(`[MY-PROGRESS] completed in ${Date.now() - startTime}ms`);
    return NextResponse.json({
      success: true,
      studentFound: true,
      student: {
        id: student.id,
        firstName: student.first_name,
        lastName: student.last_name,
        email: student.email,
        status: student.status,
        cohort: student.cohort
          ? {
              id: (student.cohort as any).id,
              cohortNumber: (student.cohort as any).cohort_number,
              program: (student.cohort as any).program,
            }
          : null,
      },
      overview: {
        skillsCompleted,
        skillsTotal,
        scenariosAssessed,
        clinicalHours: clinicalTotalHours,
        clinicalHoursRequired,
        attendancePresent,
        attendanceTotal,
        attendanceRate,
      },
      skills,
      scenarios,
      clinicalHours,
      attendance,
      compliance,
      upcomingLabs,
    });
  } catch (error) {
    console.error('Error fetching student progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress data' },
      { status: 500 }
    );
  }
}
