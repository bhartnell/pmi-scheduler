const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
}
const { Client } = require('pg');

// Feedback prefixes (first 8 chars of UUID) + resolution notes
const TARGETS = [
  { prefix: 'f073a91a', note: 'Red text on critical-fail correlated steps — implemented in SkillSheetPanel (fuzzy-match on step instruction vs critical_failures).' },
  { prefix: '6e002721', note: 'Added station closed/break/reopen menu in coordinator view; grays card, disables send dropdown, excludes from routing.' },
  { prefix: '9470ea50', note: 'Updated certifications card href to https://gridsquares.app/certifications.' },
  { prefix: 'b47cfe12', note: 'Open lab link was fixed weeks ago.' },
  { prefix: 'bf540138', note: 'Josh dashboard links built (PMI Operations Hub section on dashboard).' },
  { prefix: 'bcf7d042', note: 'User error — station type corrected (station_type mismatch resolved).' },
  { prefix: '6ffa3aff', note: 'Cardiac arrest proctor prompts already added (commit bd7210f7).' },
];

(async () => {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL });
  await c.connect();

  const resolverEmail = 'coordinator@pmi.edu';
  const now = new Date().toISOString();

  for (const target of TARGETS) {
    // Look up full UUID from prefix
    const { rows } = await c.query(
      `SELECT id, status, description FROM feedback_reports WHERE id::text LIKE $1 LIMIT 2`,
      [`${target.prefix}%`]
    );
    if (rows.length === 0) {
      console.log(`[MISS] ${target.prefix}: no matching feedback found`);
      continue;
    }
    if (rows.length > 1) {
      console.log(`[AMBIG] ${target.prefix}: matched ${rows.length} rows, skipping`);
      continue;
    }
    const row = rows[0];
    if (row.status === 'resolved') {
      console.log(`[SKIP] ${target.prefix}: already resolved`);
      continue;
    }
    const preview = (row.description || '').slice(0, 60).replace(/\s+/g, ' ');
    console.log(`[UPD]  ${target.prefix}: "${preview}..."`);
    await c.query(
      `UPDATE feedback_reports
       SET status = 'resolved',
           resolved_at = $1,
           resolved_by = $2,
           resolution_notes = $3,
           updated_at = $1
       WHERE id = $4`,
      [now, resolverEmail, target.note, row.id]
    );
  }

  await c.end();
  console.log('Done.');
})().catch(e => { console.error(e.message); process.exit(1); });
