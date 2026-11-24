import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyStudent, computeDayStats } from '../lib/nremt-day-stats.ts';

const stations = [{ id: 'a' }, { id: 'b' }];
const students = [{ id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's4' }];
const cells = {
  s1_a: { status: 'completed' },
  s1_b: { status: 'completed' }, // complete
  s2_a: { status: 'in_progress' }, // testing
  s3_a: { status: 'completed' }, // waiting (one done, none in progress)
};

test('classifyStudent: complete beats testing beats waiting', () => {
  assert.equal(classifyStudent(students[0], stations, cells), 'complete');
  assert.equal(classifyStudent(students[1], stations, cells), 'testing');
  assert.equal(classifyStudent(students[2], stations, cells), 'waiting');
  assert.equal(classifyStudent(students[3], stations, cells), 'waiting');
});

test('classifyStudent: no stations means nobody is complete', () => {
  assert.equal(classifyStudent(students[0], [], {}), 'waiting');
});

test('computeDayStats counts and skill completion', () => {
  const skillCells = { s1_x: { status: 'completed' }, s1_y: { status: 'completed' }, s2_x: { status: 'in_progress' } };
  const st = computeDayStats(students, stations, cells, [{ skillName: 'x' }, { skillName: 'y' }], skillCells);
  assert.deepEqual(st, { students: 4, testing: 1, waiting: 2, complete: 1, skillsCompleted: 2, skillsPossible: 8 });
});
