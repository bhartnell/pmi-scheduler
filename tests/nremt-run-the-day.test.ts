import test from 'node:test';
import assert from 'node:assert/strict';
import { candidatesForStation, freeStations, enRouteList, whyLine, minutesSince } from '../lib/nremt-run-the-day.ts';
import { classifyStudent } from '../lib/nremt-day-stats.ts';

const mk = (id: string) => ({ id, first_name: id.toUpperCase(), last_name: 'X' });
const students = [mk('a'), mk('b'), mk('c')];
// 4 stations, 2 skills: Medical = m1,m2 ; Trauma = t1,t2
const stations = [
  { id: 'm1', station_number: 1, instructorName: 'Pat' },
  { id: 'm2', station_number: 2, instructorName: 'Sam' },
  { id: 't1', station_number: 3, instructorName: 'Lee' },
  { id: 't2', station_number: 4, instructorName: 'Kim', coordinatorStatus: 'closed' as const },
];
const skillColumns = [
  { skillName: 'Medical', stationIds: ['m1', 'm2'] },
  { skillName: 'Trauma', stationIds: ['t1', 't2'] },
];
const base = { students, stations, skillColumns, cells: {}, skillCells: {} };

test('free stations leave out closed, busy and en route stations', () => {
  const input = {
    ...base,
    cells: { a_m1: { status: 'in_progress' }, b_t1: { status: 'queued', queueId: 'q1' } },
  };
  assert.deepEqual(freeStations(input).map((s) => s.id), ['m2']); // t2 closed, m1 busy, t1 en route
});

test('a passed skill at one station is not offered at a duplicate station of the same skill', () => {
  const input = {
    ...base,
    cells: { a_m1: { status: 'completed', result: 'pass' } },
    skillCells: { a_Medical: { status: 'completed', result: 'pass' } },
  };
  assert.deepEqual(candidatesForStation(stations[1], input).map((c) => c.student.id), ['b', 'c']);
});

test('a failed skill is offered again and marked retake with the first proctor', () => {
  const input = {
    ...base,
    skillCells: { a_Medical: { status: 'completed', result: 'fail', evalSummary: { evaluatorName: 'Pat' } } },
  };
  const c = candidatesForStation(stations[1], input).find((x) => x.student.id === 'a')!;
  assert.equal(c.isRetake, true);
  assert.equal(whyLine(c), 'Retake - first attempt graded by Pat');
  assert.equal(c.sameProctorAsFirstAttempt, false); // m2 proctor is Sam
});

test('same proctor as first attempt goes last, but is not blocked', () => {
  const input = {
    ...base,
    skillCells: { a_Medical: { status: 'completed', result: 'fail', evalSummary: { evaluatorName: 'pat' } } },
  };
  const list = candidatesForStation(stations[0], input); // m1 proctor Pat
  assert.equal(list[list.length - 1].student.id, 'a');
  assert.equal(list[list.length - 1].sameProctorAsFirstAttempt, true);
  assert.equal(list.length, 3);
});

test('a student en route or testing elsewhere is not eligible', () => {
  const input = {
    ...base,
    cells: { a_t1: { status: 'queued', queueId: 'q' }, b_m1: { status: 'in_progress' } },
  };
  assert.deepEqual(candidatesForStation(stations[1], input).map((c) => c.student.id), ['c']);
  assert.equal(enRouteList(input).length, 1);
});

test('fewest done first', () => {
  const input = {
    ...base,
    skillCells: { b_Trauma: { status: 'completed', result: 'pass' } },
  };
  assert.deepEqual(candidatesForStation(stations[0], input).map((c) => c.student.id), ['a', 'c', 'b']);
  assert.equal(whyLine(candidatesForStation(stations[0], input)[2]), '1 of 2 done - has not done Medical');
});

test('minutesSince', () => {
  assert.equal(minutesSince(null, 0), null);
  assert.equal(minutesSince(new Date(0).toISOString(), 11 * 60000), 11);
});

// classifyStudent by skill: 14 stations, 7 skills
const st14 = Array.from({ length: 14 }, (_, i) => ({ id: `s${i}` }));
const cols7 = Array.from({ length: 7 }, (_, i) => ({ skillName: `K${i}` }));
test('classifyStudent by skill: one station per skill done = complete', () => {
  const skillCells: Record<string, { status: string }> = {};
  cols7.forEach((c) => (skillCells[`u_${c.skillName}`] = { status: 'completed' }));
  assert.equal(classifyStudent({ id: 'u' }, st14, {}, cols7, skillCells), 'complete');
});
test('classifyStudent by skill: 6 of 7 = waiting', () => {
  const skillCells: Record<string, { status: string }> = {};
  cols7.slice(0, 6).forEach((c) => (skillCells[`u_${c.skillName}`] = { status: 'completed' }));
  assert.equal(classifyStudent({ id: 'u' }, st14, {}, cols7, skillCells), 'waiting');
});
test('classifyStudent by skill: in progress at any station = testing', () => {
  assert.equal(classifyStudent({ id: 'u' }, st14, { u_s9: { status: 'in_progress' } }, cols7, {}), 'testing');
});
test('classifyStudent: no skill columns keeps the station rule', () => {
  const two = [{ id: 'a' }, { id: 'b' }];
  assert.equal(classifyStudent({ id: 'u' }, two, { u_a: { status: 'completed' }, u_b: { status: 'completed' } }, [], {}), 'complete');
  assert.equal(classifyStudent({ id: 'u' }, two, { u_a: { status: 'completed' } }, [], {}), 'waiting');
});

test('a student in progress at any station is not en route anywhere, and the sent station is free again', () => {
  const input = {
    ...base,
    cells: { a_m1: { status: 'queued', queueId: 'q1' }, a_m2: { status: 'in_progress' } },
  };
  assert.deepEqual(enRouteList(input), []);
  assert.ok(freeStations(input).some((s) => s.id === 'm1'));
});
