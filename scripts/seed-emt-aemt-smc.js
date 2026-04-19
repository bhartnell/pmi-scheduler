#!/usr/bin/env node
/**
 * Seed authoritative EMT and AEMT SMC lists.
 *
 * Source documents (provided by user 2026-04-18):
 *   - EMT_Platinum_skills_list_by_week, sheet "Main Copy" — 53 skills
 *     across weeks 1-14, tagged Platinum Only where noted.
 *   - AEMT_SMC, sheet "Skills" (Table 3) — 13 CoAEMSP motor skills
 *     with minimum attempt counts, most marked * (simulation permitted).
 *
 * Behavior:
 *   1. Deletes the existing auto-seeded EMT + AEMT sem1 rows from
 *      smc_requirements (the 56 EMT + 32 AEMT rows inferred from
 *      lab_template_stations.skills jsonb on 2026-04-17).
 *   2. Inserts the authoritative lists below with week_number and
 *      sim_permitted populated.
 *   3. Runs the same name-match heuristic used in seed-smc-requirements.js
 *      (exact → contains → Levenshtein <= 3) to link skill_id into the
 *      existing skills catalog where possible. Unmatched rows are
 *      inserted with skill_id = null for manual admin review.
 *
 * Usage:
 *   node scripts/seed-emt-aemt-smc.js [--dry-run]
 *
 * Safe to rerun. The delete step idempotently resets EMT/AEMT sem1
 * before reinserting, so the canonical list stays authoritative.
 * Paramedic SMCs are not touched.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env.local
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

// ── Levenshtein (identical to seed-smc-requirements.js) ──
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

// ── Authoritative EMT list (53 skills) ──
// Schema: [week, name, { platinum_only?, min_attempts? }]
// Defaults: min_attempts = 1, platinum_only = false.
// platinum_only → is_platinum = true (Platinum-tracked only, not JBL).
const EMT_SMC = [
  // Week 1
  [1, 'PPE'],
  [1, 'Physical restraint'],
  // Week 3
  // Names aligned to catalog entries (migration 20260418_catalog_emt_foundations)
  // so the auto-matcher exact-matches instead of falling through to fuzzy.
  [3, 'Patient lifting and moving techniques'],
  [3, 'Patient report to ALS provider', { platinum_only: true }],
  [3, 'Team Leader (Lab)', { platinum_only: true }],
  [3, 'Blood pressure by auscultation'],
  [3, 'Blood pressure by palpation'],
  [3, 'Level of consciousness (LOC)'],
  [3, 'Patient history'],
  [3, 'Automated blood pressure'],
  [3, 'Blood glucose'],
  [3, 'Pulses assessment'],
  [3, 'Pupils assessment'],
  [3, 'Skin signs assessment'],
  // Week 4
  [4, 'NPA insertion'],
  [4, 'CPR — adult/child 1-rescuer'],
  [4, 'CPR — adult/child 2-rescuer'],
  [4, 'CPR — infant (one-rescuer)'],
  [4, 'FBAO — conscious adult/child'],
  [4, 'FBAO — conscious infant'],
  [4, 'FBAO — unconscious adult/child'],
  [4, 'FBAO — unconscious infant'],
  // Week 5
  [5, 'Oxygen tank assembly/operation'],
  [5, 'BiPAP/CPAP application'],
  [5, 'BVM ventilation of apneic adult'],
  [5, 'Humidified oxygen delivery'],
  [5, 'Manual airway maneuvers'],
  [5, 'OPA insertion'],
  [5, 'Oxygen administration by non-rebreather mask'],
  [5, 'Rigid catheter suctioning'],
  [5, 'Pulse oximetry'],
  // Week 6
  [6, 'Oral medication administration'],
  [6, 'Sublingual medication administration'],
  [6, 'Auto-injector administration'],
  [6, 'Patient Assessment — Medical (EMT)', { platinum_only: true }],
  // Week 7
  [7, 'Lung Sounds (Lab)', { platinum_only: true }],
  [7, 'MDI administration'],
  [7, 'Nebulized medication administration'],
  [7, '12-lead ECG acquisition'],
  [7, 'Cardiac Arrest Management / AED (EMT)'],
  // Week 8
  [8, 'Naloxone administration'],
  // Week 9
  [9, 'Patient Assessment — Trauma (EMT)', { platinum_only: true }],
  [9, 'Bleeding control and shock management (EMT)'],
  // Week 10
  [10, 'Hemorrhage control — wound packing'],
  // Week 11
  [11, 'Cervical collar application'],
  [11, 'Spinal immobilization — seated patient'],
  [11, 'Spinal immobilization — supine patient'],
  [11, 'Joint immobilization'],
  [11, 'Long bone immobilization'],
  [11, 'Traction splint application'],
  // Week 12
  [12, 'Childbirth — normal delivery'],
  // Week 14
  [14, 'Patient report to receiving facility'],
];

// ── Authoritative AEMT list (13 skills) ──
// Source: CoAEMSP minimum motor skills. The * in the source document
// means "simulation permitted" toward the minimum count.
// Schema: [name, min_attempts, sim_permitted]
const AEMT_SMC = [
  ['Venous blood sampling', 4, true],
  ['Establish IV access', 20, false],
  ['Administer IV bolus medication', 10, true],
  ['Administer IM injection', 2, true],
  ['Intranasal medication administration', 2, true],
  ['Establish IO access', 2, true],
  ['Intraosseous medication administration', 2, true],
  ['Perform PPV with BVM', 10, true],
  ['Perform endotracheal suctioning', 2, true],
  ['Insert supraglottic airway', 10, true],
  // Catalog name: "AED / Defibrillation" (exact match after rename)
  ['AED / Defibrillation', 2, true],
  ['Perform chest compressions', 2, true],
  ['ETCO2 monitoring and waveform interpretation', 10, true],
];

async function main() {
  const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
  await client.connect();
  console.log('Connected to Supabase.\n');

  // 1. Resolve program IDs
  const progRes = await client.query(
    `SELECT id, abbreviation, name FROM programs WHERE is_active = true`
  );
  const programs = progRes.rows;
  const getProgram = (abbr) =>
    programs.find((p) => (p.abbreviation || '').toUpperCase() === abbr);
  const emtProgram = getProgram('EMT');
  const aemtProgram = getProgram('AEMT');

  if (!emtProgram) throw new Error('EMT program not found');
  if (!aemtProgram) throw new Error('AEMT program not found');
  console.log(`EMT program:  ${emtProgram.id}`);
  console.log(`AEMT program: ${aemtProgram.id}\n`);

  // 2. Load skills catalog
  const skillsRes = await client.query(
    `SELECT id, name, category FROM skills WHERE is_active = true`
  );
  const catalog = skillsRes.rows;
  console.log(`Skills catalog: ${catalog.length} active rows\n`);

  // 3. Delete existing auto-seeded EMT sem1 + AEMT sem1 rows
  if (!DRY_RUN) {
    const delEmt = await client.query(
      `DELETE FROM smc_requirements WHERE program_id = $1 AND semester = 1`,
      [emtProgram.id]
    );
    const delAemt = await client.query(
      `DELETE FROM smc_requirements WHERE program_id = $1 AND semester = 1`,
      [aemtProgram.id]
    );
    console.log(
      `Cleared: ${delEmt.rowCount} EMT rows, ${delAemt.rowCount} AEMT rows\n`
    );
  } else {
    console.log('[DRY RUN] Would delete existing EMT + AEMT sem1 rows\n');
  }

  // 4. Build rows + match
  const rows = [];
  const unmatched = [];

  EMT_SMC.forEach(([week, name, opts = {}], idx) => {
    const match = matchSkill(name, catalog);
    if (!match) unmatched.push({ program: 'EMT', name });
    rows.push({
      program_id: emtProgram.id,
      semester: 1,
      skill_id: match ? match.skill.id : null,
      skill_name: name,
      category: match ? match.skill.category : null,
      min_attempts: opts.min_attempts || 1,
      is_platinum: !!opts.platinum_only,
      sim_permitted: false,
      week_number: week,
      display_order: idx + 1,
      match_method: match ? match.method : 'none',
    });
  });

  AEMT_SMC.forEach(([name, minAttempts, simPermitted], idx) => {
    const match = matchSkill(name, catalog);
    if (!match) unmatched.push({ program: 'AEMT', name });
    rows.push({
      program_id: aemtProgram.id,
      semester: 1,
      skill_id: match ? match.skill.id : null,
      skill_name: name,
      category: match ? match.skill.category : null,
      min_attempts: minAttempts,
      is_platinum: false,
      sim_permitted: simPermitted,
      week_number: null,
      display_order: idx + 1,
      match_method: match ? match.method : 'none',
    });
  });

  // 5. Summary
  const matched = rows.filter((r) => r.skill_id).length;
  console.log(`Prepared ${rows.length} rows (${EMT_SMC.length} EMT + ${AEMT_SMC.length} AEMT).`);
  console.log(`Auto-matched to catalog: ${matched}/${rows.length}`);
  console.log(`Unmatched (null skill_id): ${unmatched.length}`);
  if (unmatched.length > 0) {
    console.log('\nUnmatched skills (need manual admin link):');
    for (const u of unmatched) {
      console.log(`  [${u.program}] ${u.name}`);
    }
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No inserts performed.');
    await client.end();
    return;
  }

  // 6. Insert
  let inserted = 0;
  for (const r of rows) {
    await client.query(
      `INSERT INTO smc_requirements
        (program_id, semester, skill_id, skill_name, category,
         min_attempts, is_platinum, sim_permitted, week_number,
         display_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
       ON CONFLICT (program_id, semester, skill_name) DO UPDATE
         SET skill_id = EXCLUDED.skill_id,
             category = EXCLUDED.category,
             min_attempts = EXCLUDED.min_attempts,
             is_platinum = EXCLUDED.is_platinum,
             sim_permitted = EXCLUDED.sim_permitted,
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
        r.week_number,
        r.display_order,
      ]
    );
    inserted++;
  }
  console.log(`\nInserted / upserted ${inserted} SMC rows.`);

  await client.end();
}

main().catch((e) => {
  console.error('\nSeed failed:', e);
  process.exit(1);
});
