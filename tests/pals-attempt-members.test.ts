import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAttemptMembers, groupFinalRounds, groupResultFor } from '../lib/pals-attempt-members.ts';

test('recorded roster wins and always includes the lead', () => {
  const m = resolveAttemptMembers({ leadId: 'L', recordedIds: ['a', 'b'], groupMemberIds: ['x', 'y'], absentIds: ['a'] });
  assert.deepEqual(new Set(m), new Set(['L', 'a', 'b']));
});

test('no recorded roster: effective group minus absent, lead kept', () => {
  const m = resolveAttemptMembers({ leadId: 'L', recordedIds: [], groupMemberIds: ['L', 'a', 'b', 'c'], absentIds: new Set(['c']) });
  assert.deepEqual(new Set(m), new Set(['L', 'a', 'b']));
});

test('missing lead does not add undefined', () => {
  assert.deepEqual(resolveAttemptMembers({ groupMemberIds: ['a'] }), ['a']);
});

test('group result: 2 of 3 passes; retest replaces earlier round for same case', () => {
  const r = (id: string, sc: string, result: string, t: string) => ({ id, lab_group_id: 'g', scenario_id: sc, result, attempted_at: t });
  assert.equal(groupResultFor([r('1', 's7', 'PASS', '1'), r('2', 's9', 'PASS', '2')]).status, 'pass');
  assert.equal(groupResultFor([r('1', 's7', 'NR', '1'), r('2', 's9', 'NR', '2')]).status, 'fail');
  assert.equal(groupFinalRounds([r('1', 's7', 'NR', '1'), r('2', 's7', 'PASS', '2')]).length, 1);
  assert.equal(groupResultFor([r('1', 's7', 'PASS', '1')]).status, 'pending');
});
