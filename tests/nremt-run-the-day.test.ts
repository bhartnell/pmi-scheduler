import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spreadSuggestions, whyLine, type RtdInput, type RtdStation } from '../lib/nremt-run-the-day.ts';
import { shortSkillLabel, hasShortLabel } from '../lib/nremt-skill-labels.ts';
import { localCalendarDate } from '../lib/nremt-hub-format.ts';

const stations: RtdStation[] = [1, 2, 3].map((n) => ({ id: `s${n}`, station_number: n, skill_name: 'Patient Assessment - Medical' }));
const mk = (names: string[]): RtdInput => ({
  students: names.map((n, i) => ({ id: `st${i}`, first_name: n, last_name: 'X' })),
  stations,
  cells: {},
  skillColumns: [{ skillName: 'Patient Assessment - Medical', stationIds: ['s1', 's2', 's3'], nremtCode: 'E202' }],
  skillCells: {},
});

test('each free card gets a different suggested student', () => {
  const r = spreadSuggestions(stations, mk(['Adrian', 'Amairani', 'Bo']));
  assert.deepEqual(r.map((x) => x.top?.student.first_name), ['Adrian', 'Amairani', 'Bo']);
});

test('when nobody is left a card has no suggestion but still lists everyone for Someone else', () => {
  const r = spreadSuggestions(stations, mk(['Adrian', 'Amairani']));
  assert.equal(r[2].top, null);
  assert.equal(r[2].list.length, 2);
  assert.equal(r[0].list.length, 2);
});

test('whyLine uses the short skill label', () => {
  const r = spreadSuggestions(stations, mk(['Adrian']));
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
