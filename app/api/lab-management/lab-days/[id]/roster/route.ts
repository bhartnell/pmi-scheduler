import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const format = request.nextUrl.searchParams.get('format') || 'json';

  try {
    const supabase = getSupabaseAdmin();

    // Check instructor+ role
    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !hasMinRole(callerUser.role, 'instructor')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch lab day with cohort info
    const { data: labDay, error: labDayError } = await supabase
      .from('lab_days')
      .select(`
        id,
        date,
        title,
        start_time,
        end_time,
        week_number,
        day_number,
        num_rotations,
        rotation_duration,
        notes,
        cohort_id,
        cohort:cohorts(
          id,
          cohort_number,
          program:programs(name, abbreviation)
        ),
        stations:lab_stations(
          id,
          station_number,
          station_type,
          skill_name,
          custom_title,
          instructor_name,
          instructor_email,
          room,
          scenario:scenarios(id, title, category, difficulty)
        )
      `)
      .eq('id', id)
      .single();

    if (labDayError) throw labDayError;
    if (!labDay) {
      return NextResponse.json({ error: 'Lab day not found' }, { status: 404 });
    }

    // Sort stations by station_number
    if (labDay.stations) {
      (labDay.stations as any[]).sort((a, b) => (a.station_number || 0) - (b.station_number || 0));
    }

    // Fetch enrolled students for this cohort
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, first_name, last_name, email, agency, photo_url, status')
      .eq('cohort_id', (labDay.cohort as any).id)
      .eq('status', 'active')
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });

    if (studentsError) throw studentsError;

    if (format === 'csv') {
      // Build CSV
      const cohort = labDay.cohort as any;
      const cohortName = `${cohort.program.abbreviation} Group ${cohort.cohort_number}`;
      const dateStr = labDay.date;

      const rows: string[] = [
        `# PMI Paramedic Program - Lab Day Roster`,
        `# ${cohortName} - ${dateStr}`,
        ``,
        `Student Name,Email,Agency,Notes`,
      ];

      (students || []).forEach((student) => {
        const name = `"${student.last_name}, ${student.first_name}"`;
        const email = student.email || '';
        const agency = student.agency ? `"${student.agency}"` : '';
        rows.push(`${name},${email},${agency},`);
      });

      rows.push('');
      rows.push('# Stations & Instructors');
      rows.push('Station Number,Station Title,Instructor Name,Instructor Email,Room');

      (labDay.stations as any[] || []).forEach((station) => {
        const title = station.custom_title || station.scenario?.title || station.skill_name || `Station ${station.station_number}`;
        const safeTitle = `"${title.replace(/"/g, '""')}"`;
        const instructorName = station.instructor_name || '';
        const instructorEmail = station.instructor_email || '';
        const room = station.room || '';
        rows.push(`${station.station_number},${safeTitle},${instructorName},${instructorEmail},${room}`);
      });

      const csvContent = rows.join('\n');

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="labday-roster-${dateStr}.csv"`,
        },
      });
    }

    // Return JSON roster
    return NextResponse.json({
      success: true,
      roster: {
        labDay: {
          id: labDay.id,
          date: labDay.date,
          title: labDay.title,
          start_time: labDay.start_time,
          end_time: labDay.end_time,
          week_number: labDay.week_number,
          day_number: labDay.day_number,
          num_rotations: labDay.num_rotations,
          rotation_duration: labDay.rotation_duration,
          notes: labDay.notes,
          cohort: labDay.cohort,
          stations: labDay.stations,
        },
        students: students || [],
      },
    });
  } catch (error) {
    console.error('Error fetching roster:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch roster' }, { status: 500 });
  }
}
