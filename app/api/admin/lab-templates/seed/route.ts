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
//   data/paramedic_s1_labs.json, data/paramedic_s2_labs.json, data/emt_s1_labs.json
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
    const files = ['paramedic_s1_labs.json', 'paramedic_s2_labs.json', 'emt_s1_labs.json'];
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
                template_data: {},
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
            const rows = tmpl.stations.map((s: { station_type: string; station_name: string; skills?: unknown[]; scenario_title?: string; difficulty?: string; format_notes?: string }, idx: number) => ({
              template_id: templateId,
              sort_order: idx + 1,
              station_type: s.station_type,
              station_name: s.station_name || null,
              skills: s.skills && s.skills.length > 0 ? s.skills : null,
              scenario_title: s.scenario_title || null,
              difficulty: s.difficulty || null,
              notes: s.format_notes || null,
            }));

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
