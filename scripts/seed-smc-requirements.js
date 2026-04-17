#!/usr/bin/env node
/**
 * Seed smc_requirements from lab_template_stations.skills jsonb.
 *
 * For each (program, semester) pair present in lab_day_templates:
 *   1. Aggregate all skills from lab_template_stations.skills across
 *      every template, deduping by skill name.
 *   2. Take MAX(min_attempts) and ANY(platinum_skill) per name.
 *   3. Fuzzy-match the name to skills.name (case-insensitive exact,
 *      then Levenshtein distance <= 3 or prefix match).
 *   4. Upsert into smc_requirements (ON CONFLICT does nothing — rerunning
 *      is safe and will not overwrite manual edits).
 *
 * Program mapping:
 *   'emt'       -> programs where abbreviation = 'EMT'
 *   'aemt'      -> programs where abbreviation = 'AEMT'
 *   'paramedic' -> programs where abbreviation IN ('PM','PMD')
 *
 * Usage: node scripts/seed-smc-requirements.js [--dry-run]
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

// Find best matching skill from catalog for a raw template name.
// Priority: exact (ci) > contains > Levenshtein distance <= 3.
function matchSkill(name, catalog) {
  const n = name.trim().toLowerCase();
  // 1. Exact CI
  for (const s of catalog) {
    if (s.name.toLowerCase() === n) return { skill: s, method: 'exact' };
  }
  // 2. Contains either way (choose shorter candidate)
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
  // 3. Levenshtein <= 3 (for typos/abbreviations)
  let best = null;
  for (const s of catalog) {
    const d = levenshtein(n, s.name.toLowerCase());
    if (d <= 3 && (!best || d < best.distance)) {
      best = { skill: s, method: 'levenshtein', distance: d };
    }
  }
  return best;
}

async function main() {
  const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
  await client.connect();
  console.log('Connected to Supabase.\n');

  // 1. Load programs
  const progRes = await client.query(
    `SELECT id, name, abbreviation FROM programs WHERE is_active = true`
  );
  const programs = progRes.rows;
  const programByKey = {}; // 'emt' | 'aemt' | 'paramedic' -> program row
  for (const p of programs) {
    const a = (p.abbreviation || '').toUpperCase();
    if (a === 'EMT') programByKey.emt = p;
    else if (a === 'AEMT') programByKey.aemt = p;
    else if (a === 'PM' || a === 'PMD' || /paramedic/i.test(p.name))
      programByKey.paramedic = p;
  }
  console.log('Program mapping:');
  for (const [k, v] of Object.entries(programByKey)) {
    console.log(`  ${k} -> ${v.abbreviation} (${v.name}) id=${v.id}`);
  }
  console.log('');

  // 2. Load skills catalog
  const skillsRes = await client.query(
    `SELECT id, name, category FROM skills WHERE is_active = true`
  );
  const catalog = skillsRes.rows;
  console.log(`Skills catalog: ${catalog.length} active rows\n`);

  // 3. Pull every template station's skills jsonb, grouped by (program, semester)
  const tsRes = await client.query(`
    SELECT t.program, t.semester, ts.station_name, ts.skills
    FROM lab_day_templates t
    JOIN lab_template_stations ts ON ts.template_id = t.id
    WHERE t.program IS NOT NULL AND t.semester IS NOT NULL
  `);

  // Group: program_semester_key -> Map<name, {min_attempts, is_platinum, category}>
  const byGroup = new Map();
  for (const row of tsRes.rows) {
    const key = `${row.program}|${row.semester}`;
    if (!byGroup.has(key)) byGroup.set(key, new Map());
    const bucket = byGroup.get(key);
    const skills = Array.isArray(row.skills) ? row.skills : [];
    for (const sk of skills) {
      if (!sk || typeof sk !== 'object') continue;
      const name = String(sk.name || '').trim();
      if (!name) continue;
      const min = Number(sk.min_attempts) || 1;
      const plat = !!sk.platinum_skill;
      const existing = bucket.get(name);
      if (!existing) {
        bucket.set(name, {
          min_attempts: min,
          is_platinum: plat,
          category: sk.category || null,
        });
      } else {
        existing.min_attempts = Math.max(existing.min_attempts, min);
        existing.is_platinum = existing.is_platinum || plat;
      }
    }
  }

  // 4. For each group, match + upsert
  const toInsert = [];
  const manualReview = [];
  for (const [key, bucket] of byGroup) {
    const [progKey, semStr] = key.split('|');
    const program = programByKey[progKey];
    if (!program) {
      console.warn(`  (skip) No program row matches key "${progKey}"`);
      continue;
    }
    const semester = parseInt(semStr, 10);
    let order = 0;
    for (const [name, meta] of bucket) {
      order++;
      const match = matchSkill(name, catalog);
      toInsert.push({
        program_id: program.id,
        program_key: progKey,
        semester,
        skill_id: match ? match.skill.id : null,
        skill_name: name,
        category: meta.category || (match ? match.skill.category : null),
        min_attempts: meta.min_attempts,
        is_platinum: meta.is_platinum,
        display_order: order,
        match_method: match ? match.method : 'none',
      });
      if (!match) {
        manualReview.push({ program: progKey, semester, name });
      }
    }
  }

  // 5. Summary
  console.log(`Found ${toInsert.length} SMC rows across groups:`);
  const groupCounts = {};
  for (const r of toInsert) {
    const k = `${r.program_key}/sem${r.semester}`;
    groupCounts[k] = (groupCounts[k] || 0) + 1;
  }
  for (const [k, v] of Object.entries(groupCounts)) {
    console.log(`  ${k}: ${v} skills`);
  }

  const matched = toInsert.filter((r) => r.skill_id).length;
  console.log(
    `\nMatching: ${matched}/${toInsert.length} auto-matched to skills catalog`
  );
  console.log(`Manual review needed: ${manualReview.length} items`);
  if (manualReview.length > 0 && manualReview.length <= 20) {
    console.log('  Unmatched names:');
    for (const r of manualReview.slice(0, 20)) {
      console.log(`    [${r.program}/sem${r.semester}] ${r.name}`);
    }
  } else if (manualReview.length > 20) {
    console.log(`  (showing first 20 of ${manualReview.length})`);
    for (const r of manualReview.slice(0, 20)) {
      console.log(`    [${r.program}/sem${r.semester}] ${r.name}`);
    }
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes written.');
    await client.end();
    return;
  }

  // 6. Insert (ON CONFLICT DO NOTHING — safe to rerun, won't overwrite edits)
  let inserted = 0;
  for (const r of toInsert) {
    const res = await client.query(
      `INSERT INTO smc_requirements
        (program_id, semester, skill_id, skill_name, category,
         min_attempts, is_platinum, display_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (program_id, semester, skill_name) DO NOTHING`,
      [
        r.program_id,
        r.semester,
        r.skill_id,
        r.skill_name,
        r.category,
        r.min_attempts,
        r.is_platinum,
        r.display_order,
      ]
    );
    if (res.rowCount > 0) inserted++;
  }
  console.log(`\nInserted ${inserted} new rows (skipped ${toInsert.length - inserted} existing).`);

  await client.end();
}

main().catch((e) => {
  console.error('\nSeed failed:', e);
  process.exit(1);
});
