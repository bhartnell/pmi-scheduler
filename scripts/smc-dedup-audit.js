// One-off audit: shows smc_requirements rows that share the same skill_id
// across programs. These are the "deduplication opportunities" — the
// coverage logic already treats skill_id as canonical, so as long as
// these rows all point to the same catalog id, coverage of that skill
// at a station automatically credits every program's SMC row for it.
//
// Usage: node scripts/smc-dedup-audit.js
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const e = t.indexOf('=');
  if (e === -1) continue;
  const k = t.substring(0, e).trim();
  const v = t.substring(e + 1).trim();
  if (!process.env[k]) process.env[k] = v;
}

async function run() {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL });
  await c.connect();

  // Program id → abbreviation map for readable output
  const progRes = await c.query(
    `SELECT id, abbreviation FROM programs WHERE is_active = true`
  );
  const progAbbr = {};
  for (const p of progRes.rows) progAbbr[p.id] = p.abbreviation;

  const r = await c.query(
    `SELECT sr.skill_id,
            s.name as catalog_name,
            s.category,
            array_agg(DISTINCT sr.program_id::text ORDER BY sr.program_id::text) as program_ids,
            COUNT(DISTINCT sr.program_id) as program_count,
            array_agg(DISTINCT (sr.program_id::text || ':sem' || sr.semester::text)
                      ORDER BY sr.program_id::text || ':sem' || sr.semester::text) as rows
     FROM smc_requirements sr
     JOIN skills s ON s.id = sr.skill_id
     WHERE sr.skill_id IS NOT NULL AND sr.is_active = true
     GROUP BY sr.skill_id, s.name, s.category
     HAVING COUNT(DISTINCT sr.program_id) > 1
     ORDER BY program_count DESC, s.name`
  );

  console.log(
    `\nShared SMC skills (same skill_id across ≥2 programs): ${r.rows.length}\n`
  );
  console.log('─'.repeat(100));
  for (const row of r.rows) {
    const progs = row.program_ids
      .map((id) => progAbbr[id] || id.substring(0, 8))
      .join(' + ');
    console.log(
      `  [${progs}]  ${row.catalog_name}${row.category ? ' — ' + row.category : ''}`
    );
  }
  console.log('─'.repeat(100));

  // Also count total SMC rows per program for context
  const totalR = await c.query(
    `SELECT sr.program_id, COUNT(*) as total,
            COUNT(*) FILTER (WHERE sr.skill_id IS NOT NULL) as linked
     FROM smc_requirements sr
     WHERE sr.is_active = true
     GROUP BY sr.program_id
     ORDER BY sr.program_id`
  );
  console.log('\nSMC totals per program:');
  for (const row of totalR.rows) {
    const abbr = progAbbr[row.program_id] || row.program_id.substring(0, 8);
    console.log(`  ${abbr.padEnd(6)} ${row.linked}/${row.total} linked`);
  }

  await c.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
