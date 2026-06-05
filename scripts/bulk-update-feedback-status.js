#!/usr/bin/env node
// Bulk-update feedback report statuses by short-id prefix.
//
// Status values in feedback_reports are canonical lowercase snake_case
// ('resolved', 'in_progress') — using those rather than the
// capitalised labels in the request so the existing admin filter
// chips on /admin/feedback keep matching.
//
// Usage:
//   node scripts/bulk-update-feedback-status.js            # apply
//   node scripts/bulk-update-feedback-status.js --dry-run  # preview

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  if (!process.env[t.substring(0, i).trim()]) {
    process.env[t.substring(0, i).trim()] = t.substring(i + 1).trim();
  }
}

const RESOLVED_PREFIXES = [
  '858edf5f', 'ba34a934', '88684e76', '7a2258bd', 'dcbb18c5',
  '8046a2e9', '133c8cfb', 'be70776b', 'f7483052', 'c570616f',
  '0849716a', '50fcc6c3', 'a44cd068', '580426bf', '86a24230',
  '189fa576', '6744680c', '9844ca19', '6cece0ab', '786a8fd9',
  '807b1415', '5203871c', 'b2162033', '37d7e6bc', 'f17758cc',
  '0973ae79', 'f1044faa', 'eb06e9c5', 'c6a32eb4', 'f9734143',
];
const IN_PROGRESS_PREFIXES = [
  '2954d669', '7df85195', '652f9bd9', 'b52cb732', '33bc4965',
  '5dafe0bb', '52bb146b', '3186f605', '14b2f190', 'cf4b5dfb',
];

const DRY = process.argv.includes('--dry-run');

// Build SQL fragment: "id::text LIKE '858edf5f%' OR id::text LIKE 'ba34a934%' OR ..."
function prefixWhereClause(prefixes) {
  return prefixes.map((_, i) => `id::text LIKE $${i + 1}`).join(' OR ');
}

async function lookup(c, prefixes) {
  const where = prefixWhereClause(prefixes);
  const r = await c.query(
    `SELECT id::text AS id, status, report_type, LEFT(COALESCE(description, ''), 60) AS desc
       FROM feedback_reports
      WHERE ${where}`,
    prefixes.map(p => p + '%')
  );
  return r.rows;
}

async function applyUpdate(c, prefixes, newStatus, alsoSetResolvedAt) {
  const where = prefixWhereClause(prefixes);
  const setClause = alsoSetResolvedAt
    ? `status = $${prefixes.length + 1}, resolved_at = COALESCE(resolved_at, now()), updated_at = now()`
    : `status = $${prefixes.length + 1}, updated_at = now()`;
  const r = await c.query(
    `UPDATE feedback_reports SET ${setClause} WHERE ${where}`,
    [...prefixes.map(p => p + '%'), newStatus]
  );
  return r.rowCount;
}

(async () => {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL });
  await c.connect();
  console.log(DRY ? '== DRY RUN ==' : '== APPLYING UPDATES ==');

  // Resolve set preview
  const resolveRows = await lookup(c, RESOLVED_PREFIXES);
  console.log(`\nResolved targets: matched ${resolveRows.length} of ${RESOLVED_PREFIXES.length}`);
  for (const r of resolveRows) {
    console.log(`  ${r.id.slice(0, 8)} [${r.status}] ${r.report_type}: ${r.desc}`);
  }
  const resolveFound = new Set(resolveRows.map(r => r.id.slice(0, 8)));
  const resolveMissing = RESOLVED_PREFIXES.filter(p => !resolveFound.has(p));
  if (resolveMissing.length) console.log(`  Missing: ${resolveMissing.join(', ')}`);

  // In-progress set preview
  const inProgressRows = await lookup(c, IN_PROGRESS_PREFIXES);
  console.log(`\nIn-progress targets: matched ${inProgressRows.length} of ${IN_PROGRESS_PREFIXES.length}`);
  for (const r of inProgressRows) {
    console.log(`  ${r.id.slice(0, 8)} [${r.status}] ${r.report_type}: ${r.desc}`);
  }
  const inProgFound = new Set(inProgressRows.map(r => r.id.slice(0, 8)));
  const inProgMissing = IN_PROGRESS_PREFIXES.filter(p => !inProgFound.has(p));
  if (inProgMissing.length) console.log(`  Missing: ${inProgMissing.join(', ')}`);

  if (DRY) {
    console.log('\n(dry-run: no changes applied)');
    await c.end();
    return;
  }

  // One transaction for both batches so a failure can't leave a
  // half-updated state.
  await c.query('BEGIN');
  try {
    const resolvedCount = await applyUpdate(c, RESOLVED_PREFIXES, 'resolved', true);
    const inProgressCount = await applyUpdate(c, IN_PROGRESS_PREFIXES, 'in_progress', false);
    await c.query('COMMIT');
    console.log(`\nCOMMIT — ${resolvedCount} resolved + ${inProgressCount} in_progress rows updated.`);
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('ROLLBACK due to error:', e.message);
    process.exitCode = 1;
  }

  await c.end();
})();
