#!/usr/bin/env node
// Run SQL migration files directly against Supabase production database.
//
// Usage:
//   node scripts/run-migration.js supabase/migrations/<filename>.sql
//   node scripts/run-migration.js supabase/migrations/<filename>.sql --dry-run
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
