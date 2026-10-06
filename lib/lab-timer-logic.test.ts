import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_SNAPSHOT, applyFetchBody, applyRealtimeRow, computeView, versionParam,
  type LabTimerRow, type LabTimerSnapshot,
} from './lab-timer-logic.ts';

const NOW = Date.parse('2026-10-05T18:00:00Z');
const row = (o: Partial<LabTimerRow> = {}): LabTimerRow => ({
  id: 'r1', lab_day_id: 'd1', rotation_number: 1, status: 'running',
  started_at: new Date(NOW - 522_000).toISOString(), paused_at: null,
  elapsed_when_paused: 0, duration_seconds: 600, mode: 'countdown', version: 3, ...o,
});
const seeded = (o: Partial<LabTimerRow> = {}): LabTimerSnapshot =>
  applyFetchBody(EMPTY_SNAPSHOT, { success: true, timer: row(o), version: o.version ?? 3, serverTime: new Date(NOW).toISOString() }, NOW);

test('running countdown decrements from started_at', () => {
  const s = seeded();
  assert.equal(computeView(s, NOW).seconds, 78);
  assert.equal(computeView(s, NOW + 2000).seconds, 76);
});

test('null timer response keeps ticking (the 00:00 bug)', () => {
  const s = seeded();
  const after = applyFetchBody(s, { success: true, timer: null, version: 0 }, NOW + 1000);
  assert.equal(computeView(after, NOW + 1000).seconds, 77);
});

test('failed / empty response keeps ticking', () => {
  const s = seeded();
  assert.equal(applyFetchBody(s, { success: false }, NOW), s);
  assert.equal(applyFetchBody(s, null, NOW), s);
});

test('stopped row never yields a base-duration number (the 10:00 bug)', () => {
  const s = seeded({ status: 'stopped', started_at: null, version: 4 });
  assert.deepEqual(computeView(s, NOW), { phase: 'idle', seconds: null });
});

test('no row at all shows nothing, not 0 or base', () => {
  assert.deepEqual(computeView(EMPTY_SNAPSHOT, NOW), { phase: 'none', seconds: null });
});

test('older-version response cannot move the display backwards', () => {
  const s = seeded({ version: 5 });
  const after = applyFetchBody(s, { success: true, timer: row({ status: 'stopped', version: 4 }), version: 4 }, NOW);
  assert.equal(after.row?.status, 'running');
});

test('duplicate version is a no-op (same object)', () => {
  const s = seeded();
  const same = applyFetchBody(s, { success: true, timer: row(), version: 3, serverTime: new Date(NOW).toISOString() }, NOW);
  assert.equal(same, s);
});

test('version 0 is sent after first fetch (off-by-zero)', () => {
  assert.equal(versionParam(EMPTY_SNAPSHOT), '');
  const s = applyFetchBody(EMPTY_SNAPSHOT, { success: true, timer: row({ version: 0 }), version: 0 }, NOW);
  assert.equal(versionParam(s), '&version=0');
});

test('not_modified keeps row and refreshes offset', () => {
  const s = seeded();
  const after = applyFetchBody(s, { success: true, not_modified: true, serverTime: new Date(NOW + 5000).toISOString() }, NOW);
  assert.equal(after.row, s.row);
  assert.equal(after.serverTimeOffset, 5000);
});

test('skewed client clock is corrected by serverTimeOffset', () => {
  const skewedNow = NOW + 30_000; // client 30s fast
  const s = applyFetchBody(EMPTY_SNAPSHOT, { success: true, timer: row(), version: 3, serverTime: new Date(NOW).toISOString() }, skewedNow);
  assert.equal(computeView(s, skewedNow).seconds, 78);
});

test('realtime: newer applies, older ignored, DELETE clears', () => {
  const s = seeded({ version: 3 });
  const paused = applyRealtimeRow(s, 'UPDATE', row({ status: 'paused', elapsed_when_paused: 100, version: 4 }));
  assert.equal(computeView(paused, NOW).seconds, 500);
  assert.equal(applyRealtimeRow(paused, 'UPDATE', row({ version: 2 })), paused);
  assert.equal(applyRealtimeRow(paused, 'DELETE', null).row, null);
});

test('countdown clamps at 0 once elapsed exceeds duration', () => {
  const s = seeded({ started_at: new Date(NOW - 700_000).toISOString() });
  assert.equal(computeView(s, NOW).seconds, 0);
});
