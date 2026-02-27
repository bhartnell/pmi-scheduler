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
// Body: { cohort_id, program, semester, start_date }
//
// Date calculation:
//   lab_date = start_date + (week_number - 1) * 7 days
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
      program: string;
      semester: number;
      start_date: string;
    };

    // Accept both `program` and legacy `program_id` from callers
    const program = body.program || (body as any).program_id;
    const { cohort_id, semester, start_date } = body;

    if (!cohort_id || !program || !semester || !start_date) {
      return NextResponse.json(
        { error: 'cohort_id, program, semester, and start_date are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Fetch all templates for the given program + semester, with their stations
    const { data: templates, error: templatesError } = await supabase
      .from('lab_day_templates')
      .select(`
        id, name, description, week_number,
        stations:lab_template_stations(
          id, sort_order, station_type, station_name, skills, scenario_id
        )
      `)
      .eq('program', program)
      .eq('semester', semester)
      .not('program', 'is', null)
      .order('week_number', { ascending: true });

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
      const labDate = new Date(baseDate);
      labDate.setUTCDate(baseDate.getUTCDate() + weekOffset);
      const labDateStr = labDate.toISOString().split('T')[0];

      const displayTitle = template.name || `Week ${template.week_number}`;

      // Create the lab day
      const { data: labDay, error: labDayError } = await supabase
        .from('lab_days')
        .insert({
          cohort_id,
          date: labDateStr,
          title: displayTitle,
          semester,
          week_number: template.week_number || 1,
          notes: template.description || null,
        })
        .select('id, date, title, week_number')
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
          station_number: s.sort_order || 1,
          station_type: s.station_type || 'scenario',
          scenario_id: s.scenario_id || null,
          custom_title: s.station_name || null,
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
