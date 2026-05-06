#!/usr/bin/env node
// Diagnose why jlomonaco@pmi.edu's Google Calendar sync produces 0
// events. Walks every join used by syncSeriesForUser:
//
//   1. lab_users — confirm the row + id we'll match against
//   2. pmi_block_instructors WHERE instructor_id = josh.id
//   3. pmi_schedule_blocks.instructor_id / additional_instructor_id
//      (legacy direct columns)
//   4. lab_day_roles
//   5. station_instructors (user_id + user_email)
//   6. google_calendar_events for any existing mappings
//
// Read-only — no writes.

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

try {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.substring(0, eq).trim();
    const v = t.substring(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
} catch {}

const conn =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  `postgresql://${process.env.SUPABASE_DB_USER || 'postgres.mkrqpwncfjpppxyntdtp'}:${process.env.SUPABASE_DB_PASSWORD}@aws-0-us-west-2.pooler.supabase.com:5432/postgres`;

const TARGET_EMAIL = process.argv[2] || 'jlomonaco@pmi.edu';

(async () => {
  const c = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    console.log(`\nTarget: ${TARGET_EMAIL}\n`);

    // 1. lab_users
    const { rows: users } = await c.query(
      `SELECT id, email, name, role, is_active, is_part_time,
              google_calendar_connected, google_calendar_scope
       FROM lab_users
       WHERE LOWER(email) = LOWER($1) OR LOWER(email) LIKE LOWER($2)`,
      [TARGET_EMAIL, TARGET_EMAIL.split('@')[0] + '@%']
    );
    console.log(`1. lab_users matches (${users.length}):`);
    for (const u of users) console.log('  ', u);
    if (users.length === 0) {
      console.log('  ⚠ No lab_users row found — sync would never run.');
      return;
    }
    const userIds = users.map(u => u.id);
    const userIdsCsv = userIds.map(id => `'${id}'`).join(',');

    // 2. pmi_block_instructors
    const { rows: bi } = await c.query(
      `SELECT pbi.instructor_id, pbi.role,
              psb.id AS block_id, psb.title, psb.date::text AS date,
              psb.start_time, psb.end_time, psb.recurring_group_id, psb.status
       FROM pmi_block_instructors pbi
       LEFT JOIN pmi_schedule_blocks psb ON psb.id = pbi.schedule_block_id
       WHERE pbi.instructor_id IN (${userIdsCsv})
       ORDER BY psb.date NULLS LAST, psb.start_time NULLS LAST
       LIMIT 30`
    );
    console.log(`\n2. pmi_block_instructors rows (showing up to 30 of ${bi.length}):`);
    for (const r of bi) {
      console.log(
        `   ${r.date ?? '(no date)'} ${r.start_time ?? ''}–${r.end_time ?? ''}  ` +
        `"${r.title}"  status=${r.status}  rgid=${r.recurring_group_id ? r.recurring_group_id.slice(0, 8) + '…' : 'null'}`
      );
    }
    const publishedFutureBi = bi.filter(r => r.status === 'published' && r.date && r.date >= new Date().toISOString().slice(0, 10));
    console.log(`   Of those, published + future-dated: ${publishedFutureBi.length}`);
    const groupSet = new Set(publishedFutureBi.map(r => r.recurring_group_id ?? `block:${r.block_id}`));
    console.log(`   Distinct (recurring_group_id | block_id) sync targets: ${groupSet.size}`);

    // 3. Legacy direct columns
    const { rows: direct } = await c.query(
      `SELECT id, title, date::text AS date, status, instructor_id, additional_instructor_id
       FROM pmi_schedule_blocks
       WHERE instructor_id IN (${userIdsCsv})
          OR additional_instructor_id IN (${userIdsCsv})
       LIMIT 5`
    );
    console.log(`\n3. pmi_schedule_blocks legacy direct cols (${direct.length}):`);
    for (const r of direct) console.log('   ', r);

    // 4. lab_day_roles
    const { rows: ldr } = await c.query(
      `SELECT lr.role, ld.date::text AS date, ld.title
       FROM lab_day_roles lr
       LEFT JOIN lab_days ld ON ld.id = lr.lab_day_id
       WHERE lr.instructor_id IN (${userIdsCsv})
       ORDER BY ld.date NULLS LAST
       LIMIT 10`
    );
    console.log(`\n4. lab_day_roles (${ldr.length}):`);
    for (const r of ldr) console.log('   ', r);

    // 5. station_instructors
    const { rows: si } = await c.query(
      `SELECT user_id, user_email, user_name, station_id, is_primary
       FROM station_instructors
       WHERE user_id IN (${userIdsCsv})
          OR LOWER(user_email) = LOWER($1)
       LIMIT 10`,
      [TARGET_EMAIL]
    );
    console.log(`\n5. station_instructors (${si.length}):`);
    for (const r of si) console.log('   ', r);

    // 6. Existing Google Calendar mappings for the user
    const { rows: gce } = await c.query(
      `SELECT source_type, source_id, event_summary, created_at
       FROM google_calendar_events
       WHERE LOWER(user_email) = LOWER($1)
       ORDER BY created_at DESC
       LIMIT 10`,
      [TARGET_EMAIL]
    );
    console.log(`\n6. google_calendar_events for ${TARGET_EMAIL} (${gce.length}):`);
    for (const r of gce) console.log('   ', r);

    // Diagnose
    console.log('\n──── DIAGNOSIS ────');
    if (publishedFutureBi.length === 0) {
      console.log('  Josh has no published+future block_instructors rows. ' +
                  'Either the assignments are dated in the past, status≠published, ' +
                  'or his user_id isn\'t the one referenced in pmi_block_instructors.');
      // Check if there are ANY block_instructors rows referencing his email
      const { rows: emailJoin } = await c.query(
        `SELECT pbi.instructor_id, lu.email
         FROM pmi_block_instructors pbi
         LEFT JOIN lab_users lu ON lu.id = pbi.instructor_id
         WHERE LOWER(lu.email) = LOWER($1)
         LIMIT 5`,
        [TARGET_EMAIL]
      );
      console.log(`  Emails matching via join: ${emailJoin.length}`);
      for (const r of emailJoin) console.log('    ', r);
    } else {
      console.log(`  ✓ ${publishedFutureBi.length} published+future blocks found.` +
                  ` Sync should iterate ${groupSet.size} distinct targets.`);
      console.log(`  If sync still produces 0 events, suspect: token expiry, scope drift, ` +
                  `or syncSeriesForUser bailing early. Check server logs.`);
    }
  } finally {
    await c.end();
  }
})();
