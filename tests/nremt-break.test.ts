import test from 'node:test';
import assert from 'node:assert/strict';
import { cellMenuFor, dayUnits, freeUnitsNow, isRoutable, isCountedOpen, unitBreakState, unitCounts, unitStations, type RtdInput, type RtdStation } from '../lib/nremt-run-the-day.ts';
import { estimateDay } from '../lib/nremt-day-estimate.ts';
import { isOnBreak } from '../lib/nremt-hub-stations.ts';

const mk = (id: string) => ({ id, first_name: id.toUpperCase(), last_name: 'X' });
const NOW = Date.parse('2026-11-25T10:10:00Z');
const START = Date.parse('2026-11-25T09:00:00-08:00');
type S = NonNullable<RtdStation['coordinatorStatus']>;
const input = (med: S = 'open', b5: S = 'open', o6: S = 'open', students = 3): RtdInput => ({
  students: Array.from({ length: students }, (_, i) => mk('s' + i)),
  stations: [
    { id: 'med', station_number: 1, skill_name: 'Medical', proctorName: 'Pat', coordinatorStatus: med },
    { id: 'b5', station_number: 5, skill_name: 'BVM', proctorName: 'Schafer', room: 'Closet', coordinatorStatus: b5 },
    { id: 'o6', station_number: 6, skill_name: 'O2 by NRB', proctorName: 'Schafer', room: 'Closet', coordinatorStatus: o6 },
  ],
  skillColumns: [
    { skillName: 'Medical', stationIds: ['med'], nremtCode: 'E202' },
    { skillName: 'BVM', stationIds: ['b5'], nremtCode: 'E203' },
    { skillName: 'O2 by NRB', stationIds: ['o6'], nremtCode: 'E204' },
  ],
  cells: {},
  skillCells: {},
});

test('a station on break is not routable and not in free units; back to open it is', () => {
  const st = input('break').stations[0];
  assert.equal(isRoutable(st), false);
  assert.equal(isCountedOpen(st), true);
  assert.deepEqual(freeUnitsNow(input('break'), NOW, new Set()).units.map((u) => u.key), ['pair-o6']);
  assert.deepEqual(freeUnitsNow(input('open'), NOW, new Set()).units.map((u) => u.key).sort(), ['med', 'pair-o6']);
});

test('pair: both parts on break keeps the pair out of sending; one part on break alone does too', () => {
  assert.deepEqual(freeUnitsNow(input('open', 'break', 'break'), NOW, new Set()).units.map((u) => u.key), ['med']);
  assert.deepEqual(freeUnitsNow(input('open', 'break', 'open'), NOW, new Set()).units.map((u) => u.key), ['med']);
  assert.deepEqual(unitCounts(input('open', 'break', 'open'), NOW, new Set()), { free: 1, total: 1 });
});

test('unitBreakState: closed beats break beats open', () => {
  const pair = dayUnits(input('open', 'break', 'closed')).find((u) => u.kind === 'pair')!;
  assert.equal(unitBreakState(unitStations(pair)), 'closed');
  const p2 = dayUnits(input('open', 'break', 'open')).find((u) => u.kind === 'pair')!;
  assert.equal(unitBreakState(unitStations(p2)), 'break');
  assert.equal(unitBreakState([input().stations[0]]), 'open');
  assert.equal(isOnBreak('break'), true);
  assert.equal(isOnBreak('closed'), false);
});

test('estimate: a line whose only station is on break counts one station, no "No open station"', () => {
  const e = estimateDay(input('break'), { now: NOW, startMs: START, includeBreak: true });
  assert.deepEqual(e.noOpenLines, []);
  const med = e.lines.find((l) => l.title.includes('Medical'))!;
  assert.equal(med.open, 1);
});

test('estimate: a closed-only line still warns', () => {
  const e = estimateDay(input('closed'), { now: NOW, startMs: START, includeBreak: true });
  assert.ok(e.noOpenLines.some((t) => t.includes('Medical')));
});

test('estimate: pair with both parts on break still counts as one station', () => {
  const e = estimateDay(input('open', 'break', 'break'), { now: NOW, startMs: START, includeBreak: true });
  assert.equal(e.lines.find((l) => l.isPair)!.open, 1);
});

test('cell menu: station on break is listed greyed (onBreak), closed is absent, open is selectable', () => {
  const opt = (inp: RtdInput) => cellMenuFor(inp.students[0], 'Medical', inp, NOW).options;
  const br = opt(input('break'));
  assert.equal(br.length, 1);
  assert.equal(br[0].onBreak, true);
  assert.equal(opt(input('closed')).length, 0);
  const op = opt(input('open'));
  assert.equal(op.length, 1);
  assert.equal(op[0].onBreak, false);
  // pair: one part on break lists the pair once, greyed
  const pr = cellMenuFor(input('open', 'break', 'open').students[0], 'BVM', input('open', 'break', 'open'), NOW).options;
  assert.equal(pr.length, 1);
  assert.equal(pr[0].onBreak, true);
});
