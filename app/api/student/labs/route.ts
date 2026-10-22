import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireStudentContext } from '@/lib/view-as-student';

/**
 * GET /api/student/labs
 *
 * Returns the student's lab attendance history:
 *   - All lab days they attended (from lab_day_attendance)
 *   - Lab day details (date, title, from lab_days)
 *   - Stations they completed at each lab (from station_completions)
 *   - Skills practiced at each station (from station_skills -> skills)
 *   - Attendance status (present/absent/late/excused)
 *
 * Access: student role only. Data is always scoped to the requesting student.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireStudentContext(request);
    if (auth instanceof NextResponse) return auth;

    if (!auth.found) {
      return NextResponse.json({
        success: true,
        studentFound: false,
        message: 'Student record not found. Please contact your instructor.',
        labs: [],
        summary: { total: 0, present: 0, absent: 0, late: 0, excused: 0, attendanceRate: 0 },
      });
    }

    const supabase = getSupabaseAdmin();
    const student = { id: auth.id, first_name: auth.firstName, last_name: auth.lastName };
    const studentId = student.id;

    // 3. Fetch all attendance records for this student, joined with lab day info
    let labs: any[] = [];

    try {
      const { data: attendanceRecords } = await supabase
        .from('lab_day_attendance')
        .select(`
          id,
          lab_day_id,
          status,
          notes,
          updated_at,
          lab_day:lab_days(id, date, title, location, start_time, end_time, cohort_id)
        `)
        .eq('student_id', studentId)
        .order('updated_at', { ascending: false });

      if (attendanceRecords && attendanceRecords.length > 0) {
        // 4. Collect lab_day_ids to fetch station completions in bulk
        const labDayIds = attendanceRecords
          .map((r) => r.lab_day_id)
          .filter(Boolean);

        // 5. Fetch station completions for these lab days
        let completionsByLabDay = new Map<string, any[]>();
        if (labDayIds.length > 0) {
          try {
            const { data: completions } = await supabase
              .from('station_completions')
              .select(`
                id,
                station_id,
                result,
                completed_at,
                lab_day_id,
                station:station_pool(id, station_code, station_name, category)
              `)
              .eq('student_id', studentId)
              .in('lab_day_id', labDayIds)
              .order('completed_at', { ascending: true });

            if (completions) {
              completions.forEach((c) => {
                if (!c.lab_day_id) return;
                if (!completionsByLabDay.has(c.lab_day_id)) {
                  completionsByLabDay.set(c.lab_day_id, []);
                }
                completionsByLabDay.get(c.lab_day_id)!.push({
                  id: c.id,
                  stationCode: (c.station as any)?.station_code || null,
                  stationName: (c.station as any)?.station_name || 'Unknown Station',
                  category: (c.station as any)?.category || 'other',
                  result: c.result,
                  completedAt: c.completed_at,
                });
              });
            }
          } catch {
            // station_completions table may not exist yet
          }
        }

        // 6. Fetch skill signoffs for these lab days
        let signoffsByLabDay = new Map<string, any[]>();
        if (labDayIds.length > 0) {
          try {
            const { data: signoffs } = await supabase
              .from('skill_signoffs')
              .select(`
                id,
                lab_day_id,
                signed_off_at,
                signed_off_by,
                skill:skills(id, name, category)
              `)
              .eq('student_id', studentId)
              .in('lab_day_id', labDayIds)
              .is('revoked_at', null)
              .order('signed_off_at', { ascending: true });

            if (signoffs) {
              signoffs.forEach((s) => {
                if (!s.lab_day_id) return;
                if (!signoffsByLabDay.has(s.lab_day_id)) {
                  signoffsByLabDay.set(s.lab_day_id, []);
                }
                signoffsByLabDay.get(s.lab_day_id)!.push({
                  id: s.id,
                  skillName: (s.skill as any)?.name || 'Unknown Skill',
                  skillCategory: (s.skill as any)?.category || 'other',
                  signedOffAt: s.signed_off_at,
                  signedOffBy: s.signed_off_by,
                });
              });
            }
          } catch {
            // skill_signoffs table may not exist yet
          }
        }

        // 7. Build enriched lab records
        labs = attendanceRecords.map((record) => {
          const labDay = record.lab_day as any;
          const labDayId = record.lab_day_id;

          return {
            id: record.id,
            labDayId: labDayId,
            date: labDay?.date || null,
            title: labDay?.title || 'Lab Day',
            location: labDay?.location || null,
            startTime: labDay?.start_time || null,
            endTime: labDay?.end_time || null,
            status: record.status,
            notes: record.notes || null,
            markedAt: record.updated_at,
            stations: completionsByLabDay.get(labDayId) || [],
            skillsSignedOff: signoffsByLabDay.get(labDayId) || [],
          };
        });
      }
    } catch {
      // Tables may not exist yet
    }

    // 8. Summary stats
    const total = labs.length;
    const present = labs.filter((l) => l.status === 'present').length;
    const late = labs.filter((l) => l.status === 'late').length;
    const absent = labs.filter((l) => l.status === 'absent').length;
    const excused = labs.filter((l) => l.status === 'excused').length;
    const attendedCount = present + late; // late still counts as attended
    const attendanceRate = total > 0 ? Math.round((attendedCount / total) * 100) : 0;

    return NextResponse.json({
      success: true,
      studentFound: true,
      student: {
        id: student.id,
        firstName: student.first_name,
        lastName: student.last_name,
      },
      labs,
      summary: {
        total,
        present,
        late,
        absent,
        excused,
        attendanceRate,
      },
    });
  } catch (error) {
    console.error('Error fetching student lab history:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch lab history' },
      { status: 500 }
    );
  }
}
