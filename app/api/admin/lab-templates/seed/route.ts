import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Helper – resolve current user
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
// POST /api/admin/lab-templates/seed
//
// Seeds lab templates from embedded JSON files:
//   data/paramedic_s1_labs.json, data/paramedic_s2_labs.json, data/paramedic_s3_labs.json, data/emt_s1_labs.json, data/aemt_s1_labs.json
// No request body needed — reads from project data files.
// Requires admin+ role.
// ---------------------------------------------------------------------------
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const dataDir = path.join(process.cwd(), 'data');
    const files = ['paramedic_s1_labs.json', 'paramedic_s2_labs.json', 'paramedic_s3_labs.json', 'emt_s1_labs.json', 'aemt_s1_labs.json'];
    const results: Array<{ file: string; templates: number; stations: number; errors: string[] }> = [];

    for (const file of files) {
      const filePath = path.join(dataDir, file);
      if (!fs.existsSync(filePath)) {
        results.push({ file, templates: 0, stations: 0, errors: [`File not found: ${file}`] });
        continue;
      }

      const raw = fs.readFileSync(filePath, 'utf-8');
      const payload = JSON.parse(raw);
      const { program, semester, templates } = payload;

      let templatesCount = 0;
      let stationsCount = 0;
      const errors: string[] = [];

      for (const tmpl of templates) {
        try {
          // Check for existing
          const { data: existing } = await supabase
            .from('lab_day_templates')
            .select('id')
            .eq('program', program)
            .eq('semester', semester)
            .eq('week_number', tmpl.week_number)
            .eq('day_number', tmpl.day_number)
            .maybeSingle();

          // Build template_data from extra JSON fields (S3 has richer data)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const templateData: Record<string, any> = {};
          if (tmpl.minicode_phase) templateData.minicode_phase = tmpl.minicode_phase;
          if (tmpl.session_duration_minutes) templateData.session_duration_minutes = tmpl.session_duration_minutes;

          let templateId: string;

          if (existing) {
            // Update
            await supabase
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
                template_data: Object.keys(templateData).length > 0 ? templateData : {},
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id);

            templateId = existing.id;

            // Clear existing stations
            await supabase
              .from('lab_template_stations')
              .delete()
              .eq('template_id', templateId);
          } else {
            // Insert
            const { data: newTmpl, error } = await supabase
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
                template_data: Object.keys(templateData).length > 0 ? templateData : {},
                is_shared: true,
                created_by: currentUser.email,
                updated_at: new Date().toISOString(),
              })
              .select('id')
              .single();

            if (error) throw error;
            templateId = newTmpl.id;
          }

          templatesCount++;

          // Insert stations
          if (tmpl.stations && tmpl.stations.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rows = tmpl.stations.map((s: any, idx: number) => {
              // Collect extended metadata fields (S3 has richer station data)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const metadata: Record<string, any> = {};
              if (s.station_id) metadata.station_id = s.station_id;
              if (s.duration_minutes) metadata.duration_minutes = s.duration_minutes;
              if (s.time_block) metadata.time_block = s.time_block;
              if (s.equipment && s.equipment.length > 0) metadata.equipment = s.equipment;
              if (s.tracking) metadata.tracking = s.tracking;
              if (s.instructor_required !== undefined) metadata.instructor_required = s.instructor_required;
              if (s.roles) metadata.roles = s.roles;
              if (s.instructor_tiering) metadata.instructor_tiering = s.instructor_tiering;
              if (s.stress_layers) metadata.stress_layers = s.stress_layers;
              if (s.common_errors) metadata.common_errors = s.common_errors;
              if (s.available_stations) metadata.available_stations = s.available_stations;
              if (s.scenario_cards) metadata.scenario_cards = s.scenario_cards;
              if (s.available_scenarios) metadata.available_scenarios = s.available_scenarios;

              return {
                template_id: templateId,
                sort_order: idx + 1,
                station_type: s.station_type,
                station_name: s.station_name || null,
                skills: s.skills && s.skills.length > 0 ? s.skills : null,
                scenario_title: s.scenario_title || null,
                difficulty: s.difficulty || null,
                notes: s.format_notes || s.description || null,
                metadata: Object.keys(metadata).length > 0 ? metadata : {},
              };
            });

            const { error: stErr } = await supabase
              .from('lab_template_stations')
              .insert(rows);

            if (stErr) throw stErr;
            stationsCount += rows.length;
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`S${semester} Week ${tmpl.week_number} Day ${tmpl.day_number}: ${msg}`);
        }
      }

      results.push({ file, templates: templatesCount, stations: stationsCount, errors });
    }

    const totalTemplates = results.reduce((sum, r) => sum + r.templates, 0);
    const totalStations = results.reduce((sum, r) => sum + r.stations, 0);

    return NextResponse.json({
      success: true,
      summary: {
        total_templates: totalTemplates,
        total_stations: totalStations,
        files: results,
      },
    });
  } catch (error) {
    console.error('Error seeding lab templates:', error);
    return NextResponse.json({ error: 'Failed to seed lab templates' }, { status: 500 });
  }
}
