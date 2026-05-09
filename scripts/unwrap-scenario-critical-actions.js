#!/usr/bin/env node
// Unwrap JSON-encoded critical_actions on scenarios.
//
// The 2026-05-08 incident: the now-removed
// /api/admin/scenarios/transform "convert strings → {id,
// description} objects" step interacted badly with the
// scenarios.critical_actions column being text[] (not jsonb[]).
// Each transform run JSON-serialised the new objects into
// strings; the next run saw strings again and re-wrapped, so
// rows ended up with multi-level nested JSON like:
//
//   '{"id":"...","description":"{\\"id\\":\\"...\\",...}"}'
//
// This script repeatedly unwraps every element of
// critical_actions until each is a plain description string
// (or a non-wrapped non-object value). Defaults to DRY RUN.
//
// Usage:
//   node scripts/unwrap-scenario-critical-actions.js
//   node scripts/unwrap-scenario-critical-actions.js --apply
//   node scripts/unwrap-scenario-critical-actions.js --id <uuid>

const fs = require('fs');
const path = require('path');

try {
  for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i > 0) process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
  }
} catch {}

const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');
const idIndex = process.argv.indexOf('--id');
const targetId = idIndex !== -1 ? process.argv[idIndex + 1] : null;

function unwrap(s) {
  let cur = s;
  for (let safety = 0; safety < 10; safety++) {
    if (typeof cur !== 'string') break;
    const trimmed = cur.trim();
    if (!trimmed.startsWith('{') || !trimmed.includes('"description"')) break;
    try {
      const inner = JSON.parse(trimmed);
      if (inner && typeof inner === 'object' && typeof inner.description === 'string') {
        cur = inner.description;
        continue;
      }
    } catch {
      /* leave as-is */
    }
    break;
  }
  return cur;
}

(async () => {
  console.log(`Mode: ${APPLY ? 'APPLY (will write)' : 'DRY RUN'}`);

  const c = new Client({
    connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  // Fetch candidate rows: any with critical_actions[1] starting
  // with '{' (looks like a JSON-encoded object).
  let rows;
  if (targetId) {
    rows = (
      await c.query(
        `SELECT id, title, critical_actions FROM scenarios WHERE id = $1`,
        [targetId]
      )
    ).rows;
  } else {
    rows = (
      await c.query(
        `SELECT id, title, critical_actions FROM scenarios
         WHERE is_active = true
           AND critical_actions IS NOT NULL
           AND array_length(critical_actions, 1) > 0
           AND critical_actions[1] LIKE '{%'
         ORDER BY title`
      )
    ).rows;
  }

  console.log(`\nCandidate rows: ${rows.length}\n`);

  let touched = 0, unchanged = 0, errors = 0;
  for (const row of rows) {
    const original = row.critical_actions || [];
    const cleaned = original.map(unwrap);
    const changed = cleaned.some((v, i) => v !== original[i]);

    if (!changed) {
      console.log(`SKIP ${row.id.slice(0, 8)} · "${row.title.slice(0, 50)}" · already clean`);
      unchanged++;
      continue;
    }

    console.log(`${APPLY ? 'OK  ' : 'DRY '} ${row.id.slice(0, 8)} · "${row.title.slice(0, 50)}"`);
    for (let i = 0; i < cleaned.length; i++) {
      const before = String(original[i]).slice(0, 60);
      const after = String(cleaned[i]).slice(0, 60);
      console.log(`       [${i}] ${before}${original[i].length > 60 ? '…' : ''}`);
      console.log(`       ${' '.repeat(2 + String(i).length)} → ${after}${cleaned[i].length > 60 ? '…' : ''}`);
    }

    if (APPLY) {
      try {
        await c.query(
          `UPDATE scenarios SET critical_actions = $1::text[] WHERE id = $2`,
          [cleaned, row.id]
        );
        touched++;
      } catch (err) {
        errors++;
        console.log(`       UPDATE failed: ${err.message}`);
      }
    } else {
      touched++;
    }
  }

  console.log(`\n──── SUMMARY ────`);
  console.log(`Candidates: ${rows.length}`);
  console.log(`${APPLY ? 'Updated' : 'Would update'}: ${touched}`);
  console.log(`Already clean: ${unchanged}`);
  console.log(`Errors: ${errors}`);
  if (!APPLY) console.log(`\nDry run only. Re-run with --apply to write.`);

  await c.end();
})().catch(e => {
  console.error(e);
  process.exit(1);
});
