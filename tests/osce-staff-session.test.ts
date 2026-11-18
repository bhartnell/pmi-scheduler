import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideStaffSession } from '../lib/osce-staff-session.ts';

const fall = { id: 'fall', status: 'open', start_date: '2026-11-12', end_date: '2026-11-19' };
const spring = { id: 'spring', status: 'open', start_date: '2026-04-09', end_date: '2026-04-16' };
const staff = { email: 'jdoe@pmi.edu', role: 'instructor' };

test('staff with an event in window gets that event', () => {
  const d = decideStaffSession({ user: staff, events: [spring, fall], today: '2026-11-19' });
  assert.equal(d.ok && d.event.id, 'fall');
});
test('staff but no event in window is refused', () => {
  const d = decideStaffSession({ user: staff, events: [spring], today: '2026-11-19' });
  assert.deepEqual(d, { ok: false, reason: 'no_event_today' });
});
test('student account (my.pmi.edu or low role) is refused', () => {
  assert.deepEqual(decideStaffSession({ user: { email: 's@my.pmi.edu', role: 'instructor' }, events: [fall], today: '2026-11-19' }), { ok: false, reason: 'not_staff' });
  assert.deepEqual(decideStaffSession({ user: { email: 'x@pmi.edu', role: 'guest' }, events: [fall], today: '2026-11-19' }), { ok: false, reason: 'not_staff' });
});
test('signed out is refused', () => {
  assert.deepEqual(decideStaffSession({ user: null, events: [fall], today: '2026-11-19' }), { ok: false, reason: 'signed_out' });
});
test('two events in window: nearest start wins', () => {
  const other = { id: 'other', status: 'closed', start_date: '2026-11-18', end_date: '2026-11-20' };
  const d = decideStaffSession({ user: staff, events: [fall, other], today: '2026-11-19' });
  assert.equal(d.ok && d.event.id, 'other');
});
test('draft event is not offered', () => {
  const d = decideStaffSession({ user: staff, events: [{ ...fall, status: 'draft' }], today: '2026-11-19' });
  assert.equal(d.ok, false);
});
