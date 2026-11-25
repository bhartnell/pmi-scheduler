import test from 'node:test';
import assert from 'node:assert/strict';
import { candidatesForStation, retestWaitingForStation, freeStations, enRouteList, whyLine, minutesSince, spreadSuggestions, type RtdInput, type RtdStation } from '../lib/nremt-run-the-day.ts';
import { shortSkillLabel, hasShortLabel } from '../lib/nremt-skill-labels.ts';
import { localCalendarDate } from '../lib/nremt-hub-format.ts';
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
  const c = candidatesForStation(stations[1], input, { includeRetests: true }).find((x) => x.student.id === 'a')!;
  assert.equal(c.isRetake, true);
  assert.equal(whyLine(c), 'Retake - first attempt graded by Pat');
  assert.equal(c.sameProctorAsFirstAttempt, false); // m2 proctor is Sam
});

test('same proctor as first attempt goes last, but is not blocked', () => {
  const input = {
    ...base,
    skillCells: { a_Medical: { status: 'completed', result: 'fail', evalSummary: { evaluatorName: 'pat' } } },
  };
  const list = candidatesForStation(stations[0], input, { includeRetests: true }); // m1 proctor Pat
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

const spreadStations: RtdStation[] = [1, 2, 3].map((n) => ({ id: `s${n}`, station_number: n, skill_name: 'Patient Assessment - Medical' }));
const mkSpread = (names: string[]): RtdInput => ({
  students: names.map((n, i) => ({ id: `st${i}`, first_name: n, last_name: 'X' })),
  stations: spreadStations,
  cells: {},
  skillColumns: [{ skillName: 'Patient Assessment - Medical', stationIds: ['s1', 's2', 's3'], nremtCode: 'E202' }],
  skillCells: {},
});

test('each free card gets a different suggested student', () => {
  const r = spreadSuggestions(spreadStations, mkSpread(['Adrian', 'Amairani', 'Bo']));
  assert.deepEqual(r.map((x) => x.top?.student.first_name), ['Adrian', 'Amairani', 'Bo']);
});

test('when nobody is left a card has no suggestion but still lists everyone for Someone else', () => {
  const r = spreadSuggestions(spreadStations, mkSpread(['Adrian', 'Amairani']));
  assert.equal(r[2].top, null);
  assert.equal(r[2].list.length, 2);
  assert.equal(r[0].list.length, 2);
});

test('whyLine uses the short skill label', () => {
  const r = spreadSuggestions(spreadStations, mkSpread(['Adrian']));
  assert.match(whyLine(r[0].top!), /has not done Medical$/);
});

test('short labels by NREMT code; other skills keep their name', () => {
  assert.equal(shortSkillLabel('Patient Assessment - Trauma', 'E201'), 'Trauma');
  assert.equal(shortSkillLabel('Patient Assessment - Medical', 'E202'), 'Medical');
  assert.equal(shortSkillLabel('x', 'E215'), 'Cardiac arrest / AED');
  assert.equal(shortSkillLabel('Joint Immobilization', null), 'Joint Immobilization');
  assert.equal(shortSkillLabel('A – B', 'E999'), 'A - B');
  assert.equal(hasShortLabel('e204'), true);
  assert.equal(hasShortLabel('E999'), false);
});

test('a plain date is a local calendar date, not the day before', () => {
  const d = localCalendarDate('2026-11-25');
  assert.equal(d.getDate(), 25);
  assert.equal(localCalendarDate('2026-11-25T00:00:00+00:00').getDate(), 25);
});

// --- Hub table cell menu (card 4225cd1c) ---
import { cellMenuFor } from '../lib/nremt-run-the-day.ts';

const NOW = Date.parse('2026-11-25T10:00:00Z');

test('cell menu, not started: lists open stations of the skill, closed ones left out, busy ones greyed', () => {
  const input = {
    ...base,
    cells: { b_m1: { status: 'in_progress', startedAt: '2026-11-25T09:50:00Z' } },
  };
  const m = cellMenuFor(students[0], 'Medical', input, NOW);
  assert.equal(m.state, 'not_started');
  assert.deepEqual(m.options.map((o) => [o.stationId, o.busyWith]), [['m1', 'B X'], ['m2', null]]);
  // Trauma: t2 is closed so only t1 is listed
  assert.deepEqual(cellMenuFor(students[0], 'Trauma', base, NOW).options.map((o) => o.stationId), ['t1']);
});

test('cell menu, not started: no open station for the skill gives an empty list', () => {
  const closedAll = { ...base, stations: stations.map((s) => ({ ...s, coordinatorStatus: 'closed' as const })) };
  assert.deepEqual(cellMenuFor(students[0], 'Medical', closedAll, NOW).options, []);
});

test('cell menu, en route: says where, how long, and offers no send list', () => {
  const input = {
    ...base,
    cells: { a_m2: { status: 'queued', queueId: 'q9', queuedAt: '2026-11-25T09:55:00Z' } },
    skillCells: { a_Medical: { status: 'queued', queueId: 'q9', queuedAt: '2026-11-25T09:55:00Z' } },
  };
  const m = cellMenuFor(students[0], 'Medical', input, NOW);
  assert.equal(m.state, 'en_route');
  assert.equal(m.at?.stationId, 'm2');
  assert.equal(m.at?.minutes, 5);
  assert.equal(m.queueId, 'q9');
  assert.deepEqual(m.options, []);
});

test('cell menu, already en route elsewhere: another skill cell reports it so nothing is sent twice', () => {
  const input = { ...base, cells: { a_m2: { status: 'queued', queueId: 'q9' } }, skillCells: { a_Medical: { status: 'queued', queueId: 'q9' } } };
  const m = cellMenuFor(students[0], 'Trauma', input, NOW);
  assert.equal(m.state, 'not_started');
  assert.deepEqual(m.busyElsewhere, { title: 'Station 2', kind: 'en_route' });
});

test('cell menu, fail: retake list with the first attempt evaluator and the same-proctor flag', () => {
  const input = {
    ...base,
    skillCells: { a_Medical: { status: 'completed', result: 'fail', evalSummary: { evaluatorName: 'Pat' } } },
  };
  const m = cellMenuFor(students[0], 'Medical', input, NOW);
  assert.equal(m.state, 'fail');
  assert.equal(m.firstAttemptBy, 'Pat');
  assert.deepEqual(m.options.map((o) => [o.stationId, o.sameProctorAsFirstAttempt]), [['m1', true], ['m2', false]]);
});

test('cell menu, pass: no send list; progress counts passed skills', () => {
  const input = { ...base, skillCells: { a_Medical: { status: 'completed', result: 'pass' } } };
  const m = cellMenuFor(students[0], 'Medical', input, NOW);
  assert.equal(m.state, 'pass');
  assert.deepEqual(m.options, []);
  assert.deepEqual(m.progress, { done: 1, total: 2 });
});

test('cell menu: the BVM + O2 pair appears once, from either column, routed to the first part owed', () => {
  const st = [
    { id: 'o2', station_number: 1, skill_name: 'Oxygen Administration by Non-Rebreather Mask', proctorName: 'Pat', room: 'R1' },
    { id: 'bv', station_number: 2, skill_name: 'BVM Ventilation of an Apneic Adult Patient', proctorName: 'Pat', room: 'R1' },
  ];
  const cols = [
    { skillName: 'O2', stationIds: ['o2'], nremtCode: 'E204' },
    { skillName: 'BVM', stationIds: ['bv'], nremtCode: 'E203' },
  ];
  const input = { students, stations: st, skillColumns: cols, cells: {}, skillCells: {} };
  for (const skill of ['O2', 'BVM']) {
    const m = cellMenuFor(students[0], skill, input, NOW);
    assert.equal(m.options.length, 1);
    assert.equal(m.options[0].title, 'BVM + O2 by NRB');
    assert.equal(m.options[0].stationId, 'o2');
  }
  // student who passed O2 goes to BVM
  const passedO2 = { ...input, skillCells: { a_O2: { status: 'completed', result: 'pass' } } };
  assert.equal(cellMenuFor(students[0], 'BVM', passedO2, NOW).options[0].stationId, 'bv');
});

// --- In-place tile edit and proctor drop-down order (card 4225cd1c) ---
import { patchTilesIn, proctorChoices } from '../lib/nremt-hub-stations.ts';

test('patchTilesIn changes only the named tiles, in my stations and in the groups', () => {
  const t = (id: string, proctor: string | null) => ({ id, proctor });
  const d = { name: 'day', my_stations: [t('a', 'X')], groups: [{ key: 'g', stations: [t('a', 'X'), t('b', 'Y')] }] };
  const out = patchTilesIn(d, ['a'], { proctor: null });
  assert.equal(out.my_stations[0].proctor, null);
  assert.deepEqual(out.groups[0].stations.map((x) => x.proctor), [null, 'Y']);
  assert.equal(d.groups[0].stations[0].proctor, 'X'); // original untouched
  assert.equal(out.name, 'day');
});

test('proctor drop-down: today first, staff after, no one listed twice', () => {
  const today = [{ name: 'Ann', email: 'Ann@x.org' }];
  const staff = [{ name: 'Ann S', email: 'ann@x.org' }, { name: 'Bo', email: 'bo@x.org' }];
  const c = proctorChoices(today, staff);
  assert.deepEqual(c.today.map((p) => p.name), ['Ann']);
  assert.deepEqual(c.staff.map((p) => p.name), ['Bo']);
});


// ---- Fair order: fewest finished (attempts), longest wait, name last; retests off by default (card 4235cd1c) ----
const T = (min: number) => `2026-11-25T17:${String(min).padStart(2, '0')}:00Z`;
const done = (result: string, min?: number) => ({ status: 'completed', result, completedAt: min === undefined ? null : T(min) });
const ids = (l: { student: { id: string } }[]) => l.map((c) => c.student.id);

test('fewer finished beats more finished even when the one with more has fewer passes', () => {
  const input = {
    ...base,
    skillCells: { a_Trauma: done('fail', 1), b_Trauma: done('pass', 2) }, // a: 1 finished 0 passes; b: 1 finished 1 pass
  } as never;
  // c never tested goes first; a and b both finished 1 (not passes) -> tie, earlier finish (a) first
  assert.deepEqual(ids(candidatesForStation(stations[0], input)), ['c', 'a', 'b']);
});

test('a failed visit counts as finished, so the failed student ranks after an untested one', () => {
  const input = { ...base, skillCells: { a_Trauma: done('fail', 1) } } as never;
  assert.deepEqual(ids(candidatesForStation(stations[0], input)), ['b', 'c', 'a']);
});

test('same finished count: earlier last finish first, then name', () => {
  const input = {
    ...base,
    skillCells: { a_Trauma: done('pass', 30), b_Trauma: done('pass', 10), c_Trauma: done('pass', 20) },
  } as never;
  assert.deepEqual(ids(candidatesForStation(stations[0], input)), ['b', 'c', 'a']);
  const tie = { ...base, skillCells: { a_Trauma: done('pass', 10), b_Trauma: done('pass', 10), c_Trauma: done('pass', 10) } } as never;
  assert.deepEqual(ids(candidatesForStation(stations[0], tie)), ['a', 'b', 'c']);
});

test('a finish with no known time goes after known finish times at the same count', () => {
  const input = { ...base, skillCells: { a_Trauma: done('pass'), b_Trauma: done('pass', 10) } } as never;
  assert.deepEqual(ids(candidatesForStation(stations[0], input)).slice(0, 1), ['c']);
  assert.deepEqual(ids(candidatesForStation(stations[0], input)).slice(1), ['b', 'a']);
});

test('retests off (default): a student who failed this skill is not listed; one who never attempted it is', () => {
  const input = { ...base, skillCells: { a_Medical: done('fail', 5) } } as never;
  assert.deepEqual(ids(candidatesForStation(stations[0], input)), ['b', 'c']);
  assert.equal(retestWaitingForStation(stations[0], input), 1);
});

test('retests on: failed student listed, same-proctor retake last, retake station prefers retakes', () => {
  const input = { ...base, skillCells: { a_Medical: { ...done('fail', 5), evalSummary: { evaluatorName: 'Pat' } } } } as never;
  const on = { includeRetests: true };
  assert.deepEqual(ids(candidatesForStation(stations[0], input, on)), ['b', 'c', 'a']); // m1 proctor Pat graded first attempt
  assert.equal(candidatesForStation(stations[1], input, on)[0].student.id, 'b'); // other proctor: fewer finished first
  const retakeStation = { ...stations[1], isRetakeStation: true };
  assert.equal(candidatesForStation(retakeStation, input, on)[0].student.id, 'a');
});

test('retests off, nobody left for a first attempt, two failed: the count reports 2', () => {
  const input = {
    ...base,
    students: [students[0], students[1]],
    skillCells: { a_Medical: done('fail', 5), b_Medical: done('fail', 6) },
  } as never;
  assert.deepEqual(candidatesForStation(stations[0], input), []);
  assert.equal(retestWaitingForStation(stations[0], input), 2);
});

test('two free cards never suggest the same student under the fair order', () => {
  const input = { ...mkSpread(['Zed', 'Amy', 'Bo']), skillCells: { st1_x: done('pass', 1) } } as never;
  const r = spreadSuggestions(spreadStations, input);
  const tops = r.map((x) => x.top?.student.id);
  assert.equal(new Set(tops).size, tops.length);
});
