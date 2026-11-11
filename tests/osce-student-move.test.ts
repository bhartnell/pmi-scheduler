import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planStudentMove } from '../lib/osce-student-move.ts';

const rows = [
  { id: 'a1', time_block_id: 'A', slot_number: 1 },
  { id: 'a2', time_block_id: 'A', slot_number: 2 },
  { id: 'a3', time_block_id: 'A', slot_number: 3 },
  { id: 'b1', time_block_id: 'B', slot_number: 1 },
  { id: 'b4', time_block_id: 'B', slot_number: 4 },
];

test('move to an open slot in another block writes only the mover', () => {
  const p = planStudentMove(rows, 'a2', { mode: 'slot', blockId: 'B', slot: 2 });
  assert.ok(p.ok);
  assert.deepEqual(p.writes, [{ id: 'a2', time_block_id: 'B', slot_number: 2 }]);
});

test('end of block creates the next number after the current last, past capacity ok', () => {
  const p = planStudentMove(rows, 'a1', { mode: 'end', blockId: 'B' });
  assert.ok(p.ok);
  assert.deepEqual(p.to, { blockId: 'B', slot: 5 });
  assert.equal(p.writes.length, 1);
});

test('end of own block ignores the mover when finding the last slot', () => {
  const p = planStudentMove(rows, 'a1', { mode: 'end', blockId: 'A' });
  assert.ok(p.ok);
  assert.deepEqual(p.to, { blockId: 'A', slot: 4 });
  // the last student sent to the end of their own block is already there
  assert.equal(planStudentMove(rows, 'a3', { mode: 'end', blockId: 'A' }).ok, false);
});

test('occupied slot without swap is refused and nothing is planned', () => {
  const p = planStudentMove(rows, 'a1', { mode: 'slot', blockId: 'B', slot: 4 });
  assert.equal(p.ok, false);
});

test('swap parks the mover, seats the occupant, then places the mover; no one else is renumbered', () => {
  const p = planStudentMove(rows, 'a1', { mode: 'slot', blockId: 'B', slot: 4, swap: true });
  assert.ok(p.ok);
  assert.equal(p.writes.length, 3);
  assert.deepEqual(p.writes[1], { id: 'b4', time_block_id: 'A', slot_number: 1 });
  assert.deepEqual(p.writes[2], { id: 'a1', time_block_id: 'B', slot_number: 4 });
  assert.ok(p.writes[0].slot_number > 1000);
  assert.ok(p.writes.every(w => ['a1', 'b4'].includes(w.id)));
  assert.equal(p.swappedWithId, 'b4');
});

test('moving to own current slot is refused', () => {
  assert.equal(planStudentMove(rows, 'a2', { mode: 'slot', blockId: 'A', slot: 2 }).ok, false);
});
