#!/usr/bin/env node
// Check all FKs referencing lab_stations
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Load env from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const [, key, val] = match;
      if (!process.env[key.trim()]) process.env[key.trim()] = val.trim();
    }
  }
}

function getConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  const host = process.env.SUPABASE_DB_HOST;
  const pass = process.env.SUPABASE_DB_PASSWORD;
  if (host && pass) return `postgresql://postgres.mkrqpwncfjpppxyntdtp:${pass}@${host}:5432/postgres`;
  throw new Error('No database connection string found');
}

(async () => {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  console.log('=== All FKs referencing lab_stations ===');
  const res = await client.query(`
    SELECT tc.table_name, kcu.column_name, tc.constraint_name, rc.delete_rule, c.is_nullable
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.columns c ON c.table_name = tc.table_name AND c.column_name = kcu.column_name
    WHERE ccu.table_name = 'lab_stations'
      AND tc.constraint_type = 'FOREIGN KEY'
    ORDER BY rc.delete_rule, tc.table_name
  `);

  for (const row of res.rows) {
    const problem = (row.delete_rule === 'SET NULL' && row.is_nullable === 'NO') ? ' ⚠️ NOT NULL + SET NULL = WILL FAIL' :
                    (row.delete_rule === 'RESTRICT' || row.delete_rule === 'NO ACTION') ? ' ⚠️ RESTRICT/NO ACTION = WILL BLOCK' : ' ✅';
    console.log(`  ${row.table_name}.${row.column_name} | ${row.delete_rule} | nullable=${row.is_nullable} | ${row.constraint_name}${problem}`);
  }

  await client.end();
})();
