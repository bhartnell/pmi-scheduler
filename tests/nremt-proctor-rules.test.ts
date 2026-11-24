import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proctorAllows, isWithinProctorWindow, pacificDate, type ProctorEntry } from '../lib/nremt-proctor-rules.ts';

const day = (id: string, date: string, extra: Partial<ProctorEntry['lab_day'] & object> = {}) => ({ id, date, is_nremt_testing: true, cohort_id: 'c1', ...extra });
const entry = (labDayId: string, date: string, removed = false, extra = {}): ProctorEntry => ({ lab_day_id: labDayId, removed, lab_day: day(labDayId, date, extra) });
// Wed 2026-11-25 10:00 Pacific = 18:00 UTC
const wed = new Date('2026-11-25T18:00:00Z');
const tueNoon = new Date('2026-11-24T20:00:00Z');
const thu = new Date('2026-11-26T18:00:00Z');
const monNoon = new Date('2026-11-23T20:00:00Z');

test('listed and in window (day of)', () => {
  assert.equal(proctorAllows([entry('d1', '2026-11-25')], { kind: 'labDay', labDayId: 'd1' }, wed), true);
});
test('listed, day before counts', () => {
  assert.equal(proctorAllows([entry('d1', '2026-11-25')], { kind: 'labDay', labDayId: 'd1' }, tueNoon), true);
});
test('listed but outside the window (two days before, day after)', () => {
  assert.equal(proctorAllows([entry('d1', '2026-11-25')], { kind: 'labDay', labDayId: 'd1' }, monNoon), false);
  assert.equal(proctorAllows([entry('d1', '2026-11-25')], { kind: 'labDay', labDayId: 'd1' }, thu), false);
});
test('removed is refused', () => {
  assert.equal(proctorAllows([entry('d1', '2026-11-25', true)], { kind: 'labDay', labDayId: 'd1' }, wed), false);
});
test('a different lab day is refused', () => {
  assert.equal(proctorAllows([entry('d1', '2026-11-25')], { kind: 'labDay', labDayId: 'd2' }, wed), false);
});
test('a station that belongs to another lab day is refused; unknown station refused', () => {
  assert.equal(proctorAllows([entry('d1', '2026-11-25')], { kind: 'station', stationLabDayId: 'd2' }, wed), false);
  assert.equal(proctorAllows([entry('d1', '2026-11-25')], { kind: 'station', stationLabDayId: null }, wed), false);
  assert.equal(proctorAllows([entry('d1', '2026-11-25')], { kind: 'station', stationLabDayId: 'd1' }, wed), true);
});
test('non-NREMT day is refused', () => {
  assert.equal(proctorAllows([entry('d1', '2026-11-25', false, { is_nremt_testing: false })], { kind: 'any' }, wed), false);
});
test('cohort scope only matches that lab day cohort', () => {
  assert.equal(proctorAllows([entry('d1', '2026-11-25')], { kind: 'cohort', cohortId: 'c1' }, wed), true);
  assert.equal(proctorAllows([entry('d1', '2026-11-25')], { kind: 'cohort', cohortId: 'c2' }, wed), false);
});
test('empty list, junk entries and bad dates refuse', () => {
  assert.equal(proctorAllows([], { kind: 'any' }, wed), false);
  assert.equal(proctorAllows([{ lab_day_id: 'd1', removed: false, lab_day: null }], { kind: 'any' }, wed), false);
  assert.equal(isWithinProctorWindow('not-a-date', wed), false);
});
test('window uses Pacific date, not UTC (Wed 9 PM Pacific is already Thu in UTC)', () => {
  const lateWed = new Date('2026-11-26T05:00:00Z');
  assert.equal(pacificDate(lateWed), '2026-11-25');
  assert.equal(isWithinProctorWindow('2026-11-25', lateWed), true);
});
