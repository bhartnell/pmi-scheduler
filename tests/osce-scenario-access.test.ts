import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canReadScenario } from '../lib/osce-scenario-access.ts';

const event = { id: 'e1', status: 'open', start_date: '2026-11-12', end_date: '2026-11-19', event_pin: 'OSCE2026' };
const base = { staffSession: false, eventId: 'e1', code: 'OSCE2026', event, token: null, today: '2026-11-19', now: new Date('2026-11-19T20:00:00Z') };

test('no proof at all is rejected', () => {
  assert.equal(canReadScenario({ ...base, eventId: null, code: null, event: null }), false);
});
test('wrong code is rejected', () => {
  assert.equal(canReadScenario({ ...base, code: 'NOPE' }), false);
});
test('right code, event out of window, is rejected', () => {
  assert.equal(canReadScenario({ ...base, today: '2026-12-30' }), false);
});
test('right code, in window, is accepted', () => {
  assert.equal(canReadScenario(base), true);
});
test('event id that does not match the looked-up event is rejected', () => {
  assert.equal(canReadScenario({ ...base, eventId: 'other' }), false);
});
test('admin/instructor session is accepted with no proof', () => {
  assert.equal(canReadScenario({ ...base, staffSession: true, eventId: null, code: null, event: null }), true);
});
test('valid token for this event is accepted; other event or expired is not', () => {
  const tok = { event_id: 'e1', valid_from: '2026-11-01T00:00:00Z', valid_until: '2026-11-30T00:00:00Z' };
  assert.equal(canReadScenario({ ...base, code: null, token: tok }), true);
  assert.equal(canReadScenario({ ...base, code: null, token: { ...tok, event_id: 'e2' } }), false);
  assert.equal(canReadScenario({ ...base, code: null, token: { ...tok, valid_until: '2026-11-10T00:00:00Z' } }), false);
});
