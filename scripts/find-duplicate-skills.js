#!/usr/bin/env node
// Find duplicate skill sheets in the database
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env.local
try {
  const envPath = path.join(__dirname, '..', '.env.local');
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
} catch {}

function getConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  const host = process.env.SUPABASE_DB_HOST || 'aws-0-us-west-2.pooler.supabase.com';
  const port = process.env.SUPABASE_DB_PORT || '5432';
  const user = process.env.SUPABASE_DB_USER || 'postgres.mkrqpwncfjpppxyntdtp';
  const password = process.env.SUPABASE_DB_PASSWORD;
  const database = process.env.SUPABASE_DB_NAME || 'postgres';
  if (!password) { console.error('No DB connection configured'); process.exit(1); }
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

async function run() {
  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log('Connected to database.\n');

  // 1. Exact skill_name duplicates
  console.log('=== EXACT SKILL_NAME DUPLICATES ===');
  const dupes = await client.query(`
    SELECT skill_name, COUNT(*) as copies, array_agg(id ORDER BY id) as ids
    FROM skill_sheets
    GROUP BY skill_name
    HAVING COUNT(*) > 1
    ORDER BY skill_name
  `);
  if (dupes.rows.length === 0) {
    console.log('No exact duplicates found.\n');
  } else {
    console.log(`Found ${dupes.rows.length} duplicate groups:\n`);
    for (const row of dupes.rows) {
      console.log(`  "${row.skill_name}" - ${row.copies} copies, IDs: [${row.ids.join(', ')}]`);
    }
    console.log();
  }

  // 2. All skill sheets
  console.log('=== ALL SKILL SHEETS ===');
  const all = await client.query(`
    SELECT id, skill_name, program, source, source_priority, canonical_skill_id
    FROM skill_sheets
    ORDER BY skill_name
  `);
  console.log(`Total skill sheets: ${all.rows.length}\n`);
  for (const row of all.rows) {
    console.log(`  [${row.id}] ${row.skill_name} | prog=${row.program} | src=${row.source} | prio=${row.source_priority} | canonical=${row.canonical_skill_id}`);
  }
  console.log();

  // 3. Evaluation counts per skill_sheet
  console.log('=== EVALUATION COUNTS PER SKILL SHEET ===');
  const evals = await client.query(`
    SELECT skill_sheet_id, COUNT(*) as eval_count
    FROM student_skill_evaluations
    GROUP BY skill_sheet_id
    ORDER BY eval_count DESC
  `);
  if (evals.rows.length === 0) {
    console.log('No evaluations found.\n');
  } else {
    for (const row of evals.rows) {
      // Find the skill name for this ID
      const skill = all.rows.find(a => a.id === row.skill_sheet_id);
      console.log(`  skill_sheet_id=${row.skill_sheet_id} (${skill?.skill_name || 'UNKNOWN'}) => ${row.eval_count} evaluations`);
    }
    console.log();
  }

  // 4. Cross-reference: for each duplicate group, show eval counts
  if (dupes.rows.length > 0) {
    console.log('=== DUPLICATE GROUPS WITH EVAL COUNTS ===');
    for (const group of dupes.rows) {
      console.log(`\n  "${group.skill_name}":`);
      for (const id of group.ids) {
        const evalRow = evals.rows.find(e => e.skill_sheet_id === id);
        const count = evalRow ? evalRow.eval_count : 0;
        const detail = all.rows.find(a => a.id === id);
        console.log(`    ID ${id}: ${count} evals | prog=${detail?.program} | src=${detail?.source} | prio=${detail?.source_priority} | canonical=${detail?.canonical_skill_id}`);
      }
    }
    console.log();
  }

  // 5. Check for any tables referencing skill_sheets
  console.log('=== FK REFERENCES TO SKILL_SHEETS ===');
  const fks = await client.query(`
    SELECT tc.table_name, kcu.column_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE ccu.table_name = 'skill_sheets' AND tc.constraint_type = 'FOREIGN KEY'
  `);
  for (const row of fks.rows) {
    console.log(`  ${row.table_name}.${row.column_name} -> skill_sheets (${row.constraint_name})`);
  }
  console.log();

  await client.end();
}

run().catch(err => { console.error(err); process.exit(1); });
