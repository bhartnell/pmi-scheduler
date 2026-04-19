#!/usr/bin/env node
/**
 * Seed the authoritative Paramedic (CoAEMSP) SMC list.
 *
 * Source: CoAEMSP Student Minimum Competency Matrix, Table 3 Motor
 * Skills, provided by user 2026-04-18. 16 skills with program minimum
 * numbers and simulation-permitted flags.
 *
 * Behavior:
 *   1. Deletes existing PM sem1 + sem2 rows from smc_requirements
 *      (44 rows auto-seeded from lab_template_stations.skills jsonb
 *      on 2026-04-17 — not canonical).
 *   2. Inserts the authoritative 16 rows distributed across semesters
 *      per the user's curriculum mapping:
 *        Sem 1: all procedural/airway/cardiac skills
 *        Sem 2: IV bolus, IV infusion (med admin / scenario emphasis)
 *   3. Runs the same name-match heuristic used for EMT/AEMT. Skill
 *      names are chosen to exactly match catalog entries so every
 *      row auto-links via the exact-match path.
 *
 * Usage:
 *   node scripts/seed-pm-smc.js [--dry-run]
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const DRY_RUN = process.argv.includes('--dry-run');

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        m[i][j] = m[i - 1][j - 1];
      } else {
        m[i][j] = Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
      }
    }
  }
  return m[b.length][a.length];
}

function matchSkill(name, catalog) {
  const n = name.trim().toLowerCase();
  for (const s of catalog) {
    if (s.name.toLowerCase() === n) return { skill: s, method: 'exact' };
  }
  let containsMatch = null;
  for (const s of catalog) {
    const sn = s.name.toLowerCase();
    if (sn.includes(n) || n.includes(sn)) {
      if (!containsMatch || s.name.length < containsMatch.skill.name.length) {
        containsMatch = { skill: s, method: 'contains' };
      }
    }
  }
  if (containsMatch) return containsMatch;
  let best = null;
  for (const s of catalog) {
    const d = levenshtein(n, s.name.toLowerCase());
    if (d <= 3 && (!best || d < best.distance)) {
      best = { skill: s, method: 'levenshtein', distance: d };
    }
  }
  return best;
}

// ── Paramedic SMC (CoAEMSP Table 3, Motor Skills) ──
// Schema: [semester, catalog_skill_name, min_attempts, sim_permitted]
//
// Skill names chosen to exact-match catalog entries verified via the
// 2026-04-18 inventory. All are currently populated:
//   IV Access, IV Bolus Medication, Oral Endotracheal Intubation,
//   IV Infusion Setup, IM Injection, IO Access, Perform PPV with BVM,
//   Endotracheal Suctioning, FBAO Removal with Magill Forceps,
//   Surgical Cricothyrotomy, Supraglottic Airway, Needle Decompression,
//   Synchronized Cardioversion, Defibrillation - Manual,
//   Transcutaneous Pacing, Perform chest compressions (added today).
const PM_SMC = [
  // Semester 1 — procedural / airway / cardiac skills
  [1, 'IV Access',                         25, false],
  [1, 'Oral Endotracheal Intubation',      10, true],
  [1, 'IM Injection',                      2,  false],
  [1, 'IO Access',                         2,  true],
  [1, 'Supraglottic Airway',               10, true],
  [1, 'Perform PPV with BVM',              10, true],
  [1, 'Synchronized Cardioversion',        2,  true],
  // PM scope is manual defibrillation (AED is the EMT version)
  [1, 'Defibrillation - Manual',           2,  true],
  [1, 'Transcutaneous Pacing',             2,  true],
  [1, 'Perform chest compressions',        2,  true],
  [1, 'Needle Decompression',              2,  true],
  // Surgical crics are the advanced-scope variant; needle crics are in
  // the catalog too but PMs typically train on both — SMC text doesn't
  // specify, so we link to the surgical entry and keep the needle
  // variant available for station_skills if needed.
  [1, 'Surgical Cricothyrotomy',           2,  true],
  [1, 'Endotracheal Suctioning',           2,  true],
  [1, 'FBAO Removal with Magill Forceps',  2,  true],

  // Semester 2 — medication administration emphasis.
  // Both flagged lab_tracked=false (tracked in Platinum, not lab).
  [2, 'IV Bolus Medication',               10, false, { lab_tracked: false }],
  // IV Infusion Setup is the closest catalog match for CoAEMSP's
  // "Administer IV infusion medication" — covers the same skill scope.
  [2, 'IV Infusion Setup',                 2,  true,  { lab_tracked: false }],
];

async function main() {
  const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
  await client.connect();
  console.log('Connected to Supabase.\n');

  const progRes = await client.query(
    `SELECT id, abbreviation, name FROM programs WHERE is_active = true`
  );
  const pm = progRes.rows.find((p) => {
    const a = (p.abbreviation || '').toUpperCase();
    return a === 'PM' || a === 'PMD' || /paramedic/i.test(p.name);
  });
  if (!pm) throw new Error('Paramedic program not found');
  console.log(`PM program: ${pm.id}\n`);

  const skillsRes = await client.query(
    `SELECT id, name, category FROM skills WHERE is_active = true`
  );
  const catalog = skillsRes.rows;
  console.log(`Skills catalog: ${catalog.length} active rows\n`);

  if (!DRY_RUN) {
    const del = await client.query(
      `DELETE FROM smc_requirements WHERE program_id = $1 AND semester IN (1, 2)`,
      [pm.id]
    );
    console.log(`Cleared: ${del.rowCount} PM rows (sem 1+2)\n`);
  } else {
    console.log('[DRY RUN] Would delete existing PM sem 1+2 rows\n');
  }

  const rows = [];
  const unmatched = [];
  PM_SMC.forEach(([semester, name, minAttempts, simPermitted, opts = {}], idx) => {
    const match = matchSkill(name, catalog);
    if (!match) unmatched.push(name);
    rows.push({
      program_id: pm.id,
      semester,
      skill_id: match ? match.skill.id : null,
      skill_name: name,
      category: match ? match.skill.category : null,
      min_attempts: minAttempts,
      is_platinum: false,
      sim_permitted: simPermitted,
      lab_tracked: opts.lab_tracked !== false, // default true
      week_number: null,
      display_order: idx + 1,
      match_method: match ? match.method : 'none',
    });
  });

  const matched = rows.filter((r) => r.skill_id).length;
  console.log(`Prepared ${rows.length} PM SMC rows.`);
  console.log(`Auto-matched to catalog: ${matched}/${rows.length}`);
  if (unmatched.length > 0) {
    console.log('Unmatched:');
    for (const u of unmatched) console.log(`  ${u}`);
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No inserts performed.');
    await client.end();
    return;
  }

  for (const r of rows) {
    await client.query(
      `INSERT INTO smc_requirements
        (program_id, semester, skill_id, skill_name, category,
         min_attempts, is_platinum, sim_permitted, lab_tracked,
         week_number, display_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
       ON CONFLICT (program_id, semester, skill_name) DO UPDATE
         SET skill_id = EXCLUDED.skill_id,
             category = EXCLUDED.category,
             min_attempts = EXCLUDED.min_attempts,
             is_platinum = EXCLUDED.is_platinum,
             sim_permitted = EXCLUDED.sim_permitted,
             lab_tracked = EXCLUDED.lab_tracked,
             week_number = EXCLUDED.week_number,
             display_order = EXCLUDED.display_order,
             is_active = true,
             updated_at = now()`,
      [
        r.program_id,
        r.semester,
        r.skill_id,
        r.skill_name,
        r.category,
        r.min_attempts,
        r.is_platinum,
        r.sim_permitted,
        r.lab_tracked,
        r.week_number,
        r.display_order,
      ]
    );
  }
  console.log(`\nInserted ${rows.length} PM SMC rows.`);

  await client.end();
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
