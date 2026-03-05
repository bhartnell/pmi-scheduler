import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

interface TemplateStation {
  station_number: number;
  station_type: string;
  scenario_id?: string | null;
  skill_name?: string | null;
  custom_title?: string | null;
  rotation_minutes?: number;
  num_rotations?: number;
  room?: string | null;
  notes?: string | null;
  instructor_name?: string | null;
  instructor_email?: string | null;
}

interface TemplateDay {
  day_number: number;
  title?: string;
  start_time?: string;
  end_time?: string;
  stations: TemplateStation[];
}

// POST /api/lab-management/weekly-templates/generate
// Generates lab_days + lab_stations from a weekly template
// Body: { template_id, cohort_id, start_date, semester?, week_number? }
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('lead_instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { template_id, cohort_id, start_date, semester, week_number } = body;

    if (!template_id) {
      return NextResponse.json({ error: 'template_id is required' }, { status: 400 });
    }
    if (!cohort_id) {
      return NextResponse.json({ error: 'cohort_id is required' }, { status: 400 });
    }
    if (!start_date) {
      return NextResponse.json({ error: 'start_date is required (YYYY-MM-DD, the Monday of the week)' }, { status: 400 });
    }

    // Fetch the template
    const { data: template, error: tmplErr } = await supabase
      .from('lab_week_templates')
      .select('*')
      .eq('id', template_id)
      .single();

    if (tmplErr || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const days: TemplateDay[] = template.days || [];
    if (days.length === 0) {
      return NextResponse.json({ error: 'Template has no days configured' }, { status: 400 });
    }

    // Verify cohort exists
    const { data: cohort, error: cohortErr } = await supabase
      .from('cohorts')
      .select('id, cohort_number')
      .eq('id', cohort_id)
      .single();

    if (cohortErr || !cohort) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }

    // Calculate dates: start_date is "Day 1". day_number offset gives us the actual date.
    const baseDate = new Date(start_date + 'T12:00:00'); // midday to avoid TZ issues

    const createdLabDays: Array<{ labDay: Record<string, unknown>; stations: Record<string, unknown>[] }> = [];

    for (const day of days) {
      // Calculate the date for this day (day_number 1 = start_date, 2 = start_date+1, etc.)
      const dayDate = new Date(baseDate);
      dayDate.setDate(dayDate.getDate() + (day.day_number - 1));
      const dateStr = dayDate.toISOString().split('T')[0]; // YYYY-MM-DD

      // Create lab day
      const { data: labDay, error: labDayErr } = await supabase
        .from('lab_days')
        .insert({
          date: dateStr,
          cohort_id,
          title: day.title || `Week ${week_number || template.week_number || ''} Day ${day.day_number}`,
          start_time: day.start_time || null,
          end_time: day.end_time || null,
          semester: semester || template.semester || null,
          week_number: week_number != null ? week_number : template.week_number || null,
          day_number: day.day_number,
          notes: `Generated from weekly template: ${template.name}`,
          source_template_id: template.id,
        })
        .select()
        .single();

      if (labDayErr) {
        console.error('Error creating lab day for day', day.day_number, labDayErr);
        return NextResponse.json({
          error: `Failed to create lab day for day ${day.day_number}: ${labDayErr.message}`,
          partial: createdLabDays,
        }, { status: 500 });
      }

      // Create stations for this lab day
      let createdStations: Record<string, unknown>[] = [];
      if (day.stations && day.stations.length > 0) {
        const stationsToInsert = day.stations.map((s) => ({
          lab_day_id: labDay.id,
          station_number: s.station_number || 1,
          station_type: s.station_type || 'scenario',
          scenario_id: s.scenario_id || null,
          skill_name: s.skill_name || null,
          custom_title: s.custom_title || null,
          rotation_minutes: s.rotation_minutes || 30,
          num_rotations: s.num_rotations || 4,
          room: s.room || null,
          notes: s.notes || null,
          instructor_name: s.instructor_name || null,
          instructor_email: s.instructor_email || null,
        }));

        const { data: stations, error: stationsErr } = await supabase
          .from('lab_stations')
          .insert(stationsToInsert)
          .select();

        if (stationsErr) {
          console.error('Error creating stations for day', day.day_number, stationsErr);
          // Lab day was still created; partial success
          createdLabDays.push({ labDay, stations: [] });
          continue;
        }
        createdStations = stations || [];
      }

      createdLabDays.push({ labDay, stations: createdStations });
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${createdLabDays.length} lab day(s) from template "${template.name}"`,
      generated: createdLabDays,
    }, { status: 201 });
  } catch (error) {
    console.error('Error generating from weekly template:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate lab days';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
