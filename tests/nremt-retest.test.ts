import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRetestState, retestCellLabel } from '../lib/nremt-retest.ts';

const map = { st1: 'sheetA', st2: 'sheetA' };
const open = { st1: 'open', st2: 'open' };
const ev = (o: object) => ({ id: 'e', student_id: 's1', skill_sheet_id: 'sheetA', result: 'fail', status: 'complete', created_at: '2026-11-25T10:00:00Z', ...o });
const q = (o: object) => ({ id: 'q1', student_id: 's1', station_id: 'st1', status: 'queued', created_at: '2026-11-25T13:00:00Z', ...o });
const run = (queueEntries: any[], evaluations: any[], stationStatus: any = open) =>
  computeRetestState({ queueEntries, evaluations, stationSkillMap: map, stationStatus });

test('fail then queued row at open station: in flight, skill retest en_route', () => {
  const r = run([q({})], [ev({})]);
  assert.equal(r.inFlight['s1_st1'].status, 'queued');
  assert.equal(r.skillInfo['s1__sheetA'].retest, 'en_route');
  assert.equal(r.skillInfo['s1__sheetA'].attemptCount, 1);
});
test('same with in_progress', () => {
  const r = run([q({ status: 'in_progress' })], [ev({})]);
  assert.equal(r.inFlight['s1_st1'].status, 'in_progress');
  assert.equal(r.skillInfo['s1__sheetA'].retest, 'in_progress');
});
test('stale in_progress row created after a Pass is ignored', () => {
  const r = run([q({ status: 'in_progress' })], [ev({ result: 'pass' })]);
  assert.deepEqual(r.inFlight, {});
  assert.equal(r.skillInfo['s1__sheetA'].retest, null);
});
test('stale row at a CLOSED station after a Fail is ignored', () => {
  const r = run([q({ status: 'in_progress' })], [ev({})], { st1: 'closed', st2: 'open' });
  assert.deepEqual(r.inFlight, {});
});
test('row older than latest completed evaluation is ignored', () => {
  const r = run([q({ created_at: '2026-11-25T09:00:00Z' })], [ev({})]);
  assert.deepEqual(r.inFlight, {});
});
test('only the newest row per student+station counts', () => {
  const r = run([q({ id: 'old', status: 'in_progress', created_at: '2026-11-25T12:00:00Z' }), q({ id: 'new', status: 'completed', created_at: '2026-11-25T13:00:00Z' })], [ev({})]);
  assert.deepEqual(r.inFlight, {});
});
test('retest passed: attemptCount 2, passedOnAttempt 2, retest null', () => {
  const r = run([q({ status: 'completed' })], [ev({ id: 'a' }), ev({ id: 'b', result: 'pass', attempt_number: 2, created_at: '2026-11-25T13:10:00Z' })]);
  const i = r.skillInfo['s1__sheetA'];
  assert.deepEqual([i.attemptCount, i.passedOnAttempt, i.retest], [2, 2, null]);
});
test('in_progress row (attempt 1) + one complete Pass stored as attempt 2: first attempt, no label', () => {
  const r = run([], [ev({ id: 'ip', status: 'in_progress', result: null, attempt_number: 1 }), ev({ id: 'p', result: 'pass', attempt_number: 2, created_at: '2026-11-25T10:20:00Z' })]);
  const i = r.skillInfo['s1__sheetA'];
  assert.deepEqual([i.attemptCount, i.passedOnAttempt], [1, 1]);
  assert.equal(retestCellLabel({ status: 'completed', result: 'pass', passedOnAttempt: i.passedOnAttempt, attemptCount: i.attemptCount }), null);
});
test('admin-corrected sheet (one completed sheet edited Fail to Pass): plain Pass, no label', () => {
  const r = run([], [ev({ result: 'pass', attempt_number: 1 })]);
  const i = r.skillInfo['s1__sheetA'];
  assert.deepEqual([i.attemptCount, i.passedOnAttempt], [1, 1]);
  assert.equal(retestCellLabel({ status: 'completed', result: 'pass', passedOnAttempt: 1, attemptCount: 1 }), null);
});
test('retest failed: attemptCount 2, no pass, retest null', () => {
  const r = run([q({ status: 'completed' })], [ev({ id: 'a' }), ev({ id: 'b', created_at: '2026-11-25T13:10:00Z' })]);
  const i = r.skillInfo['s1__sheetA'];
  assert.deepEqual([i.attemptCount, i.passedOnAttempt, i.retest], [2, null, null]);
});
test('first attempt in progress, no prior evaluation: unchanged', () => {
  const r = run([q({ status: 'in_progress' })], []);
  assert.deepEqual(r.inFlight, {});
  assert.deepEqual(r.skillInfo, {});
});
test('labels', () => {
  assert.equal(retestCellLabel({ status: 'completed', result: 'fail', retest: 'en_route', attemptCount: 1 }), 'Fail - retest en route');
  assert.equal(retestCellLabel({ status: 'completed', result: 'fail', retest: 'in_progress', attemptCount: 1 }), 'Fail - retest in progress');
  assert.equal(retestCellLabel({ status: 'completed', result: 'pass', passedOnAttempt: 2, attemptCount: 2 }), 'Pass - 2nd attempt');
  assert.equal(retestCellLabel({ status: 'completed', result: 'fail', retest: null, attemptCount: 2 }), 'Fail x2');
  assert.equal(retestCellLabel({ status: 'completed', result: 'pass', passedOnAttempt: 1, attemptCount: 1 }), null);
  assert.equal(retestCellLabel({ status: 'completed', result: 'fail', attemptCount: 1 }), null);
});
