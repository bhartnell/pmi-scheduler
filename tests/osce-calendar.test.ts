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
