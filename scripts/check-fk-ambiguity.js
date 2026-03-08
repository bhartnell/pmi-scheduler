#!/usr/bin/env node
// PostgREST FK Ambiguity Checker
//
// Detects table pairs connected by multiple FK paths, which cause PGRST201
// "Could not embed because more than one relationship was found" errors.
//
// Usage:
//   node scripts/check-fk-ambiguity.js              # Full check (DB + codebase scan)
//   node scripts/check-fk-ambiguity.js --db-only     # Only check DB relationships
//   node scripts/check-fk-ambiguity.js --scan-only   # Only scan codebase (uses known pairs)
//
// Exit codes:
//   0 = No issues found (or only informational warnings)
//   1 = Found implicit joins in codebase that need FK disambiguation
//
// Background:
//   PostgREST (used by Supabase) auto-discovers FK relationships for embedded
//   queries like `.from('students').select('cohort:cohorts(...)')`. When two
//   tables have MORE than one FK path between them (e.g., direct FK + junction),
//   PostgREST can't determine which relationship to use and returns PGRST201.
//
//   Fix: Add explicit FK hints in the select string:
//     Before: cohort:cohorts(id, cohort_number)
//     After:  cohort:cohorts!students_cohort_id_fkey(id, cohort_number)

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// ─── Configuration ───────────────────────────────────────────────────────────

const PROJECT_ROOT = path.join(__dirname, '..');
const API_DIR = path.join(PROJECT_ROOT, 'app', 'api');
const SCHEMA = 'public';

// ─── Load .env.local ─────────────────────────────────────────────────────────

try {
  const envPath = path.join(PROJECT_ROOT, '.env.local');
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
    console.error('Set one of: DATABASE_URL, SUPABASE_DB_URL, or SUPABASE_DB_PASSWORD in .env.local');
    process.exit(1);
  }

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

// ─── Step 1: Query database for all FK relationships ─────────────────────────

async function getAllForeignKeys(client) {
  const result = await client.query(`
    SELECT
      tc.constraint_name,
      tc.table_name      AS from_table,
      kcu.column_name    AS from_column,
      ccu.table_name     AS to_table,
      ccu.column_name    AS to_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = '${SCHEMA}'
    ORDER BY tc.table_name, tc.constraint_name
  `);

  return result.rows;
}

// ─── Step 2: Build adjacency graph and find ambiguous pairs ──────────────────

function findAmbiguousPairs(foreignKeys) {
  // Direct connections: table A → table B via FK
  const directLinks = new Map(); // "A→B" => [{ constraint, from_col, to_col }]
  for (const fk of foreignKeys) {
    const key = `${fk.from_table}→${fk.to_table}`;
    if (!directLinks.has(key)) directLinks.set(key, []);
    directLinks.get(key).push({
      constraint: fk.constraint_name,
      from_col: fk.from_column,
      to_col: fk.to_column,
    });
  }

  // Build table → targets map for junction detection
  const tableOutgoing = new Map(); // table => Set of tables it has FK to
  for (const fk of foreignKeys) {
    if (!tableOutgoing.has(fk.from_table)) tableOutgoing.set(fk.from_table, new Set());
    tableOutgoing.get(fk.from_table).add(fk.to_table);
  }

  const ambiguous = [];

  for (const [linkKey, directFKs] of directLinks) {
    const [tableA, tableB] = linkKey.split('→');

    // Case 1: Multiple direct FKs from A to B (ALWAYS ambiguous)
    if (directFKs.length > 1) {
      ambiguous.push({
        tableA,
        tableB,
        type: 'multiple_direct',
        severity: 'CRITICAL',
        paths: directFKs.map(fk => ({
          type: 'direct',
          constraint: fk.constraint,
          description: `${tableA}.${fk.from_col} → ${tableB}.${fk.to_col}`,
        })),
      });
    }

    // Case 2: Junction table creates indirect path
    for (const [junctionTable, junctionTargets] of tableOutgoing) {
      if (junctionTable === tableA || junctionTable === tableB) continue;
      if (junctionTargets.has(tableA) && junctionTargets.has(tableB)) {
        const junctionToA = foreignKeys.filter(
          fk => fk.from_table === junctionTable && fk.to_table === tableA
        );
        const junctionToB = foreignKeys.filter(
          fk => fk.from_table === junctionTable && fk.to_table === tableB
        );

        ambiguous.push({
          tableA,
          tableB,
          type: 'junction',
          severity: 'WARNING',
          junctionTable,
          paths: [
            ...directFKs.map(fk => ({
              type: 'direct',
              constraint: fk.constraint,
              description: `${tableA}.${fk.from_col} → ${tableB}.${fk.to_col}`,
            })),
            ...junctionToA.map(fkA => {
              const fkB = junctionToB[0];
              return {
                type: 'junction',
                constraint: `via ${junctionTable}`,
                description: `${tableA}.id ← ${junctionTable}.${fkA.from_col} + ${junctionTable}.${fkB ? fkB.from_col : '?'} → ${tableB}.id`,
              };
            }),
          ],
        });
      }
    }
  }

  // Deduplicate
  const seen = new Set();
  const deduped = [];
  for (const entry of ambiguous) {
    const pair = [entry.tableA, entry.tableB].sort().join('↔');
    const key = `${pair}:${entry.junctionTable || 'direct'}:${entry.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(entry);
  }

  return deduped;
}

// ─── Step 3: Extract Supabase queries from source files ──────────────────────
//
// Strategy: Find all .from('table') calls, extract their .select() string,
// and check for implicit embeds of ambiguous tables.

function extractQueriesFromFile(content) {
  const queries = [];

  // Find all .from('tableName') calls
  const fromRegex = /\.from\(['"](\w+)['"]\)/g;
  let match;
  while ((match = fromRegex.exec(content)) !== null) {
    const fromTable = match[1];
    const fromIdx = match.index;

    // Find the .select() that belongs to this .from()
    // It should appear within the same query chain (before the next .from())
    const nextFromIdx = content.indexOf(".from('", fromIdx + 1);
    const nextFromIdx2 = content.indexOf('.from("', fromIdx + 1);
    const chainEnd = Math.min(
      nextFromIdx === -1 ? content.length : nextFromIdx,
      nextFromIdx2 === -1 ? content.length : nextFromIdx2
    );

    // Search for .select() within this query's chain
    const chainSlice = content.substring(fromIdx, chainEnd);
    const selectMatch = chainSlice.match(/\.select\s*\(\s*([`'"])/);
    if (!selectMatch) continue;

    const selectStartInChain = selectMatch.index;
    const quoteChar = selectMatch[1];
    const selectContentStart = fromIdx + selectStartInChain + selectMatch[0].length;

    // Extract the select string (find matching close quote/backtick)
    let depth = 0;
    let selectEnd = selectContentStart;
    for (let i = selectContentStart; i < content.length; i++) {
      const ch = content[i];
      if (ch === '(' ) depth++;
      if (ch === ')') {
        if (depth === 0) { selectEnd = i; break; }
        depth--;
      }
      if (depth === 0 && ch === quoteChar && i > selectContentStart) {
        selectEnd = i;
        break;
      }
    }

    const selectString = content.substring(selectContentStart, selectEnd);
    const lineNum = content.substring(0, fromIdx).split('\n').length;

    queries.push({
      fromTable,
      selectString,
      lineNum,
      fromIdx,
    });
  }

  return queries;
}

function scanCodebaseForImplicitJoins(ambiguousPairs) {
  const results = [];
  const files = getAllTsFiles(API_DIR);

  // Build a lookup: for each table, which other tables create ambiguity?
  const ambiguityMap = new Map(); // table => [{ otherTable, pair }]
  for (const pair of ambiguousPairs) {
    const { tableA, tableB } = pair;
    if (!ambiguityMap.has(tableA)) ambiguityMap.set(tableA, []);
    if (!ambiguityMap.has(tableB)) ambiguityMap.set(tableB, []);
    ambiguityMap.get(tableA).push({ otherTable: tableB, pair });
    ambiguityMap.get(tableB).push({ otherTable: tableA, pair });
  }

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relPath = path.relative(PROJECT_ROOT, filePath);
    const queries = extractQueriesFromFile(content);

    for (const query of queries) {
      const ambiguities = ambiguityMap.get(query.fromTable);
      if (!ambiguities) continue;

      for (const { otherTable, pair } of ambiguities) {
        // Check if the select string embeds `otherTable` without FK disambiguation
        // Pattern: `otherTable(` or `alias:otherTable(` without `!fk_name`
        const implicitRegex = new RegExp(`(?:^|[,\\s])(?:\\w+:)?${otherTable}\\(`, 'gm');
        const disambiguatedRegex = new RegExp(`(?:\\w+:)?${otherTable}!\\w+\\(`, 'gm');

        const implicitMatches = [...query.selectString.matchAll(implicitRegex)];
        const disambiguatedMatches = [...query.selectString.matchAll(disambiguatedRegex)];

        // Filter out matches that have a corresponding disambiguated version
        const trueImplicits = implicitMatches.filter(im => {
          return !disambiguatedMatches.some(dm => Math.abs(dm.index - im.index) < 10);
        });

        if (trueImplicits.length > 0) {
          // Calculate line numbers for each match
          const lineNumbers = trueImplicits.map(m => {
            const beforeMatch = content.substring(0, query.fromIdx).split('\n').length;
            const selectBefore = query.selectString.substring(0, m.index);
            return beforeMatch + selectBefore.split('\n').length - 1;
          });

          results.push({
            file: relPath,
            direction: `${query.fromTable}→${otherTable}`,
            lineNumbers,
            matchCount: trueImplicits.length,
            matches: trueImplicits.map(m => m[0].trim()),
            pair,
          });
        }
      }
    }

    // Also check for nested embeds: .from(X).select('..., alias:tableA(... alias2:tableB(...))')
    // where tableA→tableB is ambiguous. The inner embed needs FK hint.
    for (const pair of ambiguousPairs) {
      const { tableA, tableB } = pair;

      // Pattern: tableA( ... tableB( without tableB! — nested in ANY query
      const nestedRegex = new RegExp(
        `(?:\\w+:)?${tableA}\\([^)]*?(?:\\w+:)?${tableB}\\(`,
        'gs'
      );
      const nestedDisambiguatedRegex = new RegExp(
        `(?:\\w+:)?${tableA}\\([^)]*?(?:\\w+:)?${tableB}!`,
        'gs'
      );

      const nestedMatches = [...content.matchAll(nestedRegex)];
      const nestedDisMatches = [...content.matchAll(nestedDisambiguatedRegex)];

      const unresolved = nestedMatches.filter(nm => {
        return !nestedDisMatches.some(dm => Math.abs(dm.index - nm.index) < 10);
      });

      if (unresolved.length > 0) {
        const lineNumbers = unresolved.map(m => {
          return content.substring(0, m.index).split('\n').length;
        });

        // Check if this is already reported as a direct query
        const existingReport = results.find(
          r => r.file === path.relative(PROJECT_ROOT, filePath) &&
               r.lineNumbers.some(ln => lineNumbers.includes(ln))
        );
        if (existingReport) continue;

        results.push({
          file: path.relative(PROJECT_ROOT, filePath),
          direction: `nested: *→${tableA}→${tableB}`,
          lineNumbers,
          matchCount: unresolved.length,
          matches: unresolved.map(m => m[0].substring(0, 60).trim() + '...'),
          pair,
        });
      }
    }
  }

  // Deduplicate by file + line numbers
  const seen = new Set();
  return results.filter(r => {
    const key = `${r.file}:${r.lineNumbers.join(',')}:${r.direction}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getAllTsFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dbOnly = args.includes('--db-only');
  const scanOnly = args.includes('--scan-only');

  console.log('\n🔍 PostgREST FK Ambiguity Checker');
  console.log('═'.repeat(60));

  let ambiguousPairs = [];

  if (!scanOnly) {
    const connStr = getConnectionString();
    const maskedConn = connStr.replace(/:([^@]+)@/, ':****@');
    console.log(`\n📡 Connecting to: ${maskedConn}`);

    const client = new Client({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
    });

    try {
      await client.connect();
      console.log('   Connected ✓\n');

      const foreignKeys = await getAllForeignKeys(client);
      console.log(`📊 Found ${foreignKeys.length} foreign key relationships\n`);

      ambiguousPairs = findAmbiguousPairs(foreignKeys);

      if (ambiguousPairs.length === 0) {
        console.log('✅ No ambiguous FK relationships found!\n');
        if (dbOnly) { await client.end(); return; }
      } else {
        // Separate critical (multiple direct FKs) from warnings (junction-based)
        const critical = ambiguousPairs.filter(p => p.severity === 'CRITICAL');
        const warnings = ambiguousPairs.filter(p => p.severity === 'WARNING');

        if (critical.length > 0) {
          console.log(`🔴 ${critical.length} CRITICAL ambiguity (multiple direct FKs):\n`);
          for (const pair of critical) {
            console.log(`   ${pair.tableA} ↔ ${pair.tableB}`);
            for (const p of pair.paths) {
              console.log(`     • ${p.description} (${p.constraint})`);
            }
            console.log();
          }
        }

        if (warnings.length > 0) {
          console.log(`🟡 ${warnings.length} junction-based ambiguity (may or may not cause PGRST201):\n`);
          for (const pair of warnings) {
            const junction = pair.junctionTable ? ` via ${pair.junctionTable}` : '';
            console.log(`   ${pair.tableA} ↔ ${pair.tableB}${junction}`);
          }
          console.log();
        }
      }

      if (dbOnly) {
        await client.end();
        return;
      }

      await client.end();
    } catch (err) {
      console.error(`❌ Database error: ${err.message}`);
      await client.end().catch(() => {});
      process.exit(1);
    }
  }

  if (scanOnly) {
    // Known ambiguous pairs when DB isn't available
    ambiguousPairs = [
      {
        tableA: 'students',
        tableB: 'cohorts',
        type: 'junction',
        severity: 'WARNING',
        junctionTable: 'student_case_stats',
        paths: [
          { type: 'direct', description: 'students.cohort_id → cohorts.id' },
          { type: 'junction', description: 'students ← student_case_stats → cohorts' },
        ],
      },
    ];
    console.log('\n📂 Scan-only mode: using known ambiguous pairs\n');
  }

  if (ambiguousPairs.length === 0) {
    console.log('✅ Nothing to scan — no ambiguous pairs detected.\n');
    return;
  }

  // Step 3: Scan codebase
  console.log('📂 Scanning codebase for implicit joins...');
  console.log(`   Directory: ${path.relative(PROJECT_ROOT, API_DIR)}/\n`);

  const implicitJoins = scanCodebaseForImplicitJoins(ambiguousPairs);

  if (implicitJoins.length === 0) {
    console.log('✅ All joins are properly disambiguated!\n');
    return;
  }

  // Group by pair and severity
  const byPair = new Map();
  for (const join of implicitJoins) {
    const pairKey = `${join.pair.tableA}↔${join.pair.tableB}`;
    if (!byPair.has(pairKey)) byPair.set(pairKey, []);
    byPair.get(pairKey).push(join);
  }

  let criticalCount = 0;
  let warningCount = 0;

  console.log(`Found implicit joins in ${implicitJoins.length} location(s):\n`);

  for (const [pairKey, joins] of byPair) {
    const pair = joins[0].pair;
    const isCritical = pair.severity === 'CRITICAL';
    const icon = isCritical ? '🔴' : '🟡';
    const label = isCritical ? 'CRITICAL' : 'WARNING';
    const junctionInfo = pair.junctionTable ? ` (via ${pair.junctionTable})` : '';
    const totalCount = joins.reduce((sum, j) => sum + j.matchCount, 0);

    if (isCritical) criticalCount += totalCount;
    else warningCount += totalCount;

    console.log(`  ${icon} [${label}] ${pairKey}${junctionInfo} — ${totalCount} implicit join(s):\n`);

    for (const join of joins) {
      console.log(`    📄 ${join.file}`);
      console.log(`       Direction: ${join.direction}`);
      console.log(`       Line(s): ${join.lineNumbers.join(', ')}`);
      console.log(`       Pattern(s): ${join.matches.join(', ')}`);
      console.log();
    }
  }

  console.log('─'.repeat(60));
  console.log(`\n📋 Summary:`);
  if (criticalCount > 0) console.log(`   🔴 ${criticalCount} CRITICAL implicit join(s) — WILL cause PGRST201`);
  if (warningCount > 0) console.log(`   🟡 ${warningCount} junction-based implicit join(s) — MAY cause PGRST201`);
  console.log(`   Total: ${criticalCount + warningCount} across ${implicitJoins.length} location(s)\n`);
  console.log('💡 Fix by adding !fk_name to disambiguate:');
  console.log('   Before: cohort:cohorts(id, cohort_number)');
  console.log('   After:  cohort:cohorts!students_cohort_id_fkey(id, cohort_number)\n');

  // Exit 1 only if there are critical issues
  if (criticalCount > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`\n❌ Fatal error: ${err.message}\n`);
  process.exit(1);
});
