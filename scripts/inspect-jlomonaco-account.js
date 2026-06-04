/*
 * Inspect Josh Lomonaco's account state for OAuth troubleshooting.
 * Read-only — no writes.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const m = env.match(/SUPABASE_DB_URL=(.+)/);
const url = m[1].replace(/^["']|["']$/g, '').trim();

(async () => {
  const c = new Client({ connectionString: url });
  await c.connect();

  // 1. Exact email lookup
  const exact = (await c.query(
    `SELECT id, email, name, role, status, is_active, created_at, last_login,
            google_calendar_connected, google_calendar_scope
     FROM lab_users WHERE LOWER(email) = LOWER($1)`,
    ['jlomonaco@pmi.edu']
  )).rows;
  console.log('EXACT MATCH (jlomonaco@pmi.edu):');
  console.log(JSON.stringify(exact, null, 2));

  // 2. Fuzzy lookup for typos/case-mismatches
  const fuzzy = (await c.query(
    `SELECT id, email, name, role, status, is_active, last_login
     FROM lab_users
     WHERE LOWER(email) LIKE '%lomonaco%'
        OR LOWER(name) LIKE '%lomonaco%'
        OR LOWER(name) LIKE '%josh%'
     ORDER BY last_login DESC NULLS LAST
     LIMIT 10`
  )).rows;
  console.log(`\nFUZZY MATCH (Lomonaco / Josh): ${fuzzy.length} hits`);
  fuzzy.forEach(r => {
    console.log(`  ${r.email.padEnd(35)}  ${(r.name || '').padEnd(25)}  role=${r.role}  active=${r.is_active}  status=${r.status}  last=${r.last_login || '(never)'}`);
  });

  // 3. Schema of lab_users (to see if there are other relevant columns)
  const cols = (await c.query(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_name = 'lab_users'
     ORDER BY ordinal_position`
  )).rows;
  console.log('\nlab_users columns:');
  cols.forEach(c => console.log(`  ${c.column_name.padEnd(35)}  ${c.data_type}`));

  // 4. Any access_requests pending for this email?
  try {
    const accessReq = (await c.query(
      `SELECT id, email, status, created_at, requested_role
       FROM access_requests
       WHERE LOWER(email) = LOWER($1)
       ORDER BY created_at DESC LIMIT 5`,
      ['jlomonaco@pmi.edu']
    )).rows;
    console.log(`\nACCESS REQUESTS: ${accessReq.length}`);
    accessReq.forEach(r => console.log(`  ${r.created_at && r.created_at.toISOString().slice(0,10)}  status=${r.status}  role=${r.requested_role}`));
  } catch (e) {
    console.log('\n(access_requests table not present or different schema)');
  }

  // 5. NextAuth account/session records? Check next_auth schema if exists
  try {
    const naAcct = (await c.query(
      `SELECT provider, type, created_at
       FROM next_auth.accounts a
       JOIN next_auth.users u ON u.id = a.user_id
       WHERE LOWER(u.email) = LOWER($1)`,
      ['jlomonaco@pmi.edu']
    )).rows;
    console.log(`\nNEXT_AUTH ACCOUNTS: ${naAcct.length}`);
    naAcct.forEach(r => console.log(`  ${r.provider}  ${r.type}  created=${r.created_at}`));
  } catch (e) {
    console.log('\n(no next_auth schema — NextAuth uses JWT strategy, not DB sessions)');
  }

  // 6. Recent audit log entries for this email?
  try {
    const audit = (await c.query(
      `SELECT created_at, action, details
       FROM audit_log
       WHERE LOWER(actor_email) = LOWER($1)
          OR LOWER(target_email) = LOWER($1)
          OR details::text ILIKE '%lomonaco%'
       ORDER BY created_at DESC LIMIT 10`,
      ['jlomonaco@pmi.edu']
    )).rows;
    console.log(`\nAUDIT LOG: ${audit.length} recent entries`);
    audit.forEach(r => console.log(`  ${r.created_at && r.created_at.toISOString().slice(0,16).replace('T', ' ')}  ${r.action}  ${JSON.stringify(r.details).slice(0, 80)}`));
  } catch (e) {
    console.log('\n(audit_log unavailable: ' + e.message.slice(0, 60) + ')');
  }

  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
