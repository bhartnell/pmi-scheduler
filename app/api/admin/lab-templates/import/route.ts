import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
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
// Type definitions for import JSON
// ---------------------------------------------------------------------------
interface SkillDef {
  name: string;
  platinum_skill?: boolean;
  min_attempts?: number;
}

interface StationDef {
  station_type: string;
  station_name: string;
  skills?: SkillDef[];
  scenario_title?: string;
  difficulty?: string;
  format_notes?: string;
}

interface TemplateDef {
  week_number: number;
  day_number: number;
  title: string;
  category: string;
  instructor_count: number;
  is_anchor: boolean;
  anchor_type: string | null;
  requires_review: boolean;
  review_notes: string | null;
  stations: StationDef[];
}

interface ImportPayload {
  program: string;
  semester: number;
  templates: TemplateDef[];
}

// ---------------------------------------------------------------------------
// POST /api/admin/lab-templates/import
//
// Accepts JSON body with structure:
//   { program, semester, templates: [ { week_number, day_number, title, category, ... stations: [...] } ] }
//
// Handles duplicates via upsert by (program, semester, week_number, day_number):
//   - If template exists, updates it and replaces stations
//   - If template doesn't exist, creates it
//
// Returns count of templates and stations created/updated.
// Requires admin+ role.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body: ImportPayload = await request.json();
    const { program, semester, templates } = body;

    if (!program || semester === undefined || !templates || !Array.isArray(templates)) {
      return NextResponse.json(
        { error: 'program, semester, and templates[] are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    let templatesCreated = 0;
    let templatesUpdated = 0;
    let stationsCreated = 0;
    const errors: string[] = [];

    for (const tmpl of templates) {
      try {
        // Check if template already exists for this (program, semester, week_number, day_number)
        const { data: existing } = await supabase
          .from('lab_day_templates')
          .select('id')
          .eq('program', program)
          .eq('semester', semester)
          .eq('week_number', tmpl.week_number)
          .eq('day_number', tmpl.day_number)
          .maybeSingle();

        let templateId: string;

        if (existing) {
          // Update existing template
          const { error: updateError } = await supabase
            .from('lab_day_templates')
            .update({
              name: tmpl.title,
              category: tmpl.category,
              day_number: tmpl.day_number,
              instructor_count: tmpl.instructor_count,
              is_anchor: tmpl.is_anchor,
              anchor_type: tmpl.anchor_type,
              requires_review: tmpl.requires_review,
              review_notes: tmpl.review_notes,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateError) throw updateError;
          templateId = existing.id;

          // Delete old stations before re-inserting
          await supabase
            .from('lab_template_stations')
            .delete()
            .eq('template_id', templateId);

          templatesUpdated++;
        } else {
          // Insert new template
          const { data: newTemplate, error: insertError } = await supabase
            .from('lab_day_templates')
            .insert({
              name: tmpl.title,
              program,
              semester,
              week_number: tmpl.week_number,
              day_number: tmpl.day_number,
              category: tmpl.category,
              instructor_count: tmpl.instructor_count,
              is_anchor: tmpl.is_anchor,
              anchor_type: tmpl.anchor_type,
              requires_review: tmpl.requires_review,
              review_notes: tmpl.review_notes,
              template_data: {},
              is_shared: true,
              created_by: currentUser.email,
              updated_at: new Date().toISOString(),
            })
            .select('id')
            .single();

          if (insertError) throw insertError;
          templateId = newTemplate.id;
          templatesCreated++;
        }

        // Insert stations
        if (tmpl.stations && tmpl.stations.length > 0) {
          const stationRows = tmpl.stations.map((s, idx) => ({
            template_id: templateId,
            sort_order: idx + 1,
            station_type: s.station_type,
            station_name: s.station_name || null,
            skills: s.skills && s.skills.length > 0 ? s.skills : null,
            scenario_title: s.scenario_title || null,
            difficulty: s.difficulty || null,
            notes: s.format_notes || null,
          }));

          const { error: stationError } = await supabase
            .from('lab_template_stations')
            .insert(stationRows);

          if (stationError) throw stationError;
          stationsCreated += stationRows.length;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Week ${tmpl.week_number} Day ${tmpl.day_number}: ${msg}`);
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        program,
        semester,
        templates_created: templatesCreated,
        templates_updated: templatesUpdated,
        stations_created: stationsCreated,
        total_templates: templates.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error('Error importing lab templates:', error);
    return NextResponse.json({ error: 'Failed to import lab templates' }, { status: 500 });
  }
}
