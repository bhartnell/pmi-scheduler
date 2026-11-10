import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseEventForPin, todayInOsceZone, pinMissReason } from '../lib/osce-event-pin.ts';

const spring = { id: 'spring', start_date: '2026-03-30', end_date: '2026-03-31' };
const fall = { id: 'fall', start_date: '2026-11-12', end_date: '2026-11-19' };

test('shared code picks Fall during its window', () => {
  assert.equal(chooseEventForPin([spring, fall], '2026-11-12')?.id, 'fall');
  assert.equal(chooseEventForPin([fall, spring], '2026-11-19')?.id, 'fall');
});
test('one-day grace on each side', () => {
  assert.equal(chooseEventForPin([spring, fall], '2026-11-11')?.id, 'fall');
  assert.equal(chooseEventForPin([spring, fall], '2026-11-20')?.id, 'fall');
  assert.equal(chooseEventForPin([spring, fall], '2026-11-21'), null);
});
test('overlapping windows take nearest start_date', () => {
  const a = { id: 'a', start_date: '2026-05-01', end_date: '2026-05-10' };
  const b = { id: 'b', start_date: '2026-05-08', end_date: '2026-05-12' };
  assert.equal(chooseEventForPin([a, b], '2026-05-09')?.id, 'b');
});
test('none in window / empty', () => {
  assert.equal(chooseEventForPin([spring], '2026-11-12'), null);
  assert.equal(chooseEventForPin(null, '2026-11-12'), null);
  assert.equal(pinMissReason([]), 'invalid');
  assert.equal(pinMissReason([spring]), 'inactive');
});
test('today uses OSCE zone not UTC', () => {
  // 2026-11-13T03:00Z is still Nov 12 evening in Arizona/Pacific
  assert.equal(todayInOsceZone(new Date('2026-11-13T03:00:00Z')), '2026-11-12');
});
