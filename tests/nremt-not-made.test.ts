import test from 'node:test';
import assert from 'node:assert/strict';
import { notMadeStationIds, type MadeCheckRow } from '../lib/nremt-hub-stations.ts';
import { unitCounts, type RtdInput, type RtdStation } from '../lib/nremt-run-the-day.ts';

// The Nov 25 shape: 14 rows, seven open (six stations; BVM + O2 is a pair) and seven copied closed extras.
const row = (id: string, n: number, group: string | null, closed: boolean, used = false): MadeCheckRow => ({ id, station_number: n, group, closed, used });
const nov25 = (): MadeCheckRow[] => [
  row('med1', 1, 'MED', false), row('trauma1', 2, 'TRA', false), row('cardiac1', 3, 'CAR', false), row('bvm1', 4, 'BVM', false), row('o21', 5, 'O2', false),
  row('x1', 6, 'XYZ', false), row('x2', 7, 'ABC', false),
  row('med2', 8, 'MED', true), row('bvm2', 9, 'BVM', true), row('o22', 10, 'O2', true), row('car2', 11, 'CAR', true), row('car3', 12, 'CAR', true), row('tra2', 13, 'TRA', true), row('tra3', 14, 'TRA', true),
];

test('unused closed extras are not made; open rows and bases never are', () => {
  const nm = notMadeStationIds(nov25());
  assert.deepEqual([...nm].sort(), ['bvm2', 'car2', 'car3', 'med2', 'o22', 'tra2', 'tra3']);
});
test('a closed extra with an evaluation or queue row is a real closed station', () => {
  const rows = nov25().map((r) => (r.id === 'tra2' ? { ...r, used: true } : r));
  assert.equal(notMadeStationIds(rows).has('tra2'), false);
  assert.equal(notMadeStationIds(rows).has('tra3'), true);
});
test('a closed BASE station is a real closed station', () => {
  const rows = nov25().map((r) => (r.id === 'tra1' || r.id === 'trauma1' ? { ...r, closed: true } : r));
  assert.equal(notMadeStationIds(rows).has('trauma1'), false);
});
test('an extra opened and then closed unused is not made again; opened ones never are', () => {
  const rows = nov25().map((r) => (r.id === 'tra2' ? { ...r, closed: false } : r));
  assert.equal(notMadeStationIds(rows).has('tra2'), false);
  const closedAgain = nov25();
  assert.equal(notMadeStationIds(closedAgain).has('tra2'), true);
});
test('no skill group means never not made', () => {
  assert.equal(notMadeStationIds([row('a', 1, null, false), row('b', 2, null, true)]).size, 0);
});

const st = (id: string, n: number, status: 'open' | 'closed'): RtdStation => ({ id, station_number: n, station_type: 'skills', custom_title: null, skill_name: id, skillSheetId: id, instructorName: null, coordinatorStatus: status } as unknown as RtdStation);
test('Stations free total counts open stations only', () => {
  const input = { students: [], stations: [st('a', 1, 'open'), st('b', 2, 'open'), st('c', 3, 'closed')], cells: {}, skillColumns: [], skillCells: {} } as unknown as RtdInput;
  assert.equal(unitCounts(input, Date.now(), new Set()).total, 2);
});

import { cleanReopenBody } from '../lib/nremt-hub-stations.ts';
import { nextExtraStationName } from '../lib/nremt-pairs.ts';

test('Open another on a not-made row: clean body, no proctor, no assistant, no room', () => {
  const b = cleanReopenBody('Patient Assessment - Trauma 2');
  assert.equal(b.coordinator_status, 'open');
  assert.equal(b.instructor_name, null);
  assert.equal(b.instructor_email, '');
  assert.equal(b.nremt_assistant, null);
  assert.equal(b.room, null);
  assert.equal(b.custom_title, 'Patient Assessment - Trauma 2');
});
test('the first extra is always "2", even when the reused row was titled "... Trauma 3"', () => {
  const made = [{ station_number: 2, name: 'Patient Assessment — Trauma' }];
  assert.equal(nextExtraStationName(made, 'Patient Assessment - Trauma'), 'Patient Assessment - Trauma 2');
  const made2 = [...made, { station_number: 13, name: 'Patient Assessment - Trauma 2' }];
  assert.equal(nextExtraStationName(made2, 'x'), 'Patient Assessment - Trauma 3');
});
