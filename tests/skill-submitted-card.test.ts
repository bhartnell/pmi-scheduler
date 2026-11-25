import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSubmittedCard, shouldShowSubmittedCard, submittedCardVisible } from '../lib/skill-submitted-card.ts';

const at = new Date(2026, 10, 25, 9, 5);
test('pass with points', () => {
  const c = buildSubmittedCard({ studentName: 'A B', skillName: 'Bleeding Control', result: 'pass', pointsEarned: 9, pointsPossible: 10, savedAt: at });
  assert.equal(c.title, 'Submitted');
  assert.equal(c.detail, 'A B - Bleeding Control - PASS');
  assert.equal(c.pointsLine, '9 / 10 points');
  assert.match(c.timeLine, /^Saved /);
});
test('fail', () => {
  assert.equal(buildSubmittedCard({ studentName: 'A', skillName: 'S', result: 'fail', savedAt: at }).resultLabel, 'FAIL');
});
test('below minimum pass says sent for review', () => {
  const c = buildSubmittedCard({ studentName: 'A', skillName: 'S', result: 'pass', belowMinReason: 'ran out of time', savedAt: at });
  assert.match(c.resultLabel, /Pass below minimum - sent for review/);
});
test('no points line when sheet has no points', () => {
  assert.equal(buildSubmittedCard({ result: 'pass', savedAt: at }).pointsLine, null);
  assert.equal(buildSubmittedCard({ result: 'pass', pointsEarned: 0, pointsPossible: 0, savedAt: at }).pointsLine, null);
});
test('show only after confirmed complete save', () => {
  assert.equal(shouldShowSubmittedCard({ saveStatus: 'complete', success: true, evaluationId: 'x' }), true);
  assert.equal(shouldShowSubmittedCard({ saveStatus: 'in_progress', success: true, evaluationId: 'x' }), false);
  assert.equal(shouldShowSubmittedCard({ saveStatus: 'complete', success: true }), false);
  assert.equal(shouldShowSubmittedCard({ saveStatus: 'complete', success: false, evaluationId: 'x' }), false);
});
test('visible only until a student is picked', () => {
  assert.equal(submittedCardVisible(true, ''), true);
  assert.equal(submittedCardVisible(true, 'stu1'), false);
  assert.equal(submittedCardVisible(false, ''), false);
});
test('remediation is labelled REMEDIATION, not FAIL; unknown values are upper-cased', () => {
  assert.equal(buildSubmittedCard({ result: 'remediation', savedAt: at }).resultLabel, 'REMEDIATION');
  assert.equal(buildSubmittedCard({ result: 'Remediation', savedAt: at }).detail, 'Student - Skill - REMEDIATION');
  assert.equal(buildSubmittedCard({ result: 'incomplete', savedAt: at }).resultLabel, 'INCOMPLETE');
});
