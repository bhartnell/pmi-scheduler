import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAdjustment, computeTimer, type OsceTimerState } from '../lib/osce-timer.ts';

const T0 = new Date('2026-11-19T16:00:00.000Z').getTime();
const iso = (ms: number) => new Date(ms).toISOString();
const running = (startOffsetSec = 0): OsceTimerState => ({ phase: 'scenario', started_at: iso(T0 + startOffsetSec * 1000), paused_at: null, paused_ms: 0 });
const rem = (s: OsceTimerState, nowMs: number) => { const c = computeTimer(s, nowMs); return c.active ? c.remainingSec : -1; };

test('+60 gives a minute back while running', () => {
  const now = T0 + 300_000; // 5:00 elapsed, 7:00 left
  const r = applyAdjustment(running(), 'adjust', 60, iso(now))!;
  assert.equal(r.before_sec, 420);
  assert.equal(r.after_sec, 480);
  assert.equal(rem(r.state, now), 480);
  assert.equal(rem(r.state, now + 10_000), 470); // keeps counting down
});

test('-60 takes a minute away', () => {
  const now = T0 + 300_000;
  const r = applyAdjustment(running(), 'adjust', -60, iso(now))!;
  assert.equal(rem(r.state, now), 360);
});

test('set remaining to 05:00', () => {
  const now = T0 + 100_000;
  const r = applyAdjustment(running(), 'set_remaining', 300, iso(now))!;
  assert.equal(rem(r.state, now), 300);
  assert.equal(r.clamped, false);
});

test('late start: set remaining fixes a start that was 4 minutes late', () => {
  const now = T0 + 5_000;
  const r = applyAdjustment(running(), 'set_remaining', 12 * 60 - 4 * 60 - 5, iso(now))!;
  assert.equal(rem(r.state, now), 12 * 60 - 4 * 60 - 5);
});

test('adjusting while paused changes remaining and stays paused', () => {
  const pausedAt = T0 + 200_000;
  const s: OsceTimerState = { ...running(), paused_at: iso(pausedAt) };
  const now = pausedAt + 90_000;
  const r = applyAdjustment(s, 'adjust', 60, iso(now))!;
  assert.equal(r.before_sec, 520);
  assert.equal(rem(r.state, now), 580);
  assert.equal(r.state.paused_at, iso(pausedAt));
  assert.equal(rem(r.state, now + 60_000), 580); // frozen
});

test('adjust with prior pause time (paused_ms) is respected', () => {
  const s: OsceTimerState = { ...running(), paused_ms: 30_000 };
  const now = T0 + 130_000; // 100s elapsed
  const r = applyAdjustment(s, 'set_remaining', 600, iso(now))!;
  assert.equal(rem(r.state, now), 600);
});

test('clamps to 0 and to phase total, and reports it', () => {
  const now = T0 + 60_000;
  const lo = applyAdjustment(running(), 'adjust', -9999, iso(now))!;
  assert.equal(lo.after_sec, 0);
  assert.equal(lo.clamped, true);
  const hi = applyAdjustment(running(), 'set_remaining', 99999, iso(now))!;
  assert.equal(hi.after_sec, 720);
  assert.equal(hi.clamped, true);
  const oral = applyAdjustment({ ...running(), phase: 'oral' }, 'set_remaining', 99999, iso(now))!;
  assert.equal(oral.after_sec, 1080);
});

test('idle or non-finite input returns null', () => {
  assert.equal(applyAdjustment({ phase: 'idle', started_at: null, paused_at: null, paused_ms: 0 }, 'adjust', 60, iso(T0)), null);
  assert.equal(applyAdjustment(running(), 'adjust', NaN, iso(T0)), null);
});
