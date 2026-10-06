// Run: node --experimental-strip-types --test lib/lab-timer-state.test.mts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyResponse,
  computeDisplaySeconds,
  initialLabTimerState,
  versionParam,
  type LabTimerRow,
} from './lab-timer-state.ts';

const T0 = Date.parse('2026-10-06T12:00:00Z');
const row = (o: Partial<LabTimerRow> = {}): LabTimerRow => ({
  id: 'a', lab_day_id: 'd', rotation_number: 1, status: 'running',
  started_at: '2026-10-06T11:59:00Z', paused_at: null, elapsed_when_paused: 0,
  duration_seconds: 600, mode: 'countdown', version: 3, ...o,
});
const seeded = () => applyResponse(initialLabTimerState, { success: true, timer: row() }, T0);

test('countdown ticks from started_at', () => {
  assert.equal(computeDisplaySeconds(seeded(), T0), 540);
});

test('null / failed / error responses keep ticking (no 00:00)', () => {
  const s = seeded();
  assert.equal(applyResponse(s, null, T0), s);
  assert.equal(applyResponse(s, { success: false }, T0), s);
  const once = applyResponse(s, { success: true, timer: null }, T0);
  assert.equal(computeDisplaySeconds(once, T0), 540);
});

test('two consecutive explicit nulls clear the timer', () => {
  let s = applyResponse(seeded(), { success: true, timer: null }, T0);
  s = applyResponse(s, { success: true, timer: null }, T0);
  assert.equal(s.timer, null);
});

test('not_modified resets null streak and keeps value', () => {
  let s = applyResponse(seeded(), { success: true, timer: null }, T0);
  s = applyResponse(s, { success: true, not_modified: true }, T0);
  s = applyResponse(s, { success: true, timer: null }, T0);
  assert.notEqual(s.timer, null);
});

test('duplicate / older version does not re-seed', () => {
  const s = seeded();
  const dup = applyResponse(s, { success: true, timer: row() }, T0);
  assert.equal(dup.timer, s.timer);
  const old = applyResponse(s, { success: true, timer: row({ version: 2, status: 'paused' }) }, T0);
  assert.equal(old.timer?.status, 'running');
});

test('stopped shows nothing, never base duration', () => {
  const s = applyResponse(seeded(), { success: true, timer: row({ status: 'stopped', version: 4 }) }, T0);
  assert.equal(computeDisplaySeconds(s, T0), null);
});

test('version 0 is a real value: param sent, duplicate ignored', () => {
  assert.equal(versionParam(-1), '');
  assert.equal(versionParam(0), 'version=0');
  const s = applyResponse(initialLabTimerState, { success: true, timer: row({ version: 0 }) }, T0);
  assert.equal(s.version, 0);
  const again = applyResponse(s, { success: true, timer: row({ version: 0 }) }, T0);
  assert.equal(again.timer, s.timer);
});

test('server offset applied; sign guard clamps future started_at', () => {
  const s = applyResponse(initialLabTimerState,
    { success: true, timer: row(), serverTime: new Date(T0 + 5000).toISOString() }, T0);
  assert.equal(s.serverTimeOffsetMs, 5000);
  assert.equal(computeDisplaySeconds(s, T0), 535);
  const fut = applyResponse(initialLabTimerState,
    { success: true, timer: row({ started_at: '2026-10-06T12:05:00Z' }) }, T0);
  assert.equal(computeDisplaySeconds(fut, T0), 600);
});

test('paused uses elapsed_when_paused; countup capped at duration', () => {
  const p = applyResponse(initialLabTimerState, { success: true, timer: row({ status: 'paused', elapsed_when_paused: 100 }) }, T0);
  assert.equal(computeDisplaySeconds(p, T0), 500);
  const c = applyResponse(initialLabTimerState, { success: true, timer: row({ mode: 'countup', started_at: '2026-10-06T11:00:00Z' }) }, T0);
  assert.equal(computeDisplaySeconds(c, T0), 600);
});

test('401 stop_polling sticks', () => {
  assert.equal(applyResponse(seeded(), { stop_polling: true }, T0).stopPolling, true);
});
