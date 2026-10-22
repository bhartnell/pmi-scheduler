import test from 'node:test';
import assert from 'node:assert/strict';
import { planTzRepush, retagRecurrence } from '../lib/calendar-tz-repush.ts';

const today = '2026-10-22';

test('Phoenix single event keeps wall clock and gets Pacific zone', () => {
  const d = planTzRepush({
    start: { dateTime: '2026-11-02T08:30:00-07:00', timeZone: 'America/Phoenix' },
    end: { dateTime: '2026-11-02T16:30:00-07:00', timeZone: 'America/Phoenix' },
  }, today);
  assert.equal(d.action, 'patch');
  if (d.action === 'patch') {
    assert.deepEqual(d.patch.start, { dateTime: '2026-11-02T08:30:00', timeZone: 'America/Los_Angeles' });
    assert.equal(d.patch.recurrence, undefined);
  }
});

test('past single events and already-Pacific events are skipped', () => {
  assert.deepEqual(planTzRepush({
    start: { dateTime: '2026-10-01T08:30:00-07:00', timeZone: 'America/Phoenix' },
    end: { dateTime: '2026-10-01T09:30:00-07:00', timeZone: 'America/Phoenix' },
  }, today), { action: 'skip', reason: 'past' });
  assert.deepEqual(planTzRepush({
    start: { dateTime: '2026-11-02T08:30:00-08:00', timeZone: 'America/Los_Angeles' },
    end: { dateTime: '2026-11-02T09:30:00-08:00', timeZone: 'America/Los_Angeles' },
  }, today), { action: 'skip', reason: 'already_pacific' });
});

test('recurring master with past start is patched and RDATE retagged', () => {
  const d = planTzRepush({
    start: { dateTime: '2026-09-01T08:30:00-07:00', timeZone: 'America/Phoenix' },
    end: { dateTime: '2026-09-01T09:30:00-07:00', timeZone: 'America/Phoenix' },
    recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=TU;COUNT=15', 'RDATE;TZID=America/Phoenix:20261103T083000'],
  }, today);
  assert.equal(d.action, 'patch');
  if (d.action === 'patch') {
    assert.deepEqual(d.patch.recurrence, ['RRULE:FREQ=WEEKLY;BYDAY=TU;COUNT=15', 'RDATE;TZID=America/Los_Angeles:20261103T083000']);
  }
});

test('all-day and cancelled events are skipped; retag is idempotent', () => {
  assert.equal(planTzRepush({ start: { date: '2026-11-02' }, end: { date: '2026-11-03' } }, today).action, 'skip');
  assert.equal(planTzRepush({ status: 'cancelled' }, today).action, 'skip');
  assert.equal(retagRecurrence(['RDATE;TZID=America/Los_Angeles:20261103T083000']).changed, false);
});
