#!/usr/bin/env node
// Phase 2: Semantic dedup - dump all active skill sheets for matching
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
  return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

async function main() {
  const client = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Get ALL active skill sheets with counts
  const { rows } = await client.query(`
    SELECT ss.id, ss.name, ss.program_type, ss.category, ss.is_active,
      (SELECT COUNT(*) FROM skill_sheet_steps WHERE skill_sheet_id = ss.id) as step_count,
      (SELECT COUNT(*) FROM student_skill_evaluations WHERE skill_sheet_id = ss.id) as eval_count,
      (SELECT COUNT(*) FROM skill_sheet_assignments WHERE skill_sheet_id = ss.id) as assignment_count
    FROM skill_sheets ss
    WHERE ss.is_active = true
    ORDER BY ss.name
  `);

  console.log(`\n=== ALL ${rows.length} ACTIVE SKILL SHEETS ===\n`);
  console.log('ID | Name | Program | Steps | Evals | Assignments');
  console.log('-'.repeat(120));
  for (const r of rows) {
    console.log(`${r.id.substring(0,8)} | ${r.name} | ${r.program_type} | ${r.step_count} | ${r.eval_count} | ${r.assignment_count}`);
  }

  // Also show inactive
  const { rows: inactive } = await client.query(`
    SELECT id, name, program_type, is_active FROM skill_sheets WHERE is_active = false ORDER BY name
  `);
  console.log(`\n=== ${inactive.length} INACTIVE SKILL SHEETS ===`);
  for (const r of inactive) {
    console.log(`${r.id.substring(0,8)} | ${r.name} | ${r.program_type}`);
  }

  // Check lab_stations for skill_sheet_id column
  const { rows: cols } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'lab_stations' AND column_name = 'skill_sheet_id'
  `);
  console.log(`\nlab_stations has skill_sheet_id column: ${cols.length > 0}`);

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
