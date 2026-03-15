import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/scheduling/planner/lab-templates?program=paramedic&semester=1
// Returns available lab templates for the given program/semester
// Used by the Generate wizard to show the "Load lab template" option
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const program = searchParams.get('program');
    const semester = searchParams.get('semester');

    if (!program) {
      return NextResponse.json({ error: 'program is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('lab_day_templates')
      .select('id, name, updated_at, week_number, day_number, category')
      .eq('program', program.toLowerCase());

    if (semester) {
      query = query.eq('semester', parseInt(semester));
    }

    const { data: templates, error } = await query
      .order('updated_at', { ascending: false });

    if (error) throw error;

    if (!templates || templates.length === 0) {
      return NextResponse.json({
        available: false,
        templates: [],
        message: `No lab template found for ${program}${semester ? ` S${semester}` : ''}`,
      });
    }

    // Group by unique template sets — find the most recent template
    const mostRecent = templates[0];
    const templateCount = templates.length;

    // Format a display name from the most recent template
    const displayName = mostRecent.name || `${program} S${semester} Lab Template`;
    const updatedDate = mostRecent.updated_at
      ? new Date(mostRecent.updated_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : 'Unknown date';

    return NextResponse.json({
      available: true,
      template_count: templateCount,
      most_recent: {
        id: mostRecent.id,
        name: displayName,
        updated_at: mostRecent.updated_at,
        display: `${displayName} (updated ${updatedDate})`,
      },
      templates: templates.map(t => ({
        id: t.id,
        name: t.name,
        week_number: t.week_number,
        day_number: t.day_number,
        updated_at: t.updated_at,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Lab templates check error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
