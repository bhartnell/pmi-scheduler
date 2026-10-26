import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStudentHome, type StudentLeadRow } from '../lib/student-home.ts';

const row = (over: Partial<StudentLeadRow> & Record<string, unknown> = {}): StudentLeadRow =>
  ({ date: '2026-10-20', course: null, phase: null, result: 'pass', title: 'Chest pain', room: 'A', ...over }) as StudentLeadRow;

test('cases carry the student-visible note, trimmed, or null when blank', () => {
  const h = buildStudentHome([row({ notesToStudent: '  Work on scene safety ' }), row({ date: '2026-10-19', notesToStudent: '   ' })], [], '2026-10-26');
  assert.equal(h.cases[0].notesToStudent, 'Work on scene safety');
  assert.equal(h.cases[1].notesToStudent, null);
});

test('instructor-only notes never reach the student payload even if a row carries them', () => {
  const h = buildStudentHome([row({ notesToStudent: 'visible', instructor_notes: 'SECRET-INSTRUCTOR-ONLY' })], [], '2026-10-26');
  assert.ok(!JSON.stringify(h).includes('SECRET-INSTRUCTOR-ONLY'));
  assert.ok(!JSON.stringify(h).includes('instructor_notes'));
});
