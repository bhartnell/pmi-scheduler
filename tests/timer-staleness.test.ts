import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTimerStale, isSameDaySameCohort, appTzWallToMs } from '../lib/timer-staleness.ts';

// Tue 2026-11-10 3:00 PM PST = 23:00Z. Monday's row (lab day 11-09) started Mon 4:36 PM, ~22h earlier.
const tueAfternoon = new Date('2026-11-10T23:00:00Z');

test('previous-date lab day is stale even when started <24h ago (Monday row on Tuesday)', () => {
  assert.equal(isTimerStale({ date: '2026-11-09', end_time: '17:00:00' }, tueAfternoon), true);
});
test('same-day lab day inside its hours is live', () => {
  assert.equal(isTimerStale({ date: '2026-11-10', end_time: '17:00:00' }, tueAfternoon), false);
});
test('same-day lab day more than 60 min past end is stale; within 60 is live', () => {
  assert.equal(isTimerStale({ date: '2026-11-10', end_time: '17:00:00' }, new Date('2026-11-11T02:30:00Z')), true); // 6:30 PM PST
  assert.equal(isTimerStale({ date: '2026-11-10', end_time: '17:00:00' }, new Date('2026-11-11T01:30:00Z')), false); // 5:30 PM PST, inside grace
});
test('missing end_time or date never closes a timer', () => {
  assert.equal(isTimerStale({ date: '2026-11-10', end_time: null }, new Date('2026-11-11T05:00:00Z')), false);
  assert.equal(isTimerStale(null, tueAfternoon), false);
});
test('wall-clock conversion honours DST', () => {
  assert.equal(appTzWallToMs('2026-11-10', '17:00:00'), Date.UTC(2026, 10, 11, 1, 0, 0)); // PST = UTC-8
  assert.equal(appTzWallToMs('2026-07-10', '17:00:00'), Date.UTC(2026, 6, 11, 0, 0, 0)); // PDT = UTC-7
});
test('fallback only for same date AND same cohort', () => {
  const page = { date: '2026-11-10', cohort_id: 'a' };
  assert.equal(isSameDaySameCohort(page, { date: '2026-11-10', cohort_id: 'a' }), true);
  assert.equal(isSameDaySameCohort(page, { date: '2026-11-09', cohort_id: 'a' }), false);
  assert.equal(isSameDaySameCohort(page, { date: '2026-11-10', cohort_id: 'b' }), false);
  assert.equal(isSameDaySameCohort(page, { date: '2026-11-10', cohort_id: null }), false);
});
