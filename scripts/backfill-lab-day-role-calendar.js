/*
 * Backfill Google Calendar events for existing lab_day_roles rows
 * that don't yet have a google_calendar_events mapping.
 *
 * USAGE:
 *   node scripts/backfill-lab-day-role-calendar.js                  # dry-run, all users
 *   node scripts/backfill-lab-day-role-calendar.js --email=bhartnell@pmi.edu
 *   node scripts/backfill-lab-day-role-calendar.js --execute        # actually write
 *   node scripts/backfill-lab-day-role-calendar.js --execute --email=bhartnell@pmi.edu
 *
 * This is a STANDALONE script — it does NOT push to Google. It
 * shows what would be synced (titles, times, dates) and points
 * the operator at /admin/calendar-sync to run the actual sync,
 * which has the working OAuth token-refresh + event-creation
 * pipeline.
 *
 * Why not just call syncLabDayRole here? It depends on Next.js
 * env (env vars, supabase admin, the OAuth refresh flow), which
 * is painful to bootstrap from a plain node script. The admin
 * UI is one click and gives proper progress feedback.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const envText = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const dbUrlMatch = envText.match(/SUPABASE_DB_URL=(.+)/);
if (!dbUrlMatch) {
  console.error('Missing SUPABASE_DB_URL in .env.local');
  process.exit(1);
}
const dbUrl = dbUrlMatch[1].replace(/^["']|["']$/g, '').trim();

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const emailArg = args.find(a => a.startsWith('--email='));
const TARGET_EMAIL = emailArg ? emailArg.slice('--email='.length) : null;

const PROGRAM_TIME_DEFAULTS = {
  PM: { start: '15:00', end: '17:30' },
  EMT: { start: '09:00', end: '12:00' },
  AEMT: { start: '18:00', end: '21:30' },
};

(async () => {
  const c = new Client({ connectionString: dbUrl });
  await c.connect();

  const today = new Date().toISOString().slice(0, 10);

  // Pull all lab_day_roles with future lab days, joined to instructor +
  // cohort context. Filter to target email if --email passed. Filter
  // out roles that already have a mapping in google_calendar_events.
  const params = [today];
  let emailFilter = '';
  if (TARGET_EMAIL) {
    params.push(TARGET_EMAIL);
    emailFilter = `AND LOWER(u.email) = LOWER($${params.length})`;
  }

  const rows = (await c.query(
    `
    SELECT
      ldr.id AS role_id,
      ldr.role,
      u.email,
      u.google_calendar_connected,
      u.google_calendar_scope,
      ld.id AS lab_day_id,
      ld.date,
      ld.title,
      ld.start_time,
      ld.end_time,
      p.abbreviation AS program,
      c.cohort_number,
      EXISTS (
        SELECT 1 FROM google_calendar_events gce
        WHERE LOWER(gce.user_email) = LOWER(u.email)
          AND gce.source_type = 'lab_day_role'
          AND gce.source_id = ldr.id::text
      ) AS already_synced
    FROM lab_day_roles ldr
    JOIN lab_users u ON u.id = ldr.instructor_id
    JOIN lab_days ld ON ld.id = ldr.lab_day_id
    JOIN cohorts c ON c.id = ld.cohort_id
    JOIN programs p ON p.id = c.program_id
    WHERE ld.date >= $1
      ${emailFilter}
    ORDER BY u.email, ld.date
    `,
    params
  )).rows;

  if (rows.length === 0) {
    console.log('No future lab_day_roles found' + (TARGET_EMAIL ? ` for ${TARGET_EMAIL}` : ''));
    await c.end();
    return;
  }

  // Group by user
  const byUser = {};
  for (const r of rows) {
    if (!byUser[r.email]) byUser[r.email] = { user: r, rows: [] };
    byUser[r.email].rows.push(r);
  }

  console.log(`\n${TARGET_EMAIL ? `User ${TARGET_EMAIL}` : `${Object.keys(byUser).length} user(s)`} · ${rows.length} role assignment(s) on or after ${today}`);

  let totalToSync = 0;
  let totalAlreadySynced = 0;
  let totalBlocked = 0;

  for (const email of Object.keys(byUser)) {
    const u = byUser[email].user;
    const userRows = byUser[email].rows;
    const connected = u.google_calendar_connected;
    const scope = u.google_calendar_scope;
    const canSync = connected && scope === 'events';
    const blockedReason = !connected
      ? 'NOT CONNECTED to Google Calendar'
      : scope !== 'events'
      ? `scope='${scope}' — needs reconnect with events scope`
      : null;

    console.log('\n' + '─'.repeat(70));
    console.log(`USER: ${email}`);
    console.log(`  connected=${connected}  scope=${scope}  → ${canSync ? 'CAN sync' : `BLOCKED: ${blockedReason}`}`);

    const toSync = userRows.filter(r => !r.already_synced);
    const alreadySynced = userRows.length - toSync.length;
    console.log(`  ${userRows.length} total | ${alreadySynced} already mapped | ${toSync.length} to sync`);

    if (canSync) totalToSync += toSync.length;
    else totalBlocked += toSync.length;
    totalAlreadySynced += alreadySynced;

    if (toSync.length === 0) continue;

    console.log('\n  Preview (first 10):');
    toSync.slice(0, 10).forEach(r => {
      const cohortLabel = `${r.program} G${r.cohort_number}`;
      const defaults = PROGRAM_TIME_DEFAULTS[r.program?.toUpperCase()] || { start: '08:00', end: '17:00' };
      const start = r.start_time ? r.start_time.toString().slice(0, 5) : `${defaults.start} (DEFAULT)`;
      const end = r.end_time ? r.end_time.toString().slice(0, 5) : `${defaults.end} (DEFAULT)`;
      const dateStr = r.date.toISOString().slice(0, 10);
      const title = `Lab — ${cohortLabel} · ${r.title || 'Lab Day'}`;
      console.log(`    ${dateStr}  ${start}–${end}  [${r.role}]  ${title}`);
    });
    if (toSync.length > 10) {
      console.log(`    ... and ${toSync.length - 10} more`);
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log(`SUMMARY:`);
  console.log(`  Already mapped:  ${totalAlreadySynced}`);
  console.log(`  Ready to sync:   ${totalToSync}`);
  console.log(`  Blocked (scope): ${totalBlocked}`);
  console.log('═'.repeat(70));

  if (EXECUTE) {
    console.log('\n--execute was passed, BUT this script does not write to Google directly.');
    console.log('To actually push events to Google Calendar:');
    console.log('  1. Make sure each blocked user has reconnected at /settings/calendar-setup');
    console.log('  2. From admin/calendar-sync, click "Sync now" (use per-user mode for one user)');
    console.log('  3. That endpoint uses the live OAuth refresh + creates the events + writes mappings');
  } else {
    console.log('\nDRY RUN.');
    console.log('  Run with --execute to see deployment instructions.');
    console.log(`  To actually push: visit /admin/calendar-sync and trigger per-user sync${TARGET_EMAIL ? ` for ${TARGET_EMAIL}` : ''}.`);
  }

  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
