/**
 * Normalize scenario phase-field ALIASES in the live DB so externally-enriched
 * (round-tripped) scenarios render correctly.
 *
 * Root cause of the "scenario upload crashes after a JSON round-trip edit" bug:
 * an external/LLM edit reshaped phases from the scenario schema
 * (name / presentation_notes / expected_actions) to a case-study-ish schema
 * (title / presentation_text / instructor_cues). The save path stored them
 * as-is, so the render read the now-missing fields. The PATCH/POST routes now
 * normalize on save (lib/scenario-validate.ts); this one-time pass fixes rows
 * that were already saved in the aliased shape.
 *
 * Idempotent and non-destructive: only FILLS missing canonical keys, keeps the
 * originals, and only writes a row if at least one phase actually changed.
 *
 * Usage:  node scripts/fix-scenario-phase-aliases.js [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  const k = t.slice(0, i).trim();
  if (!process.env[k]) process.env[k] = t.slice(i + 1).trim();
}

const DRY_RUN = process.argv.includes('--dry-run');

// Mirror of normalizeScenarioPhases in lib/scenario-validate.ts (kept tiny so
// the script has no TS build step). Returns [normalizedPhases, changed].
function normalizePhases(phases) {
  if (!Array.isArray(phases)) return [phases, false];
  let changed = false;
  const out = phases.map((p) => {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return p;
    const o = { ...p };
    // Alias-only: map title→name (and fill phase_name from the same alias).
    // Never cross-fill canonical→canonical, or every normal scenario rewrites.
    if (o.name == null && typeof o.title === 'string') {
      o.name = o.title;
      if (o.phase_name == null) o.phase_name = o.title;
      changed = true;
    }
    if (o.presentation_notes == null) {
      if (typeof o.presentation_text === 'string') { o.presentation_notes = o.presentation_text; changed = true; }
      else if (typeof o.presentation === 'string') { o.presentation_notes = o.presentation; changed = true; }
    }
    if (o.expected_actions == null && Array.isArray(o.instructor_cues) && o.instructor_cues.length > 0) {
      o.expected_actions = o.instructor_cues; changed = true;
    }
    return o;
  });
  return [out, changed];
}

(async () => {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query('BEGIN');
  try {
    const rows = (await c.query(`select id, title, phases from scenarios where phases is not null`)).rows;
    let updated = 0;
    for (const r of rows) {
      const [normalized, changed] = normalizePhases(r.phases);
      if (!changed) continue;
      console.log(`fixing "${r.title}" (${r.id})`);
      await c.query('update scenarios set phases = $1, updated_at = now() where id = $2', [JSON.stringify(normalized), r.id]);
      updated++;
    }
    console.log(`\n${updated} scenario(s) ${DRY_RUN ? 'WOULD BE' : 'were'} normalized.`);
    if (DRY_RUN) { await c.query('ROLLBACK'); console.log('DRY RUN — rolled back.'); }
    else { await c.query('COMMIT'); console.log('COMMITTED.'); }
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    await c.end();
  }
})().catch((e) => { console.error('ERR:', e.message); process.exit(1); });
