#!/usr/bin/env node
// Run SQL migration files directly against Supabase production database.
//
// Usage:
//   node scripts/run-migration.js supabase/migrations/<filename>.sql
//   node scripts/run-migration.js supabase/migrations/<filename>.sql --dry-run
//   node scripts/run-migration.js supabase/migrations/<filename>.sql --backup=students,cohorts
//
// --backup=t1,t2  Before applying, snapshot the listed tables into timestamped
//                 in-DB restore-point tables (_backup_<table>_<YYYYMMDDHHMMSS>).
//                 Use for genuinely DESTRUCTIVE ops (DROP/DELETE/UPDATE-many).
//                 No destructive op without a restore point. Restore + cleanup
//                 SQL is printed for each snapshot. Additive/idempotent
//                 migrations don't need it.
//
// Connection:
//   Uses DATABASE_URL env var, or falls back to .env.local SUPABASE_DB_URL,
//   or constructs from SUPABASE_DB_HOST + SUPABASE_DB_PASSWORD.

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env.local if present
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
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
} catch {
  // .env.local not found, continue with existing env
}

function getConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;

  // Construct from components
  const host = process.env.SUPABASE_DB_HOST || 'aws-0-us-west-2.pooler.supabase.com';
  const port = process.env.SUPABASE_DB_PORT || '5432';
  const user = process.env.SUPABASE_DB_USER || 'postgres.mkrqpwncfjpppxyntdtp';
  const password = process.env.SUPABASE_DB_PASSWORD;
  const database = process.env.SUPABASE_DB_NAME || 'postgres';

  if (!password) {
    console.error('ERROR: No database connection configured.');
    console.error('Set one of: DATABASE_URL, SUPABASE_DB_URL, or SUPABASE_DB_PASSWORD in .env.local');
    process.exit(1);
  }

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

async function run() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const sqlFile = args.find(a => !a.startsWith('--'));

  // --backup=t1,t2 — tables to snapshot into restore-point tables before applying.
  const backupArg = args.find(a => a.startsWith('--backup='));
  const backupTables = backupArg
    ? backupArg.slice('--backup='.length).split(',').map(s => s.trim()).filter(Boolean)
    : [];
  // Validate identifiers — these are interpolated into snapshot DDL.
  const badTable = backupTables.find(t => !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(t));
  if (badTable) {
    console.error(`❌ Invalid --backup table name: "${badTable}" (expected a plain identifier)`);
    process.exit(1);
  }

  if (!sqlFile) {
    console.error('Usage: node scripts/run-migration.js <file.sql> [--dry-run]');
    process.exit(1);
  }

  // Resolve path relative to project root
  const resolvedPath = path.isAbsolute(sqlFile)
    ? sqlFile
    : path.join(__dirname, '..', sqlFile);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(resolvedPath, 'utf8');
  const fileName = path.basename(resolvedPath);

  console.log(`\n📋 Migration: ${fileName}`);
  console.log(`   File: ${resolvedPath}`);
  console.log(`   Size: ${sql.length} bytes`);

  if (dryRun) {
    console.log('\n🔍 DRY RUN — SQL to execute:');
    console.log('─'.repeat(60));
    console.log(sql);
    console.log('─'.repeat(60));
    if (backupTables.length) {
      console.log(`\n💾 --backup: would snapshot ${backupTables.length} table(s) before applying: ${backupTables.join(', ')}`);
    }
    console.log('\n✓ Dry run complete. Remove --dry-run to execute.');
    return;
  }

  const connStr = getConnectionString();
  // Mask password in output
  const maskedConn = connStr.replace(/:([^@]+)@/, ':****@');
  console.log(`   Connection: ${maskedConn}`);

  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('   Status: Connected ✓\n');

    // Pre-migration snapshot (restore point) for destructive ops.
    if (backupTables.length) {
      const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14); // YYYYMMDDHHMMSS
      console.log(`💾 Pre-migration snapshot of ${backupTables.length} table(s)...`);
      for (const t of backupTables) {
        const snap = `_backup_${t}_${ts}`;
        await client.query(`CREATE TABLE "${snap}" AS TABLE "${t}"`);
        const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM "${snap}"`);
        console.log(`   ✓ ${t} → ${snap} (${rows[0].n} rows)`);
        console.log(`     restore: INSERT INTO "${t}" SELECT * FROM "${snap}";   cleanup: DROP TABLE "${snap}";`);
      }
      console.log('');
    }

    console.log('⏳ Executing migration...');
    await client.query(sql);
    console.log(`✅ Migration applied successfully: ${fileName}\n`);
  } catch (err) {
    console.error(`\n❌ Migration failed: ${err.message}\n`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
