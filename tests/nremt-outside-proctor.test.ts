import { test } from 'node:test';
import assert from 'node:assert/strict';
import { outsideProctorDecision, isPmiAddress, signInLine } from '../lib/nremt-outside-proctor.ts';

test('PMI address unchanged for any role', () => {
  assert.equal(outsideProctorDecision('a@pmi.edu', false, 'instructor'), 'proceed');
  assert.equal(outsideProctorDecision('a@my.pmi.edu', false, 'admin'), 'proceed');
});
test('existing account unchanged', () => {
  assert.equal(outsideProctorDecision('x@gmail.com', true, 'instructor'), 'proceed');
});
test('outside address with no account: admin creates, instructor refused', () => {
  assert.equal(outsideProctorDecision('x@gmail.com', false, 'admin'), 'create_account');
  assert.equal(outsideProctorDecision('x@gmail.com', false, 'superadmin'), 'create_account');
  assert.equal(outsideProctorDecision('x@gmail.com', false, 'instructor'), 'refuse');
});
test('second add of the same address finds the account, creates nothing', () => {
  assert.equal(outsideProctorDecision('x@gmail.com', true, 'admin'), 'proceed');
});
test('helpers', () => {
  assert.equal(isPmiAddress('A@PMI.EDU'), true);
  assert.equal(isPmiAddress('a@notpmi.edu'), false);
  assert.match(signInLine('k@gmail.com'), /using k@gmail\.com\. Your home page then shows 'NREMT Testing Day - open your stations'\.$/);
});
