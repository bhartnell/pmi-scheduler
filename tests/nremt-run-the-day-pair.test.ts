import test from 'node:test';
import assert from 'node:assert/strict';
import { retestWaitingForPair, dayUnits, freeUnitsNow, pairCandidates, spreadUnitSuggestions, unitCounts, pairGap, gapKey, type RtdInput } from '../lib/nremt-run-the-day.ts';

const mk = (id: string) => ({ id, first_name: id.toUpperCase(), last_name: 'X' });
const stations = [
  { id: 'med', station_number: 1, skill_name: 'Medical', proctorName: 'Pat' },
  { id: 'b5', station_number: 5, skill_name: 'BVM', proctorName: 'Schafer', room: 'Closet' },
  { id: 'o6', station_number: 6, skill_name: 'O2 by NRB', proctorName: 'Schafer', room: 'Closet' },
];
const skillColumns = [
  { skillName: 'Medical', stationIds: ['med'], nremtCode: 'E202' },
  { skillName: 'BVM', stationIds: ['b5'], nremtCode: 'E203' },
  { skillName: 'O2 by NRB', stationIds: ['o6'], nremtCode: 'E204' },
];
const base = (over: Partial<RtdInput> = {}): RtdInput => ({ students: [mk('a'), mk('b'), mk('c')], stations, skillColumns, cells: {}, skillCells: {}, ...over });
const NOW = Date.parse('2026-11-25T10:10:00Z');

test('the pair is one unit and counts as one station', () => {
  const units = dayUnits(base());
  assert.equal(units.length, 2);
  assert.equal(units[1].kind, 'pair');
  assert.deepEqual(unitCounts(base(), NOW, new Set()), { free: 2, total: 2 });
});

test('labels say what each student still owes, first part is O2', () => {
  const input = base({
    skillCells: {
      b_BVM: { status: 'completed', result: 'pass' },
      'c_O2 by NRB': { status: 'completed', result: 'pass' },
    } as never,
  });
  const pair = dayUnits(input)[1] as { kind: 'pair'; o2: never; bvm: never };
  const list = pairCandidates(pair, input);
  const by = Object.fromEntries(list.map((c) => [c.student.id, c]));
  assert.equal(by.a.why, 'needs both');
  assert.equal(by.a.stationId, 'o6');
  assert.equal(by.b.why, 'O2 by NRB only');
  assert.equal(by.c.why, 'BVM only');
  assert.equal(by.c.stationId, 'b5');
});

test('a student who passed both parts is not offered', () => {
  const input = base({ skillCells: { a_BVM: { status: 'completed', result: 'pass' }, 'a_O2 by NRB': { status: 'completed', result: 'pass' } } });
  const pair = dayUnits(input)[1] as never;
  assert.deepEqual(pairCandidates(pair, input).map((c) => c.student.id), ['b', 'c']);
});

test('pair is occupied while someone is en route or in progress at either part', () => {
  const enRoute = base({ cells: { a_b5: { status: 'queued', queueId: 'q' } } });
  assert.deepEqual(freeUnitsNow(enRoute, NOW, new Set()).units.map((u) => u.key), ['med']);
  const inProg = base({ cells: { a_o6: { status: 'in_progress' } } });
  assert.deepEqual(freeUnitsNow(inProg, NOW, new Set()).units.map((u) => u.key), ['med']);
  assert.deepEqual(unitCounts(inProg, NOW, new Set()), { free: 1, total: 2 });
});

test('a closed part closes the unit', () => {
  const input = base({ stations: stations.map((s) => (s.id === 'b5' ? { ...s, coordinatorStatus: 'closed' as const } : s)) });
  assert.deepEqual(freeUnitsNow(input, NOW, new Set()).units.map((u) => u.key), ['med']);
});

test('five minute gap after finishing one part while still needing the other', () => {
  const input = base({
    cells: { a_o6: { status: 'completed', result: 'pass', completedAt: '2026-11-25T10:07:00Z' } },
    skillCells: { 'a_O2 by NRB': { status: 'completed', result: 'pass' } },
  });
  const r = freeUnitsNow(input, NOW, new Set());
  assert.deepEqual(r.units.map((u) => u.key), ['med']);
  const g = r.gaps.values().next().value!;
  assert.equal(g.student.id, 'a');
  assert.equal(g.finished, 'o2');
  // dismissed on this screen: free again
  const key = gapKey(g, 'pair-o6');
  assert.equal(freeUnitsNow(input, NOW, new Set([key])).units.length, 2);
  // after 5 minutes: normal rules
  assert.equal(freeUnitsNow(input, NOW + 4 * 60000, new Set()).units.length, 2);
});

test('no gap once the second part started, or when the other part is already passed', () => {
  const started = base({
    cells: { a_o6: { status: 'completed', result: 'pass', completedAt: '2026-11-25T10:07:00Z' }, a_b5: { status: 'in_progress' } },
    skillCells: { 'a_O2 by NRB': { status: 'completed', result: 'pass' } },
  });
  const pair = dayUnits(started)[1] as never;
  assert.equal(pairGap(pair, started, NOW), null);
  const done = base({
    cells: { a_o6: { status: 'completed', result: 'pass', completedAt: '2026-11-25T10:07:00Z' } },
    skillCells: { 'a_O2 by NRB': { status: 'completed', result: 'pass' }, a_BVM: { status: 'completed', result: 'pass' } },
  });
  assert.equal(pairGap(dayUnits(done)[1] as never, done, NOW), null);
});

test('spread treats the pair as one station', () => {
  const sp = spreadUnitSuggestions(freeUnitsNow(base(), NOW, new Set()).units, base());
  assert.equal(sp.length, 2);
  assert.notEqual(sp[0].top?.student.id, sp[1].top?.student.id);
});


// ---- Fair order for the pair (card 4235cd1c) ----
test('pair: fewest finished first, longest wait next, name last; Send still routes to the first part owed', () => {
  const input = base({
    skillCells: {
      a_Medical: { status: 'completed', result: 'pass', completedAt: '2026-11-25T17:30:00Z' },
      b_Medical: { status: 'completed', result: 'fail', completedAt: '2026-11-25T17:10:00Z' },
    } as never,
  });
  const pair = dayUnits(input)[1] as never;
  const list = pairCandidates(pair, input);
  assert.deepEqual(list.map((c) => c.student.id), ['c', 'b', 'a']); // c none; b earlier finish than a
  assert.equal(list[0].stationId, 'o6'); // owes both: O2 first
});

test('pair: retests off leaves out a failed part, a never-attempted part is still owed', () => {
  const input = base({ skillCells: { 'a_O2 by NRB': { status: 'completed', result: 'fail' }, b_BVM: { status: 'completed', result: 'fail' }, 'b_O2 by NRB': { status: 'completed', result: 'fail' } } as never });
  const pair = dayUnits(input)[1] as never;
  const off = pairCandidates(pair, input);
  assert.deepEqual(off.map((c) => c.student.id).sort(), ['a', 'c']);
  assert.equal(off.find((c) => c.student.id === 'a')!.stationId, 'b5'); // O2 failed, BVM never attempted -> BVM
  assert.equal(retestWaitingForPair(pair, input), 1); // b failed both
  const on = pairCandidates(pair, input, { includeRetests: true });
  assert.equal(on.length, 3);
  assert.equal(on.find((c) => c.student.id === 'a')!.stationId, 'o6'); // retests on: owes O2 again first
});
