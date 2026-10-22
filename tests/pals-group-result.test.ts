import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePalsResult, palsGroupResult, palsMemberResults } from '../lib/pals-group-result.ts';

test('normalises PASS / pass / NR casing, rejects unknown values', () => {
  assert.equal(normalizePalsResult('PASS'), 'PASS');
  assert.equal(normalizePalsResult(' pass '), 'PASS');
  assert.equal(normalizePalsResult('nr'), 'NR');
  assert.equal(normalizePalsResult('fail'), 'NR');
  assert.equal(normalizePalsResult(null), null);
  assert.equal(normalizePalsResult('watch'), null);
});

test('group passes with 2 of 3 rounds (mixed case input)', () => {
  const r = palsGroupResult(['PASS', 'nr', 'pass']);
  assert.deepEqual(r, { status: 'pass', passedRounds: 2, failedRounds: 1, remainingRounds: 0 });
});

test('synthetic FAILING group: 2 of 3 rounds not passed', () => {
  const r = palsGroupResult(['NR', 'PASS', 'NR']);
  assert.equal(r.status, 'fail');
  assert.equal(r.passedRounds, 1);
  assert.equal(r.failedRounds, 2);
});

test('fail is decided early once 2 rounds failed, before round 3', () => {
  assert.equal(palsGroupResult(['NR', 'NR']).status, 'fail');
});

test('pass is decided early once 2 rounds passed', () => {
  assert.equal(palsGroupResult(['PASS', 'PASS']).status, 'pass');
});

test('pending while the outcome is still open', () => {
  assert.equal(palsGroupResult([]).status, 'pending');
  assert.equal(palsGroupResult(['PASS']).status, 'pending');
  assert.equal(palsGroupResult(['NR']).status, 'pending');
  assert.equal(palsGroupResult(['PASS', 'NR']).status, 'pending');
});

test('every member gets the group result', () => {
  const out = palsMemberResults(['a', 'b', 'c'], ['NR', 'NR', 'PASS']);
  assert.equal(Object.keys(out).length, 3);
  for (const id of ['a', 'b', 'c']) assert.equal(out[id].status, 'fail');
});
