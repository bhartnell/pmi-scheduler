import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// POST /api/clinical/ride-alongs/templates/generate — generate shifts from templates for a date range
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const { template_ids, start_date, end_date, semester_id, cohort_id } = body;

    if (!template_ids || !Array.isArray(template_ids) || template_ids.length === 0) {
      return NextResponse.json({ success: false, error: 'template_ids array is required' }, { status: 400 });
    }
    if (!start_date || !end_date) {
      return NextResponse.json({ success: false, error: 'start_date and end_date are required' }, { status: 400 });
    }

    // Fetch selected templates
    const { data: templates, error: tErr } = await supabase
      .from('ride_along_templates')
      .select('*')
      .in('id', template_ids);

    if (tErr) throw tErr;
    if (!templates || templates.length === 0) {
      return NextResponse.json({ success: false, error: 'No templates found' }, { status: 404 });
    }

    // Generate shifts for each day in the date range that matches template day_of_week
    const shifts: Array<Record<string, unknown>> = [];
    const start = new Date(start_date);
    const end = new Date(end_date);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay(); // 0=Sunday, 6=Saturday

      for (const template of templates) {
        // If template has day_of_week set, only generate for matching days
        // If day_of_week is null, generate for every weekday (Mon-Fri)
        const templateDay = template.day_of_week;
        if (templateDay !== null && templateDay !== undefined && templateDay !== dayOfWeek) continue;
        if (templateDay === null || templateDay === undefined) {
          // Default: weekdays only
          if (dayOfWeek === 0 || dayOfWeek === 6) continue;
        }

        const dateStr = d.toISOString().split('T')[0];

        shifts.push({
          semester_id: semester_id || null,
          cohort_id: cohort_id || null,
          agency_id: template.agency_id || null,
          shift_date: dateStr,
          shift_type: template.shift_type || null,
          start_time: template.start_time || null,
          end_time: template.end_time || null,
          max_students: template.max_students || 1,
          location: null,
          unit_number: template.unit_number || null,
          preceptor_name: template.preceptor_name || null,
          notes: `Generated from template: ${template.name}`,
          status: 'open',
          created_by: user.id,
        });
      }
    }

    if (shifts.length === 0) {
      return NextResponse.json({ success: true, shifts: [], message: 'No matching dates found for templates' });
    }

    const { data: created, error: insertErr } = await supabase
      .from('ride_along_shifts')
      .insert(shifts)
      .select();

    if (insertErr) throw insertErr;

    return NextResponse.json({ success: true, shifts: created || [], count: (created || []).length });
  } catch (error) {
    console.error('Error generating shifts from templates:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate shifts' }, { status: 500 });
  }
}
