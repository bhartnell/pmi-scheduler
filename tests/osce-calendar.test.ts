import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOsceBlockDescription, buildOsceBlockEventBody, createOsceBlockEvent, OSCE_DEFAULT_LOCATION,
} from '../lib/osce-calendar.ts';

const event = { slug: 'fall-2026', label: 'Clinical Capstone Fall 2026, Paramedic OSCE' };
const am = { id: 'b1', label: 'Day 1 Morning', date: '2026-11-12', start_time: '08:30:00', end_time: '12:00:00' };
const pm = { id: 'b2', label: 'Day 1 Afternoon', date: '2026-11-12', start_time: '13:00:00', end_time: '16:00:00' };
const baseUrl = 'https://www.pmiparamedic.tools/';

test('morning description matches the spec times', () => {
  const d = buildOsceBlockDescription({ event, block: am, baseUrl });
  assert.match(d, /0830 arrive/);
  assert.match(d, /0845 first assessment begins/);
  assert.match(d, /Approximately noon, block ends/);
  assert.match(d, /https:\/\/www\.pmiparamedic\.tools\/osce\/fall-2026/);
});

test('afternoon uses 1300 / 1315 / 1600 and the event label, not Fall 2026 hardcoding', () => {
  const d = buildOsceBlockDescription({ event: { slug: 'spring-2027', label: 'Spring 2027 OSCE' }, block: pm, baseUrl });
  assert.match(d, /^Spring 2027 OSCE\./);
  assert.match(d, /1300 arrive/);
  assert.match(d, /1315 first assessment/);
  assert.match(d, /Approximately 1600, block ends/);
  assert.match(d, /osce\/spring-2027/);
});

test('event body: title, busy, reminders, guest flags, no attendees', () => {
  const b = buildOsceBlockEventBody({ event, block: am, baseUrl });
  assert.equal(b.summary, 'Paramedic OSCE Evaluator - Day 1 Morning');
  assert.equal(b.location, OSCE_DEFAULT_LOCATION);
  assert.equal(b.start.dateTime, '2026-11-12T08:30:00');
  assert.equal(b.transparency, 'opaque');
  assert.deepEqual(b.reminders.overrides.map(r => r.minutes), [1440, 60]);
  assert.equal(b.guestsCanSeeOtherGuests, true);
  assert.equal(b.guestsCanInviteOthers, false);
  assert.equal(b.guestsCanModify, false);
  assert.equal('attendees' in b, false);
});

test('createOsceBlockEvent is idempotent and never throws', async () => {
  let calls = 0;
  const ok = (async () => { calls++; return new Response(JSON.stringify({ id: 'ev1' }), { status: 200 }); }) as typeof fetch;
  assert.deepEqual(await createOsceBlockEvent({ accessToken: 't', event, block: { ...am, google_event_id: 'old' }, baseUrl, fetchImpl: ok }), { status: 'exists', eventId: 'old' });
  assert.equal(calls, 0);
  assert.deepEqual(await createOsceBlockEvent({ accessToken: 't', event, block: am, baseUrl, fetchImpl: ok }), { status: 'created', eventId: 'ev1' });
  const bad = (async () => new Response('nope', { status: 403 })) as typeof fetch;
  const r = await createOsceBlockEvent({ accessToken: 't', event, block: am, baseUrl, fetchImpl: bad });
  assert.equal(r.status, 'error');
  const boom = (async () => { throw new Error('down'); }) as typeof fetch;
  assert.equal((await createOsceBlockEvent({ accessToken: 't', event, block: am, baseUrl, fetchImpl: boom })).status, 'error');
});

import { addOsceGuest, removeOsceGuest } from '../lib/osce-calendar.ts';

function fakeGoogle(attendees: { email: string }[], failPatch = false) {
  const calls: { method: string; url: string; body?: unknown }[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (method === 'GET') return new Response(JSON.stringify({ attendees }), { status: 200 });
    return failPatch ? new Response('denied', { status: 403 }) : new Response('{}', { status: 200 });
  }) as unknown as typeof fetch;
  return { f, calls };
}

test('addOsceGuest patches attendees with sendUpdates=all and keeps existing guests', async () => {
  const { f, calls } = fakeGoogle([{ email: 'a@x.org' }]);
  const r = await addOsceGuest({ accessToken: 't', eventId: 'ev1', email: 'b@x.org', displayName: 'B', fetchImpl: f });
  assert.equal(r.status, 'added');
  const patch = calls[1];
  assert.equal(patch.method, 'PATCH');
  assert.match(patch.url, /sendUpdates=all/);
  assert.deepEqual((patch.body as { attendees: { email: string }[] }).attendees.map(a => a.email), ['a@x.org', 'b@x.org']);
});

test('addOsceGuest does not re-add (case-insensitive) and sends nothing', async () => {
  const { f, calls } = fakeGoogle([{ email: 'A@X.org' }]);
  assert.equal((await addOsceGuest({ accessToken: 't', eventId: 'ev1', email: 'a@x.org', fetchImpl: f })).status, 'already');
  assert.equal(calls.length, 1);
});

test('removeOsceGuest removes only that guest; absent is a no-op', async () => {
  const { f, calls } = fakeGoogle([{ email: 'a@x.org' }, { email: 'b@x.org' }]);
  assert.equal((await removeOsceGuest({ accessToken: 't', eventId: 'ev1', email: 'B@x.org', fetchImpl: f })).status, 'removed');
  assert.deepEqual((calls[1].body as { attendees: { email: string }[] }).attendees.map(a => a.email), ['a@x.org']);
  const g = fakeGoogle([{ email: 'a@x.org' }]);
  assert.equal((await removeOsceGuest({ accessToken: 't', eventId: 'ev1', email: 'z@x.org', fetchImpl: g.f })).status, 'absent');
  assert.equal(g.calls.length, 1);
});

test('guest calls report errors instead of throwing, no retry', async () => {
  const { f, calls } = fakeGoogle([], true);
  assert.equal((await addOsceGuest({ accessToken: 't', eventId: 'ev1', email: 'a@x.org', fetchImpl: f })).status, 'error');
  assert.equal(calls.length, 2);
  const boom = (async () => { throw new Error('down'); }) as typeof fetch;
  assert.equal((await removeOsceGuest({ accessToken: 't', eventId: 'ev1', email: 'a@x.org', fetchImpl: boom })).status, 'error');
});

import { osceEventLabel, registrantState } from '../lib/osce-calendar.ts';

test('event label joins title and subtitle, tolerates no subtitle', () => {
  assert.equal(osceEventLabel({ title: 'Clinical Capstone Fall 2026', subtitle: 'Paramedic OSCE' }), 'Clinical Capstone Fall 2026, Paramedic OSCE');
  assert.equal(osceEventLabel({ title: 'Spring OSCE', subtitle: null }), 'Spring OSCE');
});

test('registrant state: stamp wins, then recorded error, else pending', () => {
  assert.equal(registrantState({ calendar_invite_sent_at: '2026-10-21T00:00:00Z', calendar_invite_error: 'x' }), 'sent');
  assert.equal(registrantState({ calendar_invite_sent_at: null, calendar_invite_error: 'Google 403' }), 'failed');
  assert.equal(registrantState({ calendar_invite_sent_at: null, calendar_invite_error: null }), 'pending');
});
