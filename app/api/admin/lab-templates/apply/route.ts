import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// Helper – resolve current user from session email
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
// POST /api/admin/lab-templates/apply
//
// Applies all templates for a given program + semester to a cohort.
// Creates lab_days and lab_stations based on template data.
//
// Body: { cohort_id, program_id, semester, start_date }
//
// Date calculation:
//   lab_date = start_date + (week_number - 1) * 7 days
//   If day_number > 1, add (day_number - 1) more days
//
// Requires admin+ role.
// ---------------------------------------------------------------------------
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

    const body = await request.json() as {
      cohort_id: string;
      program_id: string;
      semester: number;
      start_date: string;
    };

    const { cohort_id, program_id, semester, start_date } = body;

    if (!cohort_id || !program_id || !semester || !start_date) {
      return NextResponse.json(
        { error: 'cohort_id, program_id, semester, and start_date are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Fetch all templates for the given program + semester, with their stations
    const { data: templates, error: templatesError } = await supabase
      .from('lab_day_templates')
      .select(`
        id, title, name, description, week_number, day_number,
        num_rotations, rotation_duration,
        stations:lab_template_stations(
          id, station_number, station_type, scenario_id,
          skill_name, custom_title, room, notes, rotation_minutes, num_rotations
        )
      `)
      .eq('program_id', program_id)
      .eq('semester', semester)
      .not('program_id', 'is', null)
      .order('week_number', { ascending: true })
      .order('day_number', { ascending: true });

    if (templatesError) throw templatesError;

    if (!templates || templates.length === 0) {
      return NextResponse.json(
        { error: 'No templates found for the specified program and semester' },
        { status: 404 }
      );
    }

    // Parse start_date as a UTC date to avoid timezone issues
    const [year, month, day] = start_date.split('-').map(Number);
    const baseDate = new Date(Date.UTC(year, month - 1, day));

    const createdLabDays: any[] = [];

    for (const template of templates) {
      const weekOffset = ((template.week_number || 1) - 1) * 7;
      const dayOffset = ((template.day_number || 1) - 1);
      const labDate = new Date(baseDate);
      labDate.setUTCDate(baseDate.getUTCDate() + weekOffset + dayOffset);
      const labDateStr = labDate.toISOString().split('T')[0];

      const displayTitle = template.title || template.name || `Week ${template.week_number} Day ${template.day_number}`;

      // Create the lab day
      const { data: labDay, error: labDayError } = await supabase
        .from('lab_days')
        .insert({
          cohort_id,
          date: labDateStr,
          title: displayTitle,
          semester,
          week_number: template.week_number || 1,
          day_number: template.day_number || 1,
          num_rotations: template.num_rotations || 4,
          rotation_duration: template.rotation_duration || 30,
          notes: template.description || null,
        })
        .select('id, date, title, week_number, day_number')
        .single();

      if (labDayError) {
        console.error('Error creating lab day from template:', labDayError);
        continue; // skip this one, keep going
      }

      createdLabDays.push(labDay);

      // Create stations for this lab day from the template's stations
      const templateStations = (template as any).stations ?? [];
      if (templateStations.length > 0) {
        const stationsToInsert = templateStations.map((s: any) => ({
          lab_day_id: labDay.id,
          station_number: s.station_number,
          station_type: s.station_type || 'scenario',
          scenario_id: s.scenario_id || null,
          skill_name: s.skill_name || null,
          custom_title: s.custom_title || null,
          room: s.room || null,
          notes: s.notes || null,
          rotation_minutes: s.rotation_minutes || null,
          num_rotations: s.num_rotations || null,
          documentation_required: false,
          platinum_required: false,
        }));

        const { error: stationsError } = await supabase
          .from('lab_stations')
          .insert(stationsToInsert);

        if (stationsError) {
          console.error('Error creating stations from template:', stationsError);
          // Continue – lab day was created, stations failed
        }
      }
    }

    return NextResponse.json({
      success: true,
      created_count: createdLabDays.length,
      lab_days: createdLabDays,
    });
  } catch (error) {
    console.error('Error applying lab templates:', error);
    return NextResponse.json({ error: 'Failed to apply lab templates' }, { status: 500 });
  }
}
