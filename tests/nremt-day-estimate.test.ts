import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateDay, formatAbout, formatClock, cardLine, lineForStation } from '../lib/nremt-day-estimate.ts';
import type { RtdInput, RtdCell, RtdStation } from '../lib/nremt-run-the-day.ts';

const SKILLS = [
  { code: 'E215', name: 'Cardiac Arrest Management / AED' },
  { code: 'E202', name: 'Patient Assessment - Medical' },
  { code: 'E201', name: 'Patient Assessment - Trauma' },
  { code: 'E212', name: 'Spinal Immobilization (Supine Patient)' },
  { code: 'E204', name: 'Oxygen Administration by Non-Rebreather Mask' },
  { code: 'E203', name: 'BVM Ventilation of an Apneic Adult Patient' },
  { code: 'E213', name: 'Bleeding Control/Shock Management' },
];

function day(n = 16, extra: { code: string; status?: RtdStation['coordinatorStatus'] }[] = []): RtdInput {
  const students = Array.from({ length: n }, (_, i) => ({ id: `s${i}`, first_name: `F${i}`, last_name: `L${i}` }));
  const stations: RtdStation[] = SKILLS.map((k, i) => ({
    id: `st-${k.code}`, station_number: i + 1, skill_name: k.name, proctorName: k.code === 'E213' ? 'Casey' : 'P' + i,
    room: 'R' + i, coordinatorStatus: 'open',
  }));
  extra.forEach((e, i) => stations.push({ id: `x-${e.code}-${i}`, station_number: 20 + i, skill_name: SKILLS.find((k) => k.code === e.code)!.name, proctorName: 'X' + i, coordinatorStatus: e.status || 'open' }));
  const skillColumns = SKILLS.map((k) => ({
    skillName: k.name, nremtCode: k.code,
    stationIds: stations.filter((s) => s.skill_name === k.name).map((s) => s.id),
  }));
  return { students, stations, cells: {}, skillColumns, skillCells: {} };
}
const START = Date.parse('2026-11-25T09:00:00-08:00');
const BEFORE = Date.parse('2026-11-25T08:00:00-08:00');
const at = (iso: string) => Date.parse(iso);

test('Nov 25 check figures: 16 students, one station per line, breaks on', () => {
  const e = estimateDay(day(), { now: BEFORE, startMs: START, includeBreak: true });
  const m = (t: string) => e.lines.find((l) => l.title.includes(t))!.minutesWithBreak;
  assert.equal(m('Trauma'), 318);
  assert.equal(m('Medical'), 302);
  assert.equal(m('spinal'), 222);
  assert.equal(e.lines.find((l) => l.isPair)!.minutesWithBreak, 214);
  assert.equal(m('Cardiac'), 206);
  assert.equal(m('Bleeding'), 158);
  assert.equal(e.testingLeftMin, 318);
  assert.equal(e.fromStart, true);
  assert.equal(formatClock(e.finishMs!), '2:20 PM');
  assert.match(e.settingBy!, /slowest: .*Trauma.*16 left, 1 station/);
  assert.equal(e.source, 'past');
  assert.equal(formatAbout(318), 'about 5 h 20 min');
});

test('second Trauma and Medical open: day becomes Supine spinal 3 h 42, 12:42 PM', () => {
  const e = estimateDay(day(16, [{ code: 'E201' }, { code: 'E202' }]), { now: BEFORE, startMs: START, includeBreak: true });
  assert.equal(e.lines.find((l) => l.title.includes('Trauma'))!.minutesWithBreak, 174);
  assert.equal(e.lines.find((l) => l.title.includes('Medical'))!.minutesWithBreak, 166);
  assert.equal(e.testingLeftMin, 222);
  assert.equal(formatClock(e.finishMs!), '12:40 PM'); // 12:42 rounded to 5 minutes
  assert.equal(e.secondStationHint, null); // two open already
});

test('second-station hint on the slowest line', () => {
  const e = estimateDay(day(), { now: BEFORE, startMs: START, includeBreak: true });
  // Trauma 318 vs next 302: only 16 min apart, no hint
  assert.equal(e.secondStationHint, null);
  const d = day();
  // Medical done for everyone -> Trauma 318 vs next Spinal 222 (96 min apart)
  for (const s of d.students) d.skillCells[`${s.id}_Patient Assessment - Medical`] = { status: 'completed', result: 'pass' };
  const e2 = estimateDay(d, { now: BEFORE, startMs: START, includeBreak: true });
  assert.match(e2.secondStationHint!, /a second Trauma station would bring this to 12:4\d PM/);
});

test('break box off removes 30 minutes per line', () => {
  const e = estimateDay(day(), { now: BEFORE, startMs: START, includeBreak: false });
  assert.equal(e.testingLeftMin, 288);
});

test('pass steps it down; fail with retake still counts left; en route does not', () => {
  const d = day();
  d.skillCells['s0_Patient Assessment - Trauma'] = { status: 'completed', result: 'pass' };
  d.skillCells['s1_Patient Assessment - Trauma'] = { status: 'completed', result: 'fail' };
  d.cells['s2_st-E201'] = { status: 'queued' } as RtdCell;
  const e = estimateDay(d, { now: BEFORE, startMs: START, includeBreak: false });
  const t = e.lines.find((l) => l.title.includes('Trauma'))!;
  assert.equal(t.left, 15);
  assert.equal(t.retests, 1);
  assert.equal(t.minutes, 15 * 18);
  assert.match(cardLine(t), /15 left - about 4 h 30 min \(1 retest\)/);
});

test("pace replaces typical at 3 finished attempts", () => {
  const d = day();
  const t0 = '2026-11-25T09:00:00-08:00';
  for (let i = 0; i < 3; i++) {
    d.cells[`s${i}_st-E201`] = { status: 'completed', result: 'pass', startedAt: t0, completedAt: '2026-11-25T09:10:00-08:00' } as RtdCell;
    d.skillCells[`s${i}_Patient Assessment - Trauma`] = { status: 'completed', result: 'pass' };
  }
  const e = estimateDay(d, { now: at('2026-11-25T09:30:00-08:00'), startMs: START, includeBreak: false });
  const t = e.lines.find((l) => l.title.includes('Trauma'))!;
  assert.equal(t.perVisit, 15); // 10 real + 5 walk
  assert.equal(t.minutes, 13 * 15);
  assert.equal(e.source, 'pace');
});

test('only two finished attempts: still the typical figure', () => {
  const d = day();
  for (let i = 0; i < 2; i++) {
    d.cells[`s${i}_st-E201`] = { status: 'completed', result: 'pass', startedAt: '2026-11-25T09:00:00-08:00', completedAt: '2026-11-25T09:05:00-08:00' } as RtdCell;
    d.skillCells[`s${i}_Patient Assessment - Trauma`] = { status: 'completed', result: 'pass' };
  }
  const t = estimateDay(d, { now: START, startMs: START, includeBreak: false }).lines.find((l) => l.title.includes('Trauma'))!;
  assert.equal(t.perVisit, 18);
});

test('pair: student owing one part counts only that part', () => {
  const d = day(2);
  d.skillCells['s0_Oxygen Administration by Non-Rebreather Mask'] = { status: 'completed', result: 'pass' };
  const p = estimateDay(d, { now: BEFORE, startMs: START, includeBreak: false }).lines.find((l) => l.isPair)!;
  assert.equal(p.left, 2);
  assert.equal(p.minutes, (4 + 5) + (4 + 2.5 + 5));
});

test('no open station on a line with students left', () => {
  const d = day(4);
  d.stations.find((s) => s.id === 'st-E202')!.coordinatorStatus = 'closed';
  const e = estimateDay(d, { now: BEFORE, startMs: START, includeBreak: true });
  const m = e.lines.find((l) => l.title.includes('Medical'))!;
  assert.equal(m.open, 0);
  assert.equal(m.minutes, null);
  assert.deepEqual(e.noOpenLines, ['Medical']);
  assert.match(cardLine(m), /4 left - no open station/);
});

test('all stations done', () => {
  const d = day(2);
  for (const s of d.students) for (const k of SKILLS) d.skillCells[`${s.id}_${k.name}`] = { status: 'completed', result: 'pass' };
  const e = estimateDay(d, { now: START, startMs: START, includeBreak: true });
  assert.equal(e.allDone, true);
  assert.equal(e.finishMs, null);
});

test('student floor larger than every line: waiting on', () => {
  const d = day(3);
  // everyone passed everything except s0 who owes all six visits; lines are short (1 student each)
  for (const s of d.students.slice(1)) for (const k of SKILLS) d.skillCells[`${s.id}_${k.name}`] = { status: 'completed', result: 'pass' };
  const e = estimateDay(d, { now: START, startMs: START, includeBreak: false });
  assert.equal(e.floorSetsDay, true);
  assert.match(e.settingBy!, /waiting on: 1 student who still owes 6 skills/);
  assert.equal(e.testingLeftMin, 18 + 17 + 12 + 11.5 + 11 + 8);
});

test('a finished line with its station open: proctor is free', () => {
  const d = day(4);
  for (const s of d.students) d.skillCells[`${s.id}_Bleeding Control/Shock Management`] = { status: 'completed', result: 'pass' };
  const e = estimateDay(d, { now: START, startMs: START, includeBreak: true });
  assert.equal(e.doneHints.length, 1);
  assert.match(e.doneHints[0], /^Bleeding \/ shock is done - Casey is free\. Longest line now: Trauma \(4 left\)$/);
});

test('credit for students in progress lowers the finish clock, not testing left', () => {
  const d = day(16);
  d.cells['s0_st-E201'] = { status: 'in_progress', startedAt: '2026-11-25T09:00:00-08:00' } as RtdCell;
  const now = at('2026-11-25T09:10:00-08:00');
  const a = estimateDay(d, { now, startMs: START, includeBreak: true });
  const b = estimateDay(day(16), { now, startMs: START, includeBreak: true });
  assert.equal(a.testingLeftMin, b.testingLeftMin);
  assert.equal(b.finishMs! - a.finishMs!, 10 * 60000);
  assert.equal(lineForStation(a, 'st-E201')!.left, 16);
});
