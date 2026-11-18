import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreRowHasContent } from '../lib/osce-score-content.ts';

test('all-null row has no content', () => {
  assert.equal(scoreRowHasContent({ id: 'x', scene_safety: null, readiness: null, submitted_at: null, general_notes: null }), false);
  assert.equal(scoreRowHasContent({}), false);
  assert.equal(scoreRowHasContent(null), false);
});
test('one rating counts', () => {
  assert.equal(scoreRowHasContent({ communication: 'S' }), true);
  assert.equal(scoreRowHasContent({ oral_reassessment: 'U' }), true);
});
test('whitespace-only note does not count, real note does', () => {
  assert.equal(scoreRowHasContent({ general_notes: '   \n' }), false);
  assert.equal(scoreRowHasContent({ concerns_notes: 'rushed' }), true);
  assert.equal(scoreRowHasContent({ scene_safety_notes: 'ok' }), true);
});
test('submitted or readiness counts', () => {
  assert.equal(scoreRowHasContent({ submitted_at: '2026-11-12T20:00:00Z' }), true);
  assert.equal(scoreRowHasContent({ readiness: 'ready' }), true);
});
