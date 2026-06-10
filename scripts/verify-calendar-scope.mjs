/**
 * Calendar scope-fix verification (one-account test, per
 * SPEC_calendar_scope_fix.md).
 *
 *   node scripts/verify-calendar-scope.mjs <email>
 *
 * Run AFTER the user has reconnected at /settings/calendar-setup with the
 * new dual-scope grant. Verifies, using the same Google endpoints the app
 * uses:
 *   1. stored connection state (connected / scope / token present)
 *   2. refresh token still mints an access token
 *   3. freeBusy.query succeeds (the call that used to 403 and trip
 *      needs_reconnect)
 *   4. events scope works end-to-end: insert a test event on primary,
 *      then delete it immediately (self-cleaning)
 *   5. stored scope did NOT flip after the freeBusy call
 *
 * Reads the DB; never writes it. The only Google write is the test event,
 * which is deleted in the same run.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const REPO = path.resolve(fileURLToPath(import.meta.url), '../..');
for (const line of fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  const k = t.slice(0, i).trim();
  if (!process.env[k]) process.env[k] = t.slice(i + 1).trim();
}

const email = process.argv[2];
if (!email) { console.error('usage: node scripts/verify-calendar-scope.mjs <email>'); process.exit(1); }

const c = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

const readState = async () => (await c.query(
  `SELECT google_calendar_connected AS connected, google_calendar_scope AS scope,
          (google_refresh_token IS NOT NULL) AS has_token, google_refresh_token AS token
   FROM lab_users WHERE lower(email) = lower($1)`, [email])).rows[0];

const fail = async (msg) => { console.error('❌ ' + msg); await c.end(); process.exit(1); };

// 1. stored state
const before = await readState();
if (!before) await fail('no lab_users row for ' + email);
console.log(`1. stored state : connected=${before.connected} scope='${before.scope}' token=${before.has_token}`);
if (!before.connected || before.scope !== 'events' || !before.has_token) {
  await fail('not in the expected post-reconnect state (need connected=true, scope=events, token present). Has the user reconnected yet?');
}

// 2. refresh
const tokRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: before.token,
    grant_type: 'refresh_token',
  }),
});
if (!tokRes.ok) await fail('token refresh failed: ' + (await tokRes.text()).slice(0, 300));
const tok = await tokRes.json();
console.log(`2. refresh      : OK (scopes on token: ${tok.scope ?? '(not echoed)'})`);
const accessToken = tok.access_token;

// 3. freeBusy — the call that used to 403
const now = new Date();
const fbRes = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    timeMin: now.toISOString(),
    timeMax: new Date(now.getTime() + 24 * 3600e3).toISOString(),
    items: [{ id: email }],
  }),
});
const fbBody = await fbRes.text();
if (!fbRes.ok) await fail(`freeBusy returned ${fbRes.status} — the old bug would be a 403 here: ${fbBody.slice(0, 300)}`);
console.log('3. freeBusy     : OK (HTTP 200 — no insufficient-scope 403)');

// 4. events insert + delete (self-cleaning test push)
const evRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none', {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    summary: 'PMI scope-fix verification (auto-deletes)',
    description: 'Created by scripts/verify-calendar-scope.mjs — deleted in the same run.',
    start: { dateTime: new Date(now.getTime() + 7 * 24 * 3600e3).toISOString() },
    end: { dateTime: new Date(now.getTime() + 7 * 24 * 3600e3 + 1800e3).toISOString() },
  }),
});
if (!evRes.ok) await fail('test event insert failed: ' + (await evRes.text()).slice(0, 300));
const ev = await evRes.json();
const delRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(ev.id)}?sendUpdates=none`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${accessToken}` },
});
console.log(`4. events push  : OK (created ${ev.id}, deleted=${delRes.ok || delRes.status === 410})`);

// 5. scope did not flip
const after = await readState();
console.log(`5. scope after  : '${after.scope}' (${after.scope === 'events' ? 'STABLE ✅' : 'FLIPPED ❌'})`);
await c.end();
if (after.scope !== 'events') process.exit(1);
console.log('\nALL CHECKS PASSED — the connection survives availability checks and can push events.');
