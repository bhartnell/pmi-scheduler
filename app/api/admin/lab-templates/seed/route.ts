import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// POST /api/admin/lab-templates/seed
//
// Seeds lab templates from embedded JSON files:
//   data/paramedic_s1_labs.json, data/paramedic_s2_labs.json, data/paramedic_s3_labs.json, data/emt_s1_labs.json, data/aemt_s1_labs.json
// No request body needed — reads from project data files.
// Requires admin+ role.
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    // Same opt-in flag as /import — without confirm_placeholders the
    // route refuses to apply files that contain "Content Pending" /
    // empty-station templates. Default-safe: a stale data/ file
    // (which is what we had on 2026-05-21) can never silently revert
    // the DB. The flag is read from the request body when present.
    let confirmPlaceholders = false;
    try {
      const body = await request.json();
      if (body && typeof body === 'object' && body.confirm_placeholders === true) {
        confirmPlaceholders = true;
      }
    } catch {
      // No body / not JSON — fall through with confirmPlaceholders=false.
    }

    const supabase = getSupabaseAdmin();
    const dataDir = path.join(process.cwd(), 'data');
    const files = ['paramedic_s1_labs.json', 'paramedic_s2_labs.json', 'paramedic_s3_labs.json', 'emt_s1_labs.json', 'aemt_s1_labs.json'];
    const results: Array<{
      file: string;
      templates: number;
      stations: number;
      placeholders_skipped: number;
      placeholders?: Array<{ week_number: number; day_number: number; title: string | null; reasons: string[] }>;
      errors: string[];
    }> = [];
    const writerStamp = `seed-route:${user.email ?? 'unknown'}`;

    // Pre-scan: detect placeholders across ALL files. If any file
    // contains placeholders and confirm flag is not set, refuse the
    // whole operation up front. We deliberately list every offending
    // entry so the operator sees the full scope of the problem in
    // one response.
    interface PlaceholderEntry {
      file: string;
      week_number: number;
      day_number: number;
      title: string | null;
      reasons: string[];
    }
    const allPlaceholders: PlaceholderEntry[] = [];
    for (const file of files) {
      const filePath = path.join(dataDir, file);
      if (!fs.existsSync(filePath)) continue;
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const payload = JSON.parse(raw);
        if (!payload || !Array.isArray(payload.templates)) continue;
        for (const t of payload.templates) {
          const title = (t.title ?? t.name ?? '') || null;
          const reasons: string[] = [];
          if ((title ?? '').toLowerCase().includes('content pending')) {
            reasons.push('title contains "Content Pending"');
          }
          if (!Array.isArray(t.stations) || t.stations.length === 0) {
            reasons.push('stations array is empty or missing');
          }
          if (reasons.length > 0) {
            allPlaceholders.push({
              file,
              week_number: t.week_number,
              day_number: t.day_number,
              title,
              reasons,
            });
          }
        }
      } catch {
        // Skip unparseable files at this stage — the main loop will
        // surface the parse error in its per-file results.
      }
    }
    if (allPlaceholders.length > 0 && !confirmPlaceholders) {
      return NextResponse.json(
        {
          error:
            `Refusing seed: ${allPlaceholders.length} placeholder ` +
            `template(s) found in embedded data files. Either fix the ` +
            `JSON files (preferred) or pass confirm_placeholders=true to ` +
            `apply non-placeholder templates and skip these. Placeholders ` +
            `will NEVER overwrite existing real content.`,
          error_code: 'placeholders_blocked',
          placeholder_count: allPlaceholders.length,
          placeholders: allPlaceholders,
        },
        { status: 400 },
      );
    }
    // Build a per-file lookup so the main loop can skip the right
    // (week, day) entries without re-scanning.
    const placeholderKeysByFile = new Map<string, Set<string>>();
    for (const p of allPlaceholders) {
      const set = placeholderKeysByFile.get(p.file) ?? new Set<string>();
      set.add(`${p.week_number}:${p.day_number}`);
      placeholderKeysByFile.set(p.file, set);
    }

    for (const file of files) {
      const filePath = path.join(dataDir, file);
      if (!fs.existsSync(filePath)) {
        results.push({ file, templates: 0, stations: 0, placeholders_skipped: 0, errors: [`File not found: ${file}`] });
        continue;
      }

      const raw = fs.readFileSync(filePath, 'utf-8');
      const payload = JSON.parse(raw);
      const { program, semester, templates } = payload;

      let templatesCount = 0;
      let stationsCount = 0;
      let placeholdersSkippedThisFile = 0;
      const fileSkipSet = placeholderKeysByFile.get(file) ?? new Set<string>();
      const errors: string[] = [];

      for (const tmpl of templates) {
        // Skip placeholder rows that the pre-scan flagged. We only
        // reach this loop if confirm_placeholders was set, otherwise
        // the request short-circuited above.
        if (fileSkipSet.has(`${tmpl.week_number}:${tmpl.day_number}`)) {
          placeholdersSkippedThisFile++;
          continue;
        }
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
                updated_by: writerStamp,
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
                created_by: user.email,
                updated_by: writerStamp,
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

      results.push({
        file,
        templates: templatesCount,
        stations: stationsCount,
        placeholders_skipped: placeholdersSkippedThisFile,
        placeholders: allPlaceholders.filter(p => p.file === file).map(({ ...rest }) => rest),
        errors,
      });
    }

    const totalTemplates = results.reduce((sum, r) => sum + r.templates, 0);
    const totalStations = results.reduce((sum, r) => sum + r.stations, 0);
    const totalPlaceholders = results.reduce((sum, r) => sum + r.placeholders_skipped, 0);

    return NextResponse.json({
      success: true,
      summary: {
        total_templates: totalTemplates,
        total_stations: totalStations,
        total_placeholders_skipped: totalPlaceholders,
        files: results,
      },
    });
  } catch (error) {
    console.error('Error seeding lab templates:', error);
    return NextResponse.json({ error: 'Failed to seed lab templates' }, { status: 500 });
  }
}
