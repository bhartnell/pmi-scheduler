import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffScoreFields, stripProtectedFields } from '../lib/osce-score-edit.ts';

test('diff records old and new for changed fields only; null equals blank', () => {
  const existing = { scene_safety: 'S', general_notes: null, readiness: 'ready' };
  const d = diffScoreFields(existing, { scene_safety: 'N', general_notes: '', readiness: 'ready' });
  assert.deepEqual(d, { scene_safety: { old: 'S', new: 'N' } });
});

test('diff of a new note captures old null', () => {
  const d = diffScoreFields({ general_notes: null }, { general_notes: 'late arrival' });
  assert.deepEqual(d, { general_notes: { old: null, new: 'late arrival' } });
});

test('no change gives empty diff', () => {
  assert.deepEqual(diffScoreFields({ a: 'S' }, { a: 'S' }), {});
});

test('protected fields (submitted_at, edit flag, ids) are stripped', () => {
  const out = stripProtectedFields({ submitted_at: null, edit_after_submit: true, id: 'x', assessment_id: 'y', scene_safety: 'S' });
  assert.deepEqual(out, { scene_safety: 'S' });
});
