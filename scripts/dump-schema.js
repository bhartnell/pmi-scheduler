#!/usr/bin/env node
// Dump the current database schema to a baseline migration file.
//
// Usage:
//   node scripts/dump-schema.js
//   node scripts/dump-schema.js --output supabase/migrations/00000000_baseline.sql
//
// Queries information_schema and pg_catalog to produce CREATE TABLE IF NOT EXISTS,
// indexes, constraints, RLS policies, functions, and triggers.

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
  // .env.local not found
}

function getConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  const host = process.env.SUPABASE_DB_HOST || 'aws-0-us-west-2.pooler.supabase.com';
  const port = process.env.SUPABASE_DB_PORT || '5432';
  const user = process.env.SUPABASE_DB_USER || 'postgres.mkrqpwncfjpppxyntdtp';
  const password = process.env.SUPABASE_DB_PASSWORD;
  const database = process.env.SUPABASE_DB_NAME || 'postgres';
  if (!password) {
    console.error('ERROR: No database connection configured.');
    process.exit(1);
  }
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

async function run() {
  const args = process.argv.slice(2);
  const outputArg = args.find(a => a.startsWith('--output'));
  let outputPath;
  if (outputArg && outputArg.includes('=')) {
    outputPath = outputArg.split('=')[1];
  } else {
    const idx = args.indexOf('--output');
    outputPath = idx !== -1 ? args[idx + 1] : 'supabase/migrations/00000000_baseline.sql';
  }
  outputPath = path.isAbsolute(outputPath) ? outputPath : path.join(__dirname, '..', outputPath);

  const connStr = getConnectionString();
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log('Connected to database.');

    const lines = [];
    lines.push('-- ============================================================');
    lines.push('-- BASELINE SCHEMA — Auto-generated ' + new Date().toISOString().slice(0, 10));
    lines.push('-- Complete schema snapshot of the PMI EMS Scheduler database.');
    lines.push('-- This file is for reference and new installations.');
    lines.push('-- DO NOT run against an existing production database.');
    lines.push('-- ============================================================');
    lines.push('');

    // ---- Extensions ----
    const extRes = await client.query(`
      SELECT extname FROM pg_extension
      WHERE extname NOT IN ('plpgsql')
      ORDER BY extname
    `);
    if (extRes.rows.length > 0) {
      lines.push('-- ===================');
      lines.push('-- Extensions');
      lines.push('-- ===================');
      for (const row of extRes.rows) {
        lines.push(`CREATE EXTENSION IF NOT EXISTS "${row.extname}";`);
      }
      lines.push('');
    }

    // ---- Custom Types / Enums ----
    const enumRes = await client.query(`
      SELECT t.typname, e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON t.typnamespace = n.oid
      WHERE n.nspname = 'public'
      ORDER BY t.typname, e.enumsortorder
    `);
    const enums = {};
    for (const row of enumRes.rows) {
      if (!enums[row.typname]) enums[row.typname] = [];
      enums[row.typname].push(row.enumlabel);
    }
    if (Object.keys(enums).length > 0) {
      lines.push('-- ===================');
      lines.push('-- Enum Types');
      lines.push('-- ===================');
      for (const [name, values] of Object.entries(enums)) {
        lines.push(`DO $$ BEGIN`);
        lines.push(`  CREATE TYPE "${name}" AS ENUM (${values.map(v => `'${v}'`).join(', ')});`);
        lines.push(`EXCEPTION WHEN duplicate_object THEN NULL;`);
        lines.push(`END $$;`);
        lines.push('');
      }
    }

    // ---- Tables ----
    const tablesRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    lines.push('-- ===================');
    lines.push('-- Tables');
    lines.push('-- ===================');

    for (const tableRow of tablesRes.rows) {
      const tableName = tableRow.table_name;

      // Columns
      const colsRes = await client.query(`
        SELECT column_name, data_type, udt_name, is_nullable,
               column_default, character_maximum_length,
               numeric_precision, numeric_scale
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      lines.push(`-- Table: ${tableName}`);
      lines.push(`CREATE TABLE IF NOT EXISTS "${tableName}" (`);
      const colDefs = [];
      for (const col of colsRes.rows) {
        let typeName = col.data_type;
        if (typeName === 'USER-DEFINED') {
          typeName = `"${col.udt_name}"`;
        } else if (typeName === 'character varying') {
          typeName = col.character_maximum_length ? `varchar(${col.character_maximum_length})` : 'varchar';
        } else if (typeName === 'character') {
          typeName = col.character_maximum_length ? `char(${col.character_maximum_length})` : 'char';
        } else if (typeName === 'numeric') {
          typeName = col.numeric_precision ? `numeric(${col.numeric_precision},${col.numeric_scale || 0})` : 'numeric';
        } else if (typeName === 'ARRAY') {
          // Get the base type from udt_name (starts with _)
          const base = col.udt_name.startsWith('_') ? col.udt_name.slice(1) : col.udt_name;
          typeName = `${base}[]`;
        } else if (typeName === 'timestamp with time zone') {
          typeName = 'timestamptz';
        } else if (typeName === 'timestamp without time zone') {
          typeName = 'timestamp';
        }

        let def = `  "${col.column_name}" ${typeName}`;
        if (col.column_default !== null) {
          def += ` DEFAULT ${col.column_default}`;
        }
        if (col.is_nullable === 'NO') {
          def += ' NOT NULL';
        }
        colDefs.push(def);
      }

      // Primary keys
      const pkRes = await client.query(`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.table_name = $1
          AND tc.constraint_type = 'PRIMARY KEY'
        ORDER BY kcu.ordinal_position
      `, [tableName]);
      if (pkRes.rows.length > 0) {
        const pkCols = pkRes.rows.map(r => `"${r.column_name}"`).join(', ');
        colDefs.push(`  PRIMARY KEY (${pkCols})`);
      }

      lines.push(colDefs.join(',\n'));
      lines.push(');');
      lines.push('');
    }

    // ---- Foreign Keys ----
    const fkRes = await client.query(`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table,
        ccu.column_name AS foreign_column,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints rc
        ON rc.constraint_name = tc.constraint_name
        AND rc.constraint_schema = tc.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.constraint_type = 'FOREIGN KEY'
      ORDER BY tc.table_name, tc.constraint_name
    `);

    if (fkRes.rows.length > 0) {
      lines.push('-- ===================');
      lines.push('-- Foreign Keys');
      lines.push('-- ===================');
      // Group multi-column FKs
      const fks = {};
      for (const row of fkRes.rows) {
        const key = row.constraint_name;
        if (!fks[key]) {
          fks[key] = { ...row, columns: [], foreignColumns: [] };
        }
        fks[key].columns.push(row.column_name);
        fks[key].foreignColumns.push(row.foreign_column);
      }
      for (const fk of Object.values(fks)) {
        const cols = fk.columns.map(c => `"${c}"`).join(', ');
        const fcols = fk.foreignColumns.map(c => `"${c}"`).join(', ');
        let stmt = `ALTER TABLE "${fk.table_name}" ADD CONSTRAINT "${fk.constraint_name}" FOREIGN KEY (${cols}) REFERENCES "${fk.foreign_table}" (${fcols})`;
        if (fk.delete_rule !== 'NO ACTION') stmt += ` ON DELETE ${fk.delete_rule}`;
        if (fk.update_rule !== 'NO ACTION') stmt += ` ON UPDATE ${fk.update_rule}`;
        lines.push(`DO $$ BEGIN ${stmt}; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
      }
      lines.push('');
    }

    // ---- Unique Constraints ----
    const uqRes = await client.query(`
      SELECT tc.constraint_name, tc.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.constraint_type = 'UNIQUE'
      ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position
    `);
    if (uqRes.rows.length > 0) {
      lines.push('-- ===================');
      lines.push('-- Unique Constraints');
      lines.push('-- ===================');
      const uqs = {};
      for (const row of uqRes.rows) {
        if (!uqs[row.constraint_name]) uqs[row.constraint_name] = { table: row.table_name, columns: [] };
        uqs[row.constraint_name].columns.push(row.column_name);
      }
      for (const [name, uq] of Object.entries(uqs)) {
        const cols = uq.columns.map(c => `"${c}"`).join(', ');
        lines.push(`DO $$ BEGIN ALTER TABLE "${uq.table}" ADD CONSTRAINT "${name}" UNIQUE (${cols}); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
      }
      lines.push('');
    }

    // ---- Indexes ----
    const idxRes = await client.query(`
      SELECT indexname, tablename, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname NOT LIKE '%_pkey'
        AND indexname NOT LIKE 'pg_%'
      ORDER BY tablename, indexname
    `);
    if (idxRes.rows.length > 0) {
      lines.push('-- ===================');
      lines.push('-- Indexes');
      lines.push('-- ===================');
      for (const row of idxRes.rows) {
        const def = row.indexdef.replace(/^CREATE INDEX/, 'CREATE INDEX IF NOT EXISTS')
                                .replace(/^CREATE UNIQUE INDEX/, 'CREATE UNIQUE INDEX IF NOT EXISTS');
        lines.push(`${def};`);
      }
      lines.push('');
    }

    // ---- RLS ----
    const rlsRes = await client.query(`
      SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `);

    // Also get which tables have RLS enabled
    const rlsEnabledRes = await client.query(`
      SELECT relname
      FROM pg_class
      JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
      WHERE nspname = 'public'
        AND relkind = 'r'
        AND relrowsecurity = true
      ORDER BY relname
    `);

    if (rlsEnabledRes.rows.length > 0 || rlsRes.rows.length > 0) {
      lines.push('-- ===================');
      lines.push('-- Row Level Security');
      lines.push('-- ===================');
      for (const row of rlsEnabledRes.rows) {
        lines.push(`ALTER TABLE "${row.relname}" ENABLE ROW LEVEL SECURITY;`);
      }
      lines.push('');
      for (const row of rlsRes.rows) {
        const permissive = row.permissive === 'PERMISSIVE' ? '' : ' AS RESTRICTIVE';
        const rolesStr = row.roles
          ? ` TO ${Array.isArray(row.roles) ? row.roles.join(', ') : row.roles}`
          : '';
        let policy = `CREATE POLICY "${row.policyname}" ON "${row.tablename}"${permissive} FOR ${row.cmd}${rolesStr}`;
        if (row.qual) policy += ` USING (${row.qual})`;
        if (row.with_check) policy += ` WITH CHECK (${row.with_check})`;
        lines.push(`DO $$ BEGIN ${policy}; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
      }
      lines.push('');
    }

    // ---- Functions ----
    const fnRes = await client.query(`
      SELECT
        p.proname AS function_name,
        pg_get_functiondef(p.oid) AS definition
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.prokind IN ('f', 'p')
      ORDER BY p.proname
    `);
    if (fnRes.rows.length > 0) {
      lines.push('-- ===================');
      lines.push('-- Functions');
      lines.push('-- ===================');
      for (const row of fnRes.rows) {
        lines.push(`-- Function: ${row.function_name}`);
        // Wrap in CREATE OR REPLACE
        let def = row.definition;
        // pg_get_functiondef returns CREATE FUNCTION, change to CREATE OR REPLACE FUNCTION
        def = def.replace(/^CREATE FUNCTION/, 'CREATE OR REPLACE FUNCTION');
        def = def.replace(/^CREATE PROCEDURE/, 'CREATE OR REPLACE PROCEDURE');
        lines.push(def + ';');
        lines.push('');
      }
    }

    // ---- Triggers ----
    const trigRes = await client.query(`
      SELECT
        trigger_name,
        event_manipulation,
        event_object_table,
        action_timing,
        action_statement,
        action_orientation
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY event_object_table, trigger_name
    `);
    if (trigRes.rows.length > 0) {
      lines.push('-- ===================');
      lines.push('-- Triggers');
      lines.push('-- ===================');
      // Group by trigger name (multiple events possible)
      const triggers = {};
      for (const row of trigRes.rows) {
        const key = `${row.event_object_table}.${row.trigger_name}`;
        if (!triggers[key]) {
          triggers[key] = { ...row, events: [] };
        }
        triggers[key].events.push(row.event_manipulation);
      }
      for (const trig of Object.values(triggers)) {
        const events = trig.events.join(' OR ');
        lines.push(`DO $$ BEGIN`);
        lines.push(`  CREATE TRIGGER "${trig.trigger_name}" ${trig.action_timing} ${events} ON "${trig.event_object_table}" FOR EACH ${trig.action_orientation} ${trig.action_statement};`);
        lines.push(`EXCEPTION WHEN duplicate_object THEN NULL;`);
        lines.push(`END $$;`);
        lines.push('');
      }
    }

    // ---- Write output ----
    const output = lines.join('\n') + '\n';
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, output, 'utf8');
    console.log(`\nBaseline schema written to: ${outputPath}`);
    console.log(`Size: ${output.length} bytes, ${lines.length} lines`);

  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
