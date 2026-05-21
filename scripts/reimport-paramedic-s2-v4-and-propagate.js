#!/usr/bin/env node
// One-shot direct re-import of paramedic_s2_labs (4).json — the
// canonical FINAL S2 template — AND propagation onto PM G14
// lab_days, replacing existing stations entirely.
//
// Differs from reimport-paramedic-s2-labs.js in two ways:
//   1. Replaces stations on lab_days, not just on templates. The
//      previous version only filled empty lab_days; this one
//      DELETEs existing lab_stations and INSERTs from the new
//      template for every PM G14 lab_day linked to a template.
//   2. Skips any lab_day that has results attached. Mirrors the
//      set of tables used by /api/admin/lab-templates/cohort-results-check.
//
// Scope:
//   - PM G14 only (cohort 8577fdc3-eff6-4000-9302-1ee6e3043eeb).
//     PM G15 runs different semester content — left alone.
//   - lab_days with date >= 2026-05-11.
//
// Usage:
//   node scripts/reimport-paramedic-s2-v4-and-propagate.js --dry-run
//   node scripts/reimport-paramedic-s2-v4-and-propagate.js

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// env loader matches run-migration.js pattern.
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
const JSON_PATH = 'C:\\Users\\benny\\Downloads\\paramedic_s2_labs (4).json';
const PM_G14 = '8577fdc3-eff6-4000-9302-1ee6e3043eeb';

// Tables that count as "has results" — mirrors cohort-results-check
// route's list. Any non-zero count on any of these for a given
// lab_day_id means "skip this lab_day."
const RESULT_TABLES = [
  'scenario_assessments',
  'skill_assessments',
  'student_skill_evaluations',
  'skill_signoffs',
  'scenario_participation',
  'peer_evaluations',
  'student_lab_ratings',
  'lab_day_attendance',
  'lab_day_debrief_notes',
  'lab_day_debriefs',
  'lab_day_signups',
  'student_lab_signups',
];

function resolveName(t) {
  return t.title || t.name || 'Content Pending';
}

async function tableHasLabDayResults(client, labDayId) {
  // Return { hasResults: bool, hits: { [table]: count } }.
  // Best-effort — tables that don't exist or lack lab_day_id are
  // skipped (warning printed once per script run).
  const hits = {};
  for (const tbl of RESULT_TABLES) {
    try {
      const { rows } = await client.query(
        `SELECT COUNT(*)::int AS n FROM ${tbl} WHERE lab_day_id = $1`,
        [labDayId],
      );
      const n = rows[0]?.n ?? 0;
      if (n > 0) hits[tbl] = n;
    } catch (err) {
      // Suppress noise per-table — schema mismatch isn't fatal.
      if (!tableHasLabDayResults._warned) tableHasLabDayResults._warned = new Set();
      if (!tableHasLabDayResults._warned.has(tbl)) {
        tableHasLabDayResults._warned.add(tbl);
        console.warn(`  (note) skipping ${tbl}: ${err.message.split('\n')[0]}`);
      }
    }
  }
  return { hasResults: Object.keys(hits).length > 0, hits };
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'APPLY'}\n`);

  const payload = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const { program, semester, templates } = payload;
  console.log(
    `Loaded ${templates.length} templates from ${path.basename(JSON_PATH)} ` +
      `for ${program} / S${semester}\n`,
  );

  const client = new Client({ connectionString: conn });
  await client.connect();

  try {
    if (!DRY_RUN) await client.query('BEGIN');

    // ─── STEP 1: UPSERT templates and replace template stations ────
    console.log('=== STEP 1: lab_day_templates + lab_template_stations ===');
    let tplCreated = 0;
    let tplUpdated = 0;
    let stnInserted = 0;
    const tplRenames = [];
    // Build a fast lookup so STEP 2 can find the new template id +
    // station rows for each (week, day) without re-querying.
    const tplByKey = new Map(); // key = `${week}:${day}` → { id, name, stations: [...] }

    for (const tmpl of templates) {
      const key = `${tmpl.week_number}:${tmpl.day_number}`;
      const label = `Wk${String(tmpl.week_number).padStart(2)}D${tmpl.day_number}`;

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
        tplUpdated++;
      } else {
        if (!DRY_RUN) {
          const ins = await client.query(
            `INSERT INTO lab_day_templates (
               name, program, semester, week_number, day_number,
               category, instructor_count, is_anchor, anchor_type,
               requires_review, review_notes, template_data,
               is_shared, created_by, updated_at
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'{}'::jsonb,true,$12,NOW())
             RETURNING id`,
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
              'scripts/reimport-paramedic-s2-v4-and-propagate',
            ],
          );
          templateId = ins.rows[0].id;
        } else {
          templateId = '(dry-run new id)';
        }
        tplCreated++;
      }

      if (oldName && oldName !== resolveName(tmpl)) {
        tplRenames.push({ label, before: oldName, after: resolveName(tmpl) });
      }

      // Insert new station rows.
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
      stnInserted += stations.length;
      tplByKey.set(key, {
        id: templateId,
        name: resolveName(tmpl),
        stations,
      });
    }

    console.log(`  Templates updated: ${tplUpdated}`);
    console.log(`  Templates created: ${tplCreated}`);
    console.log(`  Stations inserted: ${stnInserted}`);
    if (tplRenames.length > 0) {
      console.log(`  Renames (${tplRenames.length}):`);
      for (const r of tplRenames) {
        console.log(`    ${r.label}  '${r.before}'  →  '${r.after}'`);
      }
    }

    // ─── STEP 2: propagate to PM G14 lab_days ─────────────────────
    console.log('\n=== STEP 2: propagate to PM G14 lab_days ===');

    // All PM G14 lab_days from May 2026 onward that link to a
    // template. Days without source_template_id can't be propagated
    // automatically — operator handles those via the per-day UI.
    const { rows: labDays } = await client.query(
      `SELECT ld.id, ld.week_number, ld.day_number, ld.date, ld.title,
              ld.source_template_id
       FROM lab_days ld
       WHERE ld.cohort_id = $1
         AND ld.date >= '2026-05-11'
         AND ld.source_template_id IS NOT NULL
       ORDER BY ld.date`,
      [PM_G14],
    );
    console.log(`  PM G14 lab_days linked to a template: ${labDays.length}`);

    let propagated = 0;
    let skippedHadResults = 0;
    let skippedNoTemplate = 0;
    const perDay = [];

    for (const ld of labDays) {
      const label = `Wk${String(ld.week_number).padStart(2)}D${ld.day_number} ${ld.date.toISOString().slice(0, 10)}`;

      // Find the new template content by (week, day). The
      // source_template_id link should already point at the right
      // row since we updated it in place, but using (week, day) is
      // robust against drift.
      const key = `${ld.week_number}:${ld.day_number}`;
      const tpl = tplByKey.get(key);
      if (!tpl) {
        skippedNoTemplate++;
        perDay.push({ label, action: 'SKIP (no template in JSON for this week/day)' });
        continue;
      }

      const { hasResults, hits } = await tableHasLabDayResults(client, ld.id);
      if (hasResults) {
        skippedHadResults++;
        const summary = Object.entries(hits)
          .map(([t, n]) => `${t}=${n}`)
          .join(', ');
        perDay.push({ label, action: `SKIP (results: ${summary})` });
        continue;
      }

      // No results: replace title + stations.
      if (!DRY_RUN) {
        if (tpl.name && tpl.name !== ld.title) {
          await client.query(`UPDATE lab_days SET title = $1 WHERE id = $2`, [
            tpl.name,
            ld.id,
          ]);
        }
        await client.query(
          `DELETE FROM lab_stations WHERE lab_day_id = $1`,
          [ld.id],
        );
        for (let i = 0; i < tpl.stations.length; i++) {
          const s = tpl.stations[i];
          await client.query(
            `INSERT INTO lab_stations (
               lab_day_id, station_number, station_type, scenario_id,
               custom_title, documentation_required, platinum_required,
               station_notes, metadata
             ) VALUES ($1,$2,$3,$4,$5,false,false,$6,$7)`,
            [
              ld.id,
              i + 1,
              s.station_type || 'scenario',
              s.scenario_id || null,
              s.station_name || null,
              s.format_notes || null,
              {},
            ],
          );
        }
      }
      propagated++;
      perDay.push({
        label,
        action: `OK +${tpl.stations.length} stations  title='${tpl.name}'`,
      });
    }

    console.log(`  Propagated:               ${propagated}`);
    console.log(`  Skipped (has results):    ${skippedHadResults}`);
    console.log(`  Skipped (no template):    ${skippedNoTemplate}`);
    console.log('');
    for (const d of perDay) {
      console.log(`    ${d.label}  ${d.action}`);
    }

    if (!DRY_RUN) {
      await client.query('COMMIT');
      console.log('\n=== COMMITTED ===');
    } else {
      console.log('\n--dry-run: no writes issued. Rerun without --dry-run to apply.');
    }
  } catch (err) {
    if (!DRY_RUN) {
      try { await client.query('ROLLBACK'); } catch {}
    }
    console.error('Failed, rolled back:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
