import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cohortId = searchParams.get('cohortId');

    if (!cohortId) {
      return NextResponse.json({ success: false, error: 'Cohort ID required' }, { status: 400 });
    }

    // Get all students in the cohort
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, first_name, last_name, email, phone, photo_url')
      .eq('cohort_id', cohortId)
      .order('last_name');

    if (studentsError) throw studentsError;

    const studentIds = students?.map(s => s.id) || [];

    if (studentIds.length === 0) {
      return NextResponse.json({
        success: true,
        stats: {
          totalStudents: 0,
          complianceComplete: 0,
          compliancePercent: 0,
          internshipsActive: 0,
          clinicalHoursTotal: 0,
          mceComplete: 0,
          mcePercent: 0,
        },
        alerts: { critical: [], warning: [], info: [] },
        students: [],
      });
    }

    // Fetch all related data in parallel
    const [
      internshipsResult,
      complianceDocsResult,
      clinicalHoursResult,
      mceModulesResult,
    ] = await Promise.all([
      supabase
        .from('student_internships')
        .select(`
          *,
          students (id, first_name, last_name),
          field_preceptors (first_name, last_name),
          agencies (name, abbreviation)
        `)
        .in('student_id', studentIds),
      supabase
        .from('student_compliance_docs')
        .select('*')
        .in('student_id', studentIds),
      supabase
        .from('student_clinical_hours')
        .select('*')
        .in('student_id', studentIds),
      supabase
        .from('student_mce_modules')
        .select('*')
        .in('student_id', studentIds),
    ]);

    // Log any errors but continue with available data
    if (internshipsResult.error) console.error('Internships query error:', internshipsResult.error.message);
    if (complianceDocsResult.error) console.error('Compliance docs query error:', complianceDocsResult.error.message);
    if (clinicalHoursResult.error) console.error('Clinical hours query error:', clinicalHoursResult.error.message);
    if (mceModulesResult.error) console.error('MCE modules query error:', mceModulesResult.error.message);

    const internships = internshipsResult.data || [];
    const complianceDocs = complianceDocsResult.data || [];
    const clinicalHours = clinicalHoursResult.data || [];
    const mceModules = mceModulesResult.data || [];

    // Calculate compliance stats
    const REQUIRED_DOCS = ['mmr', 'vzv', 'hepb', 'tdap', 'covid', 'tb', 'physical', 'insurance', 'bls', 'flu', 'hospital_orient', 'background', 'drug_test'];
    const totalDocsNeeded = studentIds.length * REQUIRED_DOCS.length;
    const completedDocs = complianceDocs?.filter(d => d.completed).length || 0;
    const compliancePercent = totalDocsNeeded > 0 ? Math.round((completedDocs / totalDocsNeeded) * 100) : 0;

    // Calculate mCE stats
    const MCE_MODULES = ['airway', 'respiratory', 'cardiovascular', 'trauma', 'medical', 'obstetrics', 'pediatrics', 'geriatrics', 'behavioral', 'toxicology', 'neurology', 'endocrine', 'immunology', 'infectious', 'operations'];
    const totalMceNeeded = studentIds.length * MCE_MODULES.length;
    const completedMce = mceModules?.filter(m => m.completed).length || 0;
    const mcePercent = totalMceNeeded > 0 ? Math.round((completedMce / totalMceNeeded) * 100) : 0;

    // Calculate clinical hours
    const totalHours = clinicalHours?.reduce((sum, h) => sum + (h.hours || 0), 0) || 0;

    // Calculate internship stats
    const activeInternships = internships?.filter(i => i.status !== 'completed' && i.status !== 'withdrawn').length || 0;

    // Build alerts
    const alerts: { critical: any[]; warning: any[]; info: any[] } = {
      critical: [],
      warning: [],
      info: [],
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check each student for issues
    students?.forEach(student => {
      const studentDocs = complianceDocs?.filter(d => d.student_id === student.id && d.completed) || [];
      const studentInternship = internships?.find(i => i.student_id === student.id);
      const studentMce = mceModules?.filter(m => m.student_id === student.id && m.completed) || [];
      const studentHours = clinicalHours?.filter(h => h.student_id === student.id) || [];

      const completedDocTypes = studentDocs.map(d => d.doc_type);
      const missingDocs = REQUIRED_DOCS.filter(doc => !completedDocTypes.includes(doc));

      // Critical: Missing required compliance docs
      if (missingDocs.length > 0) {
        alerts.critical.push({
          type: 'missing_compliance',
          student,
          message: `Missing ${missingDocs.length} compliance doc${missingDocs.length > 1 ? 's' : ''}`,
          details: missingDocs.slice(0, 3).map(d => d.toUpperCase()).join(', ') + (missingDocs.length > 3 ? '...' : ''),
          link: '/clinical/compliance',
        });
      }

      // Check internship milestones
      if (studentInternship) {
        // Overdue phase evaluations
        if (studentInternship.phase_1_eval_scheduled && !studentInternship.phase_1_eval_completed) {
          const evalDate = new Date(studentInternship.phase_1_eval_scheduled);
          if (evalDate < today) {
            alerts.critical.push({
              type: 'overdue_eval',
              student,
              internship: studentInternship,
              message: 'Phase 1 evaluation overdue',
              details: `Was due ${evalDate.toLocaleDateString()}`,
              link: `/clinical/internships/${studentInternship.id}`,
            });
          } else {
            const daysUntil = Math.ceil((evalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntil <= 7) {
              alerts.warning.push({
                type: 'upcoming_eval',
                student,
                internship: studentInternship,
                message: 'Phase 1 evaluation due soon',
                details: `Due in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`,
                link: `/clinical/internships/${studentInternship.id}`,
              });
            }
          }
        }

        if (studentInternship.phase_2_eval_scheduled && !studentInternship.phase_2_eval_completed) {
          const evalDate = new Date(studentInternship.phase_2_eval_scheduled);
          if (evalDate < today) {
            alerts.critical.push({
              type: 'overdue_eval',
              student,
              internship: studentInternship,
              message: 'Phase 2 evaluation overdue',
              details: `Was due ${evalDate.toLocaleDateString()}`,
              link: `/clinical/internships/${studentInternship.id}`,
            });
          } else {
            const daysUntil = Math.ceil((evalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntil <= 7) {
              alerts.warning.push({
                type: 'upcoming_eval',
                student,
                internship: studentInternship,
                message: 'Phase 2 evaluation due soon',
                details: `Due in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`,
                link: `/clinical/internships/${studentInternship.id}`,
              });
            }
          }
        }

        // At-risk students
        if (studentInternship.status === 'at_risk') {
          alerts.warning.push({
            type: 'at_risk',
            student,
            internship: studentInternship,
            message: 'Student marked at risk',
            details: studentInternship.agencies?.name || 'Unknown agency',
            link: `/clinical/internships/${studentInternship.id}`,
          });
        }
      } else {
        // No internship record - needs placement
        alerts.warning.push({
          type: 'needs_placement',
          student,
          message: 'Needs internship placement',
          details: 'No internship record',
          link: '/clinical/internships',
        });
      }

      // Low mCE completion
      const mceCompletion = Math.round((studentMce.length / MCE_MODULES.length) * 100);
      if (mceCompletion < 50) {
        alerts.info.push({
          type: 'low_mce',
          student,
          message: `mCE ${mceCompletion}% complete`,
          details: `${studentMce.length}/${MCE_MODULES.length} modules`,
          link: '/clinical/mce',
        });
      }

      // Low clinical hours
      const totalStudentHours = studentHours.reduce((sum, h) => sum + (h.hours || 0), 0);
      if (totalStudentHours < 24) {
        alerts.info.push({
          type: 'low_hours',
          student,
          message: `${totalStudentHours} clinical hours`,
          details: 'Below minimum',
          link: '/clinical/hours',
        });
      }
    });

    // Sort alerts by student name within each category
    const sortByStudent = (a: any, b: any) =>
      `${a.student.last_name} ${a.student.first_name}`.localeCompare(`${b.student.last_name} ${b.student.first_name}`);

    alerts.critical.sort(sortByStudent);
    alerts.warning.sort(sortByStudent);
    alerts.info.sort(sortByStudent);

    // Build student summaries
    const studentSummaries = students?.map(student => {
      const studentDocs = complianceDocs?.filter(d => d.student_id === student.id && d.completed) || [];
      const studentInternship = internships?.find(i => i.student_id === student.id);
      const studentMce = mceModules?.filter(m => m.student_id === student.id && m.completed) || [];
      const studentHours = clinicalHours?.filter(h => h.student_id === student.id) || [];

      return {
        ...student,
        complianceCount: studentDocs.length,
        complianceTotal: REQUIRED_DOCS.length,
        compliancePercent: Math.round((studentDocs.length / REQUIRED_DOCS.length) * 100),
        mceCount: studentMce.length,
        mceTotal: MCE_MODULES.length,
        mcePercent: Math.round((studentMce.length / MCE_MODULES.length) * 100),
        clinicalHours: studentHours.reduce((sum, h) => sum + (h.hours || 0), 0),
        internshipStatus: studentInternship?.status || 'none',
        internshipPhase: studentInternship?.current_phase || null,
        internshipId: studentInternship?.id || null,
        hasInternship: !!studentInternship,
      };
    }) || [];

    // Count students with 100% compliance
    const complianceComplete = studentSummaries.filter(s => s.compliancePercent === 100).length;
    const mceComplete = studentSummaries.filter(s => s.mcePercent === 100).length;

    return NextResponse.json({
      success: true,
      stats: {
        totalStudents: students?.length || 0,
        complianceComplete,
        compliancePercent,
        internshipsActive: activeInternships,
        internshipsTotal: internships?.length || 0,
        clinicalHoursTotal: Math.round(totalHours),
        mceComplete,
        mcePercent,
      },
      alerts,
      students: studentSummaries,
    });
  } catch (error) {
    console.error('Error fetching overview:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch overview data' }, { status: 500 });
  }
}
