import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_SNAPSHOT, applyFetchResult, applyRealtimeRow, computeDisplaySeconds, versionQuery,
  type LabTimerRow, type LabTimerSnapshot,
} from '../lib/lab-timer-state.ts';

const NOW = Date.parse('2026-10-06T12:00:00Z');
const row = (o: Partial<LabTimerRow> = {}): LabTimerRow => ({
  lab_day_id: 'd1', rotation_number: 1, status: 'running',
  started_at: new Date(NOW - 60_000).toISOString(), elapsed_when_paused: 0,
  duration_seconds: 600, mode: 'countdown', version: 3, ...o,
});
const ticking = (): LabTimerSnapshot => applyFetchResult(INITIAL_SNAPSHOT, { body: { success: true, timer: row(), serverTime: new Date(NOW).toISOString() }, clientNowMs: NOW });

test('running countdown computes remaining', () => {
  assert.equal(computeDisplaySeconds(ticking(), NOW), 540);
});
test('null body (failed fetch) keeps ticking', () => {
  const s = ticking();
  assert.equal(applyFetchResult(s, { body: null, clientNowMs: NOW }), s);
});
test('success with timer:null never becomes 0', () => {
  const s = applyFetchResult(ticking(), { body: { success: true, timer: null }, clientNowMs: NOW });
  assert.equal(computeDisplaySeconds(s, NOW), 540);
});
test('stale stopped response at older version never shows base duration', () => {
  const s = applyFetchResult(ticking(), { body: { success: true, timer: row({ status: 'stopped', started_at: null, version: 2 }) }, clientNowMs: NOW });
  assert.equal(computeDisplaySeconds(s, NOW), 540);
});
test('stopped row yields null, not duration', () => {
  const s = applyRealtimeRow(ticking(), row({ status: 'stopped', started_at: null, version: 4 }));
  assert.equal(computeDisplaySeconds(s, NOW), null);
});
test('duplicate response returns same snapshot', () => {
  const s = ticking();
  const again = applyFetchResult(s, { body: { success: true, timer: row(), serverTime: new Date(NOW).toISOString() }, clientNowMs: NOW });
  assert.equal(again.timer, s.timer);
});
test('version is sent at 0 once a row is held', () => {
  assert.equal(versionQuery(INITIAL_SNAPSHOT), '');
  const s = applyFetchResult(INITIAL_SNAPSHOT, { body: { success: true, timer: row({ version: 0 }) }, clientNowMs: NOW });
  assert.equal(versionQuery(s), 'version=0');
});
test('same-version status change at version 0 is accepted', () => {
  const s = applyFetchResult(INITIAL_SNAPSHOT, { body: { success: true, timer: row({ version: 0, status: 'paused', elapsed_when_paused: 30, started_at: null }) }, clientNowMs: NOW });
  const r = applyRealtimeRow(s, row({ version: 0 }));
  assert.equal(r.timer?.status, 'running');
});
test('server offset corrects skewed client clock; future start clamps', () => {
  const s = applyFetchResult(INITIAL_SNAPSHOT, { body: { success: true, timer: row(), serverTime: new Date(NOW + 5000).toISOString() }, clientNowMs: NOW });
  assert.equal(computeDisplaySeconds(s, NOW), 535);
  const f = applyRealtimeRow(s, row({ version: 9, started_at: new Date(NOW + 60_000).toISOString() }));
  assert.equal(computeDisplaySeconds(f, NOW), 600);
});
test('paused uses elapsed_when_paused; countup counts up', () => {
  const p = applyRealtimeRow(INITIAL_SNAPSHOT, row({ status: 'paused', elapsed_when_paused: 100 }));
  assert.equal(computeDisplaySeconds(p, NOW), 500);
  const c = applyRealtimeRow(INITIAL_SNAPSHOT, row({ mode: 'countup' }));
  assert.equal(computeDisplaySeconds(c, NOW), 60);
});
test('running row with no started_at renders nothing, never base duration', () => {
  const s = applyRealtimeRow(INITIAL_SNAPSHOT, row({ status: 'running', started_at: null }));
  assert.equal(computeDisplaySeconds(s, NOW), null);
});
