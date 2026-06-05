// One-off inspector for the feedback table(s) — figures out which
// of feedback_reports / preceptor_feedback owns the ids in the user's
// list and prints the schema so we know what status / id columns to
// hit on the UPDATE.
const { Client } = require('pg');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
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

(async () => {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL });
  await c.connect();

  for (const tbl of ['feedback_reports', 'preceptor_feedback']) {
    console.log(`\n=== ${tbl} schema ===`);
    const cols = await c.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
      [tbl]
    );
    for (const col of cols.rows) {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    }

    // Check matches.
    const allPrefixes = [...RESOLVED_PREFIXES, ...IN_PROGRESS_PREFIXES];
    const matches = await c.query(
      `SELECT id::text AS id FROM ${tbl} WHERE id::text = ANY($1::text[])
       OR EXISTS (SELECT 1 FROM unnest($2::text[]) AS p WHERE id::text LIKE p || '%')`,
      [allPrefixes, allPrefixes]
    );
    console.log(`  ${tbl}: ${matches.rows.length} id-prefix match(es)`);
  }

  // Also check distinct status values that currently exist on feedback_reports.
  try {
    const statuses = await c.query(
      `SELECT status, COUNT(*) FROM feedback_reports GROUP BY status ORDER BY status`
    );
    console.log('\nfeedback_reports status distribution:');
    for (const r of statuses.rows) console.log(`  ${r.status}: ${r.count}`);
  } catch (e) {
    console.log('Status query failed:', e.message);
  }

  await c.end();
})();
