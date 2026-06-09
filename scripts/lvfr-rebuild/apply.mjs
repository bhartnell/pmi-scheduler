/**
 * LVFR AEMT runsheet rebuild — apply to the database.
 *
 * Reads data/lvfr-aemt/runsheet_days.json (built by parse-sources.mjs) and
 * replaces the AEMT G2 runsheet with the rebuilt 30-day, 3-tier item set.
 *
 *   node scripts/lvfr-rebuild/apply.mjs            # READ-ONLY: safety check,
 *                                                  # before-counts, write backup
 *   node scripts/lvfr-rebuild/apply.mjs --commit   # do the replace (live data)
 *
 * Scope: AEMT G2 only (is_external_program=true). The lvfr_day_schedule /
 * lvfr_schedule_items tables are LVFR-AEMT-only; the script aborts if it finds
 * any row belonging to a *different* cohort. Always backs up first.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const REPO = path.resolve(fileURLToPath(import.meta.url), '../../..');
const ARTIFACT = path.join(REPO, 'data', 'lvfr-aemt', 'runsheet_days.json');
const BACKUP_DIR = path.join(REPO, 'data', 'lvfr-aemt', 'backups');
const G2 = '6796e139-3add-4bdd-84da-52963ae4eb21'; // AEMT G2 cohort (is_external_program)
const NEW_END_DATE = '2026-09-17';
const COMMIT = process.argv.includes('--commit');

// ── env + connection (mirrors scripts/run-migration.js) ────────────
try {
  const envContent = fs.readFileSync(path.join(REPO, '.env.local'), 'utf8');
  for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = t.slice(i + 1).trim();
  }
} catch {}
const CONN = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!CONN) { console.error('No DATABASE_URL / SUPABASE_DB_URL in env'); process.exit(1); }

function minutesFromLabel(label) {
  const m = label && label.match(/^(\d{2})(\d{2})-(\d{2})(\d{2})$/);
  if (!m) return null;
  const a = +m[1] * 60 + +m[2];
  const b = +m[3] * 60 + +m[4];
  return Math.max(0, b - a);
}

async function main() {
  const artifact = JSON.parse(fs.readFileSync(ARTIFACT, 'utf8'));
  const days = artifact.days;
  console.log(`Mode        : ${COMMIT ? 'COMMIT (writing live data)' : 'READ-ONLY (no writes)'}`);
  console.log(`Artifact    : ${days.length} days, ${days[0].date} … ${days[days.length - 1].date}`);

  const client = new pg.Client({ connectionString: CONN, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    // ── safety: confirm cohort + no foreign-cohort rows ─────────────
    const coh = await client.query('SELECT id, cohort_number, is_external_program, start_date, end_date FROM cohorts WHERE id = $1', [G2]);
    if (coh.rowCount === 0) throw new Error(`AEMT G2 cohort ${G2} not found`);
    console.log(`Cohort      : ${coh.rows[0].cohort_number} | is_external_program=${coh.rows[0].is_external_program} | end_date=${coh.rows[0].end_date}`);

    const foreign = await client.query(
      `SELECT DISTINCT cohort_id FROM lvfr_day_schedule WHERE cohort_id IS NOT NULL AND cohort_id <> $1`, [G2]);
    if (foreign.rowCount > 0) {
      throw new Error(`ABORT: lvfr_day_schedule has rows for other cohorts: ${foreign.rows.map(r => r.cohort_id).join(', ')}`);
    }

    // ── before-counts ───────────────────────────────────────────────
    const beforeDays = await client.query('SELECT count(*)::int n FROM lvfr_day_schedule');
    const beforeItems = await client.query('SELECT count(*)::int n FROM lvfr_schedule_items');
    const beforeChecked = await client.query('SELECT count(*)::int n FROM lvfr_schedule_items WHERE is_completed');
    console.log(`\nBEFORE      : ${beforeDays.rows[0].n} day-session rows, ${beforeItems.rows[0].n} items (${beforeChecked.rows[0].n} checked off)`);

    // ── backup everything in the two tables ─────────────────────────
    const dump = await client.query(`
      SELECT d.*, COALESCE(json_agg(to_jsonb(i.*)) FILTER (WHERE i.id IS NOT NULL), '[]') AS items
      FROM lvfr_day_schedule d
      LEFT JOIN lvfr_schedule_items i ON i.day_schedule_id = d.id
      GROUP BY d.id`);
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `runsheet_backup_${stamp}.json`);
    fs.writeFileSync(backupPath, JSON.stringify({ backed_up_at: stamp, rows: dump.rows }, null, 2));
    console.log(`BACKUP      : ${dump.rowCount} day rows → ${path.relative(REPO, backupPath)}`);

    if (!COMMIT) {
      console.log('\nREAD-ONLY — no changes made. Re-run with --commit to apply.');
      return;
    }

    // ── replace, in one transaction ─────────────────────────────────
    await client.query('BEGIN');
    // delete AEMT G2 (and any null-cohort) runsheet — items cascade
    await client.query('DELETE FROM lvfr_day_schedule WHERE cohort_id = $1 OR cohort_id IS NULL', [G2]);

    let dayRows = 0, itemRows = 0;
    for (const day of days) {
      for (const session of ['morning', 'afternoon']) {
        const brief = session === 'morning' ? day.brief : null;
        const debrief = session === 'afternoon' ? day.debrief || null : null;
        const ins = await client.query(
          `INSERT INTO lvfr_day_schedule (date, cohort_id, session, brief, debrief)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [day.date, G2, session, brief, debrief]);
        const dayScheduleId = ins.rows[0].id;
        dayRows++;
        const items = session === 'morning' ? day.morning : day.afternoon;
        for (const it of items) {
          await client.query(
            `INSERT INTO lvfr_schedule_items
               (day_schedule_id, title, item_type, requirement, description, time_label, estimated_minutes, sort_order)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [dayScheduleId, it.title, it.item_type, it.requirement, it.description, it.time_label, minutesFromLabel(it.time_label), it.sort_order]);
          itemRows++;
        }
      }
    }

    // bump cohort end_date
    const upd = await client.query('UPDATE cohorts SET end_date = $1 WHERE id = $2 RETURNING end_date', [NEW_END_DATE, G2]);
    await client.query('COMMIT');

    // ── after-counts ────────────────────────────────────────────────
    const afterReq = await client.query("SELECT requirement, count(*)::int n FROM lvfr_schedule_items GROUP BY requirement ORDER BY requirement");
    const reqMap = Object.fromEntries(afterReq.rows.map(r => [r.requirement, r.n]));
    console.log(`\nAFTER       : ${dayRows} day-session rows, ${itemRows} items`);
    console.log(`              required=${reqMap.required || 0}  optional=${reqMap.optional || 0}  info=${reqMap.info || 0}`);
    console.log(`Cohort      : end_date → ${upd.rows[0].end_date}`);
    console.log(`Backup kept : ${path.relative(REPO, backupPath)}`);
    console.log('\n✅ COMMIT complete.');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error(`\n❌ ${err.message}`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
main();
