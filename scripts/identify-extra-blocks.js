#!/usr/bin/env node
// Identify (don't delete) any pmi_schedule_blocks rows for the
// three target courses that fall OUTSIDE the user-specified 14-date
// canonical list. Use this to decide whether to delete week-15 or
// pre-week-1 outliers before reporting "exactly 14 per weekday".

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

try {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const k = trimmed.substring(0, eq).trim();
    const v = trimmed.substring(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
} catch {}

function getConn() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  const host = process.env.SUPABASE_DB_HOST || 'aws-0-us-west-2.pooler.supabase.com';
  const port = process.env.SUPABASE_DB_PORT || '5432';
  const user = process.env.SUPABASE_DB_USER || 'postgres.mkrqpwncfjpppxyntdtp';
  const pass = process.env.SUPABASE_DB_PASSWORD;
  const db = process.env.SUPABASE_DB_NAME || 'postgres';
  if (!pass) { console.error('No password'); process.exit(1); }
  return `postgresql://${user}:${pass}@${host}:${port}/${db}`;
}

const SUMMER = '638470a7-5320-4c98-b690-1c77aae710f4';
const PM_G14 = '26d1db7d-edeb-41ce-817b-f74f1b458951';
const PM_G15 = '5b2a1825-144a-44fc-9cf5-63f28e4ea992';

const ALLOWED = {
  'EMS 172': new Set([
    '2026-05-14','2026-05-21','2026-05-28','2026-06-04','2026-06-11','2026-06-18','2026-06-25',
    '2026-07-02','2026-07-09','2026-07-16','2026-07-23','2026-07-30','2026-08-06','2026-08-13',
    '2026-05-15','2026-05-22','2026-05-29','2026-06-05','2026-06-12','2026-06-19','2026-06-26',
    '2026-07-03','2026-07-10','2026-07-17','2026-07-24','2026-07-31','2026-08-07','2026-08-14',
  ]),
  'EMS 141': new Set([
    '2026-05-11','2026-05-18','2026-05-25','2026-06-01','2026-06-08','2026-06-15','2026-06-22',
    '2026-06-29','2026-07-06','2026-07-13','2026-07-20','2026-07-27','2026-08-03','2026-08-10',
    '2026-05-12','2026-05-19','2026-05-26','2026-06-02','2026-06-09','2026-06-16','2026-06-23',
    '2026-06-30','2026-07-07','2026-07-14','2026-07-21','2026-07-28','2026-08-04','2026-08-11',
  ]),
  'MTH 142': new Set([
    '2026-05-11','2026-05-18','2026-05-25','2026-06-01','2026-06-08','2026-06-15','2026-06-22',
    '2026-06-29','2026-07-06','2026-07-13','2026-07-20','2026-07-27','2026-08-03','2026-08-10',
    '2026-05-12','2026-05-19','2026-05-26','2026-06-02','2026-06-09','2026-06-16','2026-06-23',
    '2026-06-30','2026-07-07','2026-07-14','2026-07-21','2026-07-28','2026-08-04','2026-08-11',
  ]),
};

const TARGETS = [
  { course: 'EMS 172', programScheduleId: PM_G14, ilike: '%172%' },
  { course: 'EMS 141', programScheduleId: PM_G15, ilike: '%141%' },
  { course: 'MTH 142', programScheduleId: PM_G15, ilike: '%MTH%' },
];

(async () => {
  const c = new Client({ connectionString: getConn(), ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    for (const t of TARGETS) {
      const allowed = ALLOWED[t.course];
      const { rows } = await c.query(
        `
        SELECT id, title, date::text AS date, day_of_week, week_number,
               start_time, end_time, status
        FROM pmi_schedule_blocks
        WHERE program_schedule_id = $1
          AND semester_id = $2
          AND title ILIKE $3
        ORDER BY date
        `,
        [t.programScheduleId, SUMMER, t.ilike]
      );
      const extras = rows.filter(r => !allowed.has(r.date));
      console.log(`\n──── ${t.course} (program_schedule_id ${t.programScheduleId.slice(0,8)}…) ────`);
      console.log(`  Total rows:  ${rows.length}`);
      console.log(`  In canonical 28-date list:  ${rows.length - extras.length}`);
      console.log(`  EXTRAS (outside list):  ${extras.length}`);
      for (const e of extras) {
        console.log(`    id=${e.id}  date=${e.date}  wk=${e.week_number}  title="${e.title}"  status=${e.status}`);
      }
    }
  } finally {
    await c.end();
  }
})();
