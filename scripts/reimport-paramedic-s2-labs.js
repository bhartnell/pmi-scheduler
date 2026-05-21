#!/usr/bin/env node
// One-shot direct re-import of paramedic_s2_labs (2).json into
// lab_day_templates + lab_template_stations.
//
// Mirrors app/api/admin/lab-templates/import/route.ts exactly:
//   UPSERT on (program, semester, week_number, day_number).
//   Update: replace name + metadata, DELETE existing stations,
//   INSERT fresh stations from JSON.
//   Insert: same shape as the API.
//
// Use this when the regular Import UI didn't take (e.g. operator
// clicked Preview but not Import, or an older file overwrote).
//
// Usage:
//   node scripts/reimport-paramedic-s2-labs.js                # apply
//   node scripts/reimport-paramedic-s2-labs.js --dry-run      # report only

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Reuse the env-loader pattern from run-migration.js.
try {
  for (const line of fs
    .readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
    .split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
} catch {}

const conn = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!conn) {
  console.error('No DATABASE_URL or SUPABASE_DB_URL in env');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');
const JSON_PATH = 'C:\\Users\\benny\\Downloads\\paramedic_s2_labs (2).json';

// resolveName mirrors importer's helper — title → name → fallback.
function resolveName(t) {
  return t.title || t.name || 'Content Pending';
}

async function main() {
  const payload = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const { program, semester, templates } = payload;
  console.log(
    `Loaded ${templates.length} templates from JSON for ${program} / S${semester}\n`,
  );

  const client = new Client({ connectionString: conn });
  await client.connect();

  let templatesCreated = 0;
  let templatesUpdated = 0;
  let stationsCreated = 0;
  const perRow = [];
  const errors = [];

  try {
    if (!DRY_RUN) await client.query('BEGIN');

    for (const tmpl of templates) {
      const label = `Wk${String(tmpl.week_number).padStart(2)}D${tmpl.day_number}`;
      try {
        // 1. Find existing template by (program, semester, week, day).
        const { rows: found } = await client.query(
          `SELECT id, name FROM lab_day_templates
           WHERE program = $1 AND semester = $2
             AND week_number = $3 AND day_number = $4
           LIMIT 1`,
          [program, semester, tmpl.week_number, tmpl.day_number],
        );

        let templateId;
        let oldName = null;
        if (found.length > 0) {
          // 2a. Update.
          templateId = found[0].id;
          oldName = found[0].name;
          if (!DRY_RUN) {
            await client.query(
              `UPDATE lab_day_templates SET
                 name = $1, category = $2, day_number = $3,
                 instructor_count = $4, is_anchor = $5, anchor_type = $6,
                 requires_review = $7, review_notes = $8,
                 updated_at = NOW()
               WHERE id = $9`,
              [
                resolveName(tmpl),
                tmpl.category,
                tmpl.day_number,
                tmpl.instructor_count,
                tmpl.is_anchor,
                tmpl.anchor_type,
                tmpl.requires_review,
                tmpl.review_notes,
                templateId,
              ],
            );
            await client.query(
              `DELETE FROM lab_template_stations WHERE template_id = $1`,
              [templateId],
            );
          }
          templatesUpdated++;
        } else {
          // 2b. Insert.
          if (!DRY_RUN) {
            const ins = await client.query(
              `INSERT INTO lab_day_templates (
                 name, program, semester, week_number, day_number,
                 category, instructor_count, is_anchor, anchor_type,
                 requires_review, review_notes, template_data,
                 is_shared, created_by, updated_at
               ) VALUES (
                 $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'{}'::jsonb,true,$12,NOW()
               ) RETURNING id`,
              [
                resolveName(tmpl),
                program,
                semester,
                tmpl.week_number,
                tmpl.day_number,
                tmpl.category,
                tmpl.instructor_count,
                tmpl.is_anchor,
                tmpl.anchor_type,
                tmpl.requires_review,
                tmpl.review_notes,
                'scripts/reimport-paramedic-s2-labs',
              ],
            );
            templateId = ins.rows[0].id;
          } else {
            templateId = '(dry-run new id)';
          }
          templatesCreated++;
        }

        // 3. Insert stations from JSON.
        const stations = Array.isArray(tmpl.stations) ? tmpl.stations : [];
        if (!DRY_RUN && stations.length > 0) {
          for (let i = 0; i < stations.length; i++) {
            const s = stations[i];
            await client.query(
              `INSERT INTO lab_template_stations (
                 template_id, sort_order, station_type, station_name,
                 skills, scenario_title, difficulty, notes
               ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
              [
                templateId,
                i + 1,
                s.station_type,
                s.station_name || null,
                s.skills && s.skills.length > 0 ? JSON.stringify(s.skills) : null,
                s.scenario_title || null,
                s.difficulty || null,
                s.format_notes || null,
              ],
            );
          }
        }
        stationsCreated += stations.length;
        perRow.push({
          label,
          name_before: oldName,
          name_after: resolveName(tmpl),
          stations: stations.length,
        });
      } catch (err) {
        errors.push(`${label}: ${err.message}`);
      }
    }

    if (!DRY_RUN) await client.query('COMMIT');

    console.log('=== Reimport summary ===');
    console.log(`Templates updated:  ${templatesUpdated}`);
    console.log(`Templates created:  ${templatesCreated}`);
    console.log(`Stations inserted:  ${stationsCreated}`);
    if (errors.length > 0) {
      console.log('\nErrors:');
      for (const e of errors) console.log('  ', e);
    }
    console.log('\nName/station change summary:');
    for (const r of perRow) {
      const renamed = r.name_before !== r.name_after ? ' [RENAMED]' : '';
      console.log(`  ${r.label}  stations=${r.stations}${renamed}`);
      if (renamed) {
        console.log(`     '${r.name_before}'`);
        console.log(`  →  '${r.name_after}'`);
      }
    }
    if (DRY_RUN) console.log('\n--dry-run: nothing written. Rerun without --dry-run to apply.');
  } catch (err) {
    if (!DRY_RUN) {
      try { await client.query('ROLLBACK'); } catch {}
    }
    console.error('Reimport failed, rolled back:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
