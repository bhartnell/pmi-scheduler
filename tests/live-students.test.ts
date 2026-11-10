import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLiveStudent, isNotWithdrawn, liveEmbeddedStudents } from '../lib/live-students.ts';

test('isLiveStudent keeps the PALS rule: active or empty only', () => {
  assert.equal(isLiveStudent('active'), true);
  assert.equal(isLiveStudent(null), true);
  assert.equal(isLiveStudent('withdrawn'), false);
  assert.equal(isLiveStudent('on_hold'), false);
});

test('isNotWithdrawn hides only withdrawn', () => {
  assert.equal(isNotWithdrawn('withdrawn'), false);
  for (const s of ['active', 'on_hold', 'graduated', null, undefined]) assert.equal(isNotWithdrawn(s), true);
});

test('liveEmbeddedStudents drops withdrawn and null embeds, keeps order', () => {
  const rows = [
    { student: { id: 'a', status: 'active' } },
    { student: { id: 'b', status: 'withdrawn' } },
    { student: null },
    { student: { id: 'c', status: 'on_hold' } },
  ];
  assert.deepEqual(liveEmbeddedStudents(rows).map((s) => s.id), ['a', 'c']);
  assert.deepEqual(liveEmbeddedStudents(null), []);
});
