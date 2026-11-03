import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyGroupMoves, filterActiveMoves } from '../lib/pals-effective-groups.ts';

const s = (id: string, last: string, status = 'active') => ({ id, first_name: 'X', last_name: last, status });

test('hides withdrawn students and applies a course move (Cooper Long case)', () => {
  const base = {
    g2: [s('long', 'Long'), s('a', 'Adams')],
    g3: [s('booker', 'Booker', 'withdrawn'), s('fife', 'Fife'), s('johnston', 'Johnston'), s('dela', 'Dela Cruz', 'withdrawn')],
  };
  const out = applyGroupMoves(base, [{ student_id: 'long', from_group_id: 'g2', to_group_id: 'g3', duration: 'course' }]);
  assert.deepEqual(out.g3.map((m) => m.id), ['fife', 'johnston', 'long']);
  assert.deepEqual(out.g2.map((m) => m.id), ['a']);
});

test('move is ignored if student is not in the from group; no duplicates', () => {
  const base = { g1: [s('a', 'A')], g2: [s('b', 'B')] };
  const out = applyGroupMoves(base, [{ student_id: 'zzz', from_group_id: 'g1', to_group_id: 'g2', duration: 'course' }]);
  assert.equal(out.g1.length, 1);
  assert.equal(out.g2.length, 1);
});

test("'today' moves lapse on other days", () => {
  const mv = [
    { student_id: 'a', from_group_id: 'g1', to_group_id: 'g2', duration: 'today', move_date: '2026-11-02' },
    { student_id: 'b', from_group_id: 'g1', to_group_id: 'g2', duration: 'course', move_date: '2026-11-02' },
  ];
  assert.equal(filterActiveMoves(mv, '2026-11-03').length, 1);
  assert.equal(filterActiveMoves(mv, '2026-11-02').length, 2);
});
