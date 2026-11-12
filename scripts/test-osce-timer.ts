// Run: node --experimental-strip-types scripts/test-osce-timer.ts
import assert from 'node:assert/strict';
import { computeTimer, applyAction, type OsceTimerState } from '../lib/osce-timer.ts';
const t0 = '2026-11-12T16:00:00.000Z';
const at = (s: number) => new Date(t0).getTime() + s * 1000;
const sc: OsceTimerState = { phase: 'scenario', started_at: t0, paused_at: null, paused_ms: 0 };
const or: OsceTimerState = { ...sc, phase: 'oral' };
const col = (s: OsceTimerState, x: number) => { const c = computeTimer(s, at(x)); return c.active ? c.color : 'idle'; };
assert.deepEqual([col(sc, 599), col(sc, 600), col(sc, 720)], ['neutral', 'yellow', 'red']);
assert.deepEqual([col(or, 899), col(or, 900), col(or, 1080)], ['neutral', 'yellow', 'red']);
const p = applyAction(sc, 'pause', new Date(at(60)).toISOString())!;
assert.equal((computeTimer(p, at(500)) as any).remainingSec, 660);
const r = applyAction(p, 'resume', new Date(at(120)).toISOString())!;
assert.equal((computeTimer(r, at(180)) as any).remainingSec, 600);
assert.equal(computeTimer({ phase: 'idle', started_at: null, paused_at: null, paused_ms: 0 }, 0).active, false);
console.log('osce-timer: all checks passed');
