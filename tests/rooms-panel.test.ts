import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupByRoom } from '../lib/rooms.ts';

test('groupByRoom groups by room, sorts by station number, puts no-room last', () => {
  const out = groupByRoom([
    { room: null, station_number: 1 },
    { room: 'Room B', station_number: 4 },
    { room: 'Room A', station_number: 3 },
    { room: 'Room B', station_number: 2 },
    { room: '  ', station_number: 5 },
  ]);
  assert.deepEqual(out.map(([r]) => r), ['Room B', 'Room A', 'No room set']);
  assert.deepEqual(out[0][1].map((s) => s.station_number), [2, 4]);
  assert.equal(out[2][1].length, 2);
});
