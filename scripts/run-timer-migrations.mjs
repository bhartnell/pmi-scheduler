// Run timer migrations using Supabase client
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env vars
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY in .env.local');
  process.exit(1);
}

console.log('Connecting to Supabase:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration(name, sql) {
  console.log(`\nRunning migration: ${name}`);
  console.log('-'.repeat(50));

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      // Try direct query if exec_sql doesn't exist
      throw error;
    }

    console.log(`✓ ${name} completed successfully`);
    return true;
  } catch (err) {
    console.error(`✗ ${name} failed:`, err.message);
    return false;
  }
}

async function main() {
  console.log('='.repeat(50));
  console.log('Running Timer Migrations');
  console.log('='.repeat(50));

  // Read migration files
  const timerStateSql = readFileSync(
    join(__dirname, '..', 'supabase', 'migrations', '20260123_lab_timer_state.sql'),
    'utf8'
  );

  const readyStatusSql = readFileSync(
    join(__dirname, '..', 'supabase', 'migrations', '20260123_lab_timer_ready_status.sql'),
    'utf8'
  );

  // Since we can't run raw SQL directly via the JS client,
  // we'll need to use the REST API or print instructions

  console.log('\n⚠️  The Supabase JS client cannot run raw DDL statements.');
  console.log('\nPlease run these migrations manually in Supabase SQL Editor:');
  console.log('\n1. Go to: https://supabase.com/dashboard');
  console.log('2. Select your project');
  console.log('3. Go to SQL Editor');
  console.log('4. Run these SQL files in order:\n');

  console.log('--- Migration 1: lab_timer_state ---');
  console.log(timerStateSql);

  console.log('\n--- Migration 2: lab_timer_ready_status ---');
  console.log(readyStatusSql);

  console.log('\n' + '='.repeat(50));
  console.log('Copy the SQL above and run in Supabase SQL Editor');
  console.log('='.repeat(50));
}

main().catch(console.error);
