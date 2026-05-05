#!/usr/bin/env node
// Read-only comparison: EMT S1 lab_day_templates rows in production
// vs the uploaded emt_s1_labs.json. Reports week-by-week diffs.
// Does NOT mutate any data — purely diagnostic.
//
// Usage:
//   node scripts/compare-emt-s1-templates.js [path/to/emt_s1_labs.json]
//
// Default JSON path: C:/Users/benny/Downloads/emt_s1_labs.json

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

try {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.substring(0, eq).trim();
    const v = t.substring(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
} catch {}

const conn =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  `postgresql://${process.env.SUPABASE_DB_USER || 'postgres.mkrqpwncfjpppxyntdtp'}:${process.env.SUPABASE_DB_PASSWORD}@aws-0-us-west-2.pooler.supabase.com:5432/postgres`;

const jsonPath = process.argv[2] || 'C:/Users/benny/Downloads/emt_s1_labs.json';

(async () => {
  // ── Load JSON ────────────────────────────────────────────────────
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const json = JSON.parse(raw);
  const jsonTemplates = json.templates || [];
  const jsonByKey = new Map();
  for (const t of jsonTemplates) {
    const key = `${t.week_number}|${t.day_number ?? 1}`;
    jsonByKey.set(key, {
      week: t.week_number,
      day: t.day_number ?? 1,
      title: t.title || t.name || '(unnamed)',
      category: t.category,
      stationCount: Array.isArray(t.stations) ? t.stations.length : 0,
      stations: t.stations ?? [],
    });
  }

  // ── Load DB ──────────────────────────────────────────────────────
  const c = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const { rows: dbRows } = await c.query(
    `
    SELECT
      ldt.id,
      ldt.week_number,
      ldt.day_number,
      ldt.name,
      ldt.category,
      ldt.requires_review,
      ldt.review_notes,
      (SELECT COUNT(*)::int FROM lab_template_stations lts
       WHERE lts.template_id = ldt.id) AS station_count
    FROM lab_day_templates ldt
    WHERE ldt.program = 'emt'
      AND ldt.semester = 1
    ORDER BY week_number NULLS LAST, day_number NULLS LAST
    `
  );
  const dbByKey = new Map();
  for (const r of dbRows) {
    const key = `${r.week_number}|${r.day_number ?? 1}`;
    dbByKey.set(key, {
      id: r.id,
      week: r.week_number,
      day: r.day_number,
      name: r.name,
      category: r.category,
      requires_review: r.requires_review,
      review_notes: r.review_notes,
      stationCount: r.station_count,
    });
  }

  console.log(`\nJSON: ${jsonPath}`);
  console.log(`  ${jsonTemplates.length} templates`);
  console.log(`DB (program=emt, semester=1):`);
  console.log(`  ${dbRows.length} templates`);

  // ── Diff ─────────────────────────────────────────────────────────
  const allKeys = new Set([...dbByKey.keys(), ...jsonByKey.keys()]);
  const sortedKeys = Array.from(allKeys).sort((a, b) => {
    const [aw, ad] = a.split('|').map(Number);
    const [bw, bd] = b.split('|').map(Number);
    return aw === bw ? ad - bd : aw - bw;
  });

  const dbOnly = [];
  const jsonOnly = [];
  const nameDiff = [];
  const same = [];

  for (const key of sortedKeys) {
    const d = dbByKey.get(key);
    const j = jsonByKey.get(key);
    if (d && !j) dbOnly.push(d);
    else if (!d && j) jsonOnly.push(j);
    else if (d && j) {
      const dName = (d.name || '').trim();
      const jTitle = (j.title || '').trim();
      if (dName !== jTitle) {
        nameDiff.push({ key, db: d, json: j });
      } else {
        same.push({ key, db: d, json: j });
      }
    }
  }

  // ── Report ───────────────────────────────────────────────────────
  console.log('\n──── 1. Weeks in DB but not in JSON ────');
  if (dbOnly.length === 0) console.log('  (none)');
  else for (const r of dbOnly) {
    console.log(`  W${r.week}D${r.day}  "${r.name}"  stations=${r.stationCount}  category=${r.category}`);
  }

  console.log('\n──── 2. Weeks in JSON but not in DB ────');
  if (jsonOnly.length === 0) console.log('  (none)');
  else for (const r of jsonOnly) {
    console.log(`  W${r.week}D${r.day}  "${r.title}"  stations=${r.stationCount}  category=${r.category}`);
  }

  console.log('\n──── 3. Weeks where names differ ────');
  if (nameDiff.length === 0) console.log('  (none)');
  else for (const r of nameDiff) {
    console.log(`  W${r.db.week}D${r.db.day ?? 1}`);
    console.log(`    DB:    "${r.db.name}"  stations=${r.db.stationCount}`);
    console.log(`    JSON:  "${r.json.title}"  stations=${r.json.stationCount}`);
  }

  // ── Week 10 deep-dive ────────────────────────────────────────────
  console.log('\n──── 4. Week 10 deep dive ────');
  const wk10Key = '10|1';
  const wk10Db = dbByKey.get(wk10Key);
  const wk10Json = jsonByKey.get(wk10Key);

  if (!wk10Db && !wk10Json) {
    console.log('  Neither DB nor JSON has a Week 10 template.');
  } else {
    if (wk10Db) {
      console.log(`  DB Week 10:`);
      console.log(`    name="${wk10Db.name}"`);
      console.log(`    category=${wk10Db.category}  stations=${wk10Db.stationCount}`);
      console.log(`    requires_review=${wk10Db.requires_review}  review_notes=${wk10Db.review_notes ? `"${wk10Db.review_notes}"` : 'null'}`);
      // Pull station detail for Week 10
      if (wk10Db.stationCount > 0) {
        const { rows: stations } = await c.query(
          `
          SELECT sort_order, station_type, station_name, scenario_title,
                 difficulty, notes, jsonb_array_length(COALESCE(skills, '[]'::jsonb)) AS skill_count
          FROM lab_template_stations
          WHERE template_id = $1
          ORDER BY sort_order
          `,
          [wk10Db.id]
        );
        console.log(`    DB stations:`);
        for (const s of stations) {
          console.log(`      ${s.sort_order}. [${s.station_type}] ${s.station_name || '(no name)'}` +
                      `  skills=${s.skill_count}` +
                      (s.scenario_title ? `  scenario="${s.scenario_title}"` : '') +
                      (s.difficulty ? `  difficulty=${s.difficulty}` : ''));
          if (s.notes) console.log(`         notes: ${s.notes}`);
        }
      }
    } else {
      console.log('  DB has no Week 10 template.');
    }
    console.log('');
    if (wk10Json) {
      console.log(`  JSON Week 10:`);
      console.log(`    title="${wk10Json.title}"`);
      console.log(`    category=${wk10Json.category}  stations=${wk10Json.stationCount}`);
      if (wk10Json.stationCount > 0) {
        for (const s of wk10Json.stations) {
          console.log(`    [${s.station_type}] ${s.station_name || '(no name)'}` +
                      `  skills=${(s.skills ?? []).length}`);
        }
      }
    } else {
      console.log('  JSON has no Week 10 template.');
    }
  }

  console.log('\n──── Summary ────');
  console.log(`  DB-only:    ${dbOnly.length}`);
  console.log(`  JSON-only:  ${jsonOnly.length}`);
  console.log(`  Name diffs: ${nameDiff.length}`);
  console.log(`  Identical:  ${same.length}`);
  console.log(`\n  (read-only — no changes made)`);

  await c.end();
})();
