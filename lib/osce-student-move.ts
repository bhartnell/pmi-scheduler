// OSCE: admin moves a student to any block/slot (Ben 2026-11-11, "no hard locks").
// Pure planner: given the event's roster rows it returns the ordered writes that respect
// UNIQUE (time_block_id, slot_number). Only the student(s) the admin asked to move are touched;
// nobody else is renumbered.

export interface MoveRow {
  id: string;
  time_block_id: string;
  slot_number: number;
}

export type MoveTarget =
  | { mode: 'slot'; blockId: string; slot: number; swap?: boolean }
  | { mode: 'end'; blockId: string };

export interface MoveWrite {
  id: string;
  time_block_id: string;
  slot_number: number;
}

export type MovePlan =
  | { ok: true; writes: MoveWrite[]; to: { blockId: string; slot: number }; swappedWithId: string | null }
  | { ok: false; error: string };

export function planStudentMove(rows: MoveRow[], movingId: string, target: MoveTarget): MovePlan {
  const moving = rows.find(r => r.id === movingId);
  if (!moving) return { ok: false, error: 'Student not found in this event' };
  const others = rows.filter(r => r.id !== movingId && r.time_block_id === target.blockId);

  let slot: number;
  let swapWith: MoveRow | null = null;
  if (target.mode === 'end') {
    slot = Math.max(0, ...others.map(r => r.slot_number)) + 1;
  } else {
    if (!Number.isInteger(target.slot) || target.slot < 1) return { ok: false, error: 'Slot must be a positive whole number' };
    slot = target.slot;
    const occupant = others.find(r => r.slot_number === slot) || null;
    if (occupant) {
      if (!target.swap) return { ok: false, error: 'That slot is taken. Choose an open slot, "end of block", or swap.' };
      swapWith = occupant;
    }
  }

  if (moving.time_block_id === target.blockId && moving.slot_number === slot) {
    return { ok: false, error: 'Student is already in that slot' };
  }

  if (!swapWith) {
    return { ok: true, writes: [{ id: moving.id, time_block_id: target.blockId, slot_number: slot }], to: { blockId: target.blockId, slot }, swappedWithId: null };
  }

  // Swap: park the mover on a slot no one uses, put the occupant in the mover's old seat, then place the mover.
  const maxAll = Math.max(0, ...rows.map(r => r.slot_number));
  const park = maxAll + 1000;
  return {
    ok: true,
    writes: [
      { id: moving.id, time_block_id: moving.time_block_id, slot_number: park },
      { id: swapWith.id, time_block_id: moving.time_block_id, slot_number: moving.slot_number },
      { id: moving.id, time_block_id: target.blockId, slot_number: slot },
    ],
    to: { blockId: target.blockId, slot },
    swappedWithId: swapWith.id,
  };
}
