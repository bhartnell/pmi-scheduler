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

    // Fetch all students with their cohort info
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select(`
        id,
        first_name,
        last_name,
        email,
        cohort_id,
        status,
        cohorts (
          id,
          cohort_number,
          semester,
          start_date,
          programs (
            id,
            abbreviation
          )
        )
      `)
      .eq('status', 'active')
      .order('last_name')
      .order('first_name');

    if (studentsError) {
      console.error('Error fetching students:', studentsError);
      return NextResponse.json({ success: false, error: 'Failed to fetch students' }, { status: 500 });
    }

    // Fetch all internships
    const { data: internships, error: internshipsError } = await supabase
      .from('student_internships')
      .select('*');

    if (internshipsError) {
      console.error('Error fetching internships:', internshipsError);
    }

    // Fetch EMT tracking
    const { data: emtTracking, error: emtError } = await supabase
      .from('emt_student_tracking')
      .select('*');

    if (emtError) {
      console.error('Error fetching EMT tracking:', emtError);
    }

    // Fetch AEMT tracking
    const { data: aemtTracking, error: aemtError } = await supabase
      .from('aemt_student_tracking')
      .select('*');

    if (aemtError) {
      console.error('Error fetching AEMT tracking:', aemtError);
    }

    // Create lookup maps
    const internshipMap = new Map();
    (internships || []).forEach((i: any) => {
      internshipMap.set(i.student_id, i);
    });

    const emtTrackingMap = new Map();
    (emtTracking || []).forEach((t: any) => {
      emtTrackingMap.set(t.student_id, t);
    });

    const aemtTrackingMap = new Map();
    (aemtTracking || []).forEach((t: any) => {
      aemtTrackingMap.set(t.student_id, t);
    });

    // Process students
    const alerts: { critical: any[]; warning: any[]; info: any[] } = {
      critical: [],
      warning: [],
      info: [],
    };

    const processedStudents = (students || []).map((student: any) => {
      const cohort = student.cohorts;
      const program = cohort?.programs?.abbreviation || 'Unknown';
      const internship = internshipMap.get(student.id);
      const emtTrack = emtTrackingMap.get(student.id);
      const aemtTrack = aemtTrackingMap.get(student.id);

      // Determine clinical status
      let clinicalStatus: string = 'not_started';
      let nextDueDate: string | null = null;
      let nextDueType: string | null = null;

      if (program === 'PMD') {
        // Paramedic students - check internship status
        if (internship) {
          if (internship.cleared_for_nremt || internship.status === 'completed') {
            clinicalStatus = 'completed';
          } else if (internship.internship_start_date) {
            clinicalStatus = 'active_internship';

            // Determine next due based on phase
            if (internship.current_phase === 'phase_1_mentorship' && !internship.phase_1_eval_completed) {
              nextDueDate = internship.phase_1_eval_scheduled;
              nextDueType = 'P1 Eval';
            } else if (internship.current_phase === 'phase_2_evaluation' && !internship.phase_2_eval_completed) {
              nextDueDate = internship.phase_2_eval_scheduled;
              nextDueType = 'P2 Eval';
            } else if (!internship.closeout_completed) {
              nextDueDate = internship.closeout_meeting_date;
              nextDueType = 'Closeout';
            }

            // Check for overdue evaluations (alert)
            if (internship.phase_1_eval_scheduled && !internship.phase_1_eval_completed) {
              const evalDate = new Date(internship.phase_1_eval_scheduled);
              if (evalDate < new Date()) {
                alerts.critical.push({
                  type: 'overdue_eval',
                  student: { id: student.id, first_name: student.first_name, last_name: student.last_name },
                  message: 'Phase 1 evaluation overdue',
                  details: `Scheduled for ${evalDate.toLocaleDateString()}`,
                  link: `/clinical/internships/${internship.id}`,
                });
              }
            }
          } else if (internship.placement_date || internship.orientation_date) {
            clinicalStatus = 'preparing';
            nextDueDate = internship.orientation_date || internship.placement_date;
            nextDueType = 'Orientation';
          } else {
            clinicalStatus = 'preparing';
          }
        }
      } else if (program === 'AEMT') {
        // AEMT students - check AEMT tracking
        if (aemtTrack) {
          const allComplete = aemtTrack.mce_complete && aemtTrack.vax_complete &&
                            aemtTrack.ride_along_complete && aemtTrack.clinical_1_complete &&
                            aemtTrack.clinical_2_complete && aemtTrack.clinical_3_complete &&
                            aemtTrack.vitals_complete;
          if (allComplete) {
            clinicalStatus = 'completed';
          } else if (aemtTrack.clinical_1_complete || aemtTrack.clinical_2_complete || aemtTrack.clinical_3_complete || aemtTrack.ride_along_complete) {
            clinicalStatus = 'active_clinicals';
          } else if (aemtTrack.mce_complete || aemtTrack.vax_complete) {
            clinicalStatus = 'preparing';
          }
        }
      } else if (program === 'EMT') {
        // EMT students - check EMT tracking
        if (emtTrack) {
          const allComplete = emtTrack.mce_complete && emtTrack.vax_complete &&
                            emtTrack.ride_along_complete && emtTrack.vitals_complete;
          if (allComplete) {
            clinicalStatus = 'completed';
          } else if (emtTrack.ride_along_complete) {
            clinicalStatus = 'active_clinicals';
          } else if (emtTrack.mce_complete || emtTrack.vax_complete) {
            clinicalStatus = 'preparing';
          }
        }
      }

      // Check EMT/AEMT tracking completion
      const emtTrackingComplete = emtTrack ?
        (emtTrack.mce_complete && emtTrack.vax_complete && emtTrack.ride_along_complete && emtTrack.vitals_complete) : false;

      const aemtTrackingComplete = aemtTrack ?
        (aemtTrack.mce_complete && aemtTrack.vax_complete && aemtTrack.ride_along_complete &&
         aemtTrack.clinical_1_complete && aemtTrack.clinical_2_complete && aemtTrack.clinical_3_complete &&
         aemtTrack.vitals_complete) : false;

      return {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email,
        cohort_id: student.cohort_id,
        program,
        cohort_number: cohort?.cohort_number || null,
        semester: cohort?.semester || null,
        clinicalStatus,
        internshipId: internship?.id || null,
        internshipStatus: internship?.status || null,
        internshipPhase: internship?.current_phase || null,
        internshipStartDate: internship?.internship_start_date || null,
        clearedForNremt: internship?.cleared_for_nremt || false,
        nextDueDate,
        nextDueType,
        emtTrackingComplete,
        aemtTrackingComplete,
      };
    });

    return NextResponse.json({
      success: true,
      students: processedStudents,
      alerts,
    });
  } catch (error) {
    console.error('Error fetching overview data:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch overview data' }, { status: 500 });
  }
}
