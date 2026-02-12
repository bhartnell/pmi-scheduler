import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

// Create Supabase client lazily to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const INTERNSHIP_HOURS_REQUIRED = 480; // Default requirement

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const cohortId = searchParams.get('cohortId');

    if (!cohortId) {
      return NextResponse.json({ success: false, error: 'cohortId is required' }, { status: 400 });
    }

    // Fetch cohort info
    const { data: cohort, error: cohortError } = await supabase
      .from('cohorts')
      .select(`
        id,
        cohort_number,
        program:programs(name, abbreviation)
      `)
      .eq('id', cohortId)
      .single();

    if (cohortError || !cohort) {
      return NextResponse.json({ success: false, error: 'Cohort not found' }, { status: 404 });
    }

    // Fetch students in cohort
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('cohort_id', cohortId)
      .eq('status', 'active')
      .order('last_name');

    if (studentsError) throw studentsError;

    const studentIds = students?.map(s => s.id) || [];

    // Fetch internships for all students
    const { data: internships } = await supabase
      .from('student_internships')
      .select(`
        *,
        agency:agencies(id, name, type),
        preceptor:preceptors(id, first_name, last_name)
      `)
      .in('student_id', studentIds);

    // Build internship map by student
    const internshipMap: Record<string, any> = {};
    internships?.forEach((intern: any) => {
      internshipMap[intern.student_id] = intern;
    });

    // Build agency breakdown
    const agencyMap: Record<string, { name: string; type: string; students: string[] }> = {};

    // Build student breakdown and summary
    const studentBreakdown: any[] = [];
    const flaggedStudents: any[] = [];
    let placed = 0;
    let pending = 0;
    let notStarted = 0;

    (students || []).forEach(student => {
      const internship = internshipMap[student.id];
      const studentName = `${student.first_name} ${student.last_name}`;

      let status = 'Not Started';
      let agency = null;
      let preceptor = null;
      let startDate = null;
      let hoursCompleted = 0;

      if (internship) {
        status = internship.status || 'Pending';
        agency = internship.agency?.name || null;
        preceptor = internship.preceptor ? `${internship.preceptor.first_name} ${internship.preceptor.last_name}` : null;
        startDate = internship.start_date;
        hoursCompleted = internship.hours_completed || 0;

        // Track agency
        if (agency) {
          if (!agencyMap[agency]) {
            agencyMap[agency] = {
              name: agency,
              type: internship.agency?.type || 'Unknown',
              students: [],
            };
          }
          agencyMap[agency].students.push(studentName);
        }
      }

      // Count by status
      const statusLower = status.toLowerCase();
      if (statusLower === 'placed' || statusLower === 'active' || statusLower === 'completed') {
        placed++;
      } else if (statusLower === 'pending') {
        pending++;
      } else {
        notStarted++;
      }

      // Flag students with issues
      if (statusLower === 'not started') {
        flaggedStudents.push({
          id: student.id,
          name: studentName,
          reason: 'No internship placement',
          details: 'Needs assignment',
        });
      } else if (!preceptor && (statusLower === 'placed' || statusLower === 'active')) {
        flaggedStudents.push({
          id: student.id,
          name: studentName,
          reason: 'No preceptor assigned',
          details: agency || 'Unknown agency',
        });
      } else if (hoursCompleted < INTERNSHIP_HOURS_REQUIRED * 0.25 && startDate) {
        // Check if they're behind on hours (started but less than 25% complete)
        const daysSinceStart = Math.floor((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceStart > 30) { // More than a month in
          flaggedStudents.push({
            id: student.id,
            name: studentName,
            reason: 'Behind on hours',
            details: `${hoursCompleted}/${INTERNSHIP_HOURS_REQUIRED}h`,
          });
        }
      }

      studentBreakdown.push({
        id: student.id,
        name: studentName,
        status,
        agency,
        preceptor,
        startDate,
        hoursCompleted,
        hoursRequired: INTERNSHIP_HOURS_REQUIRED,
      });
    });

    // Convert agency map to array
    const agencyBreakdown = Object.values(agencyMap)
      .map(a => ({
        ...a,
        studentCount: a.students.length,
      }))
      .sort((a, b) => b.studentCount - a.studentCount);

    const report = {
      cohort: {
        id: cohort.id,
        name: `${(cohort.program as any)?.abbreviation || 'Unknown'} Group ${cohort.cohort_number}`,
      },
      summary: {
        totalStudents: students?.length || 0,
        placed,
        pending,
        notStarted,
      },
      agencyBreakdown,
      studentBreakdown,
      flaggedStudents,
    };

    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error('Error generating internship status report:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate report' }, { status: 500 });
  }
}
