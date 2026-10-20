import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  autoSummary, blankEdit, buildCsv, calibration, gapInfo, scenarioScore, summaryPlain, summaryStandalone,
  type SaRecord,
} from '../lib/preinternship-review.ts';

const R1 = 'SECRET-R1-lost control on the interstate';
const R2 = 'SECRET-R2-told to slow down twice';
const rec: SaRecord = {
  name: 'Pat Student', cohort: 'Group 5', email: 'pat@example.com', submittedAt: '2026-10-20T00:00:00.000Z',
  ratings: { lead: 4, judg: 3, crit: 3, pcom: 2, team: 3, fdbk: 3, prof: 3, comp: 2, init: 3, advo: 3 },
  scenarios: { s1: 'A', s2: 'A', s3: 'B', s4: 'D', s5: 'C' },
  reflections: { r1: R1, r2: R2, r3: 'I learn best with a clear plan.' },
  prefs: { learn: 0, feedback: 1, autonomy: 0, challenges: [0, 4] },
};

test('gap labels follow Rae thresholds', () => {
  assert.equal(gapInfo(4, 2).label, 'Self much higher');
  assert.equal(gapInfo(3, 2).label, 'Self slightly higher');
  assert.equal(gapInfo(3, 3).label, 'Aligned');
  assert.equal(gapInfo(2, 3).label, 'Self slightly lower');
  assert.equal(gapInfo(1, 3).label, 'Self much lower');
  assert.equal(gapInfo(3, undefined).label, 'Not rated');
});

test('calibration label uses +/-0.5 mean gap, needs at least one pair', () => {
  assert.equal(calibration(rec, blankEdit()), null);
  const hi = { ...blankEdit(), instr: { lead: 2, judg: 2, crit: 2 } };
  assert.equal(calibration(rec, hi)?.label, 'Rates self higher');
  const lo = { ...blankEdit(), instr: { lead: 4, judg: 4, crit: 4 } };
  assert.equal(calibration(rec, lo)?.label, 'Rates self lower');
  const ok = { ...blankEdit(), instr: { lead: 4, judg: 3, crit: 3 } };
  assert.equal(calibration(rec, ok)?.label, 'Well calibrated');
});

test('scenario score is out of 10 using option scores', () => {
  const sc = scenarioScore(rec);
  assert.equal(sc.max, 10);
  assert.equal(sc.total, 2 + 0 + 2 + 2 + 2); // s2 answer A is a concern (0)
});

test('autoSummary prefers instructor ratings and flags overrated leadership', () => {
  const edit = { ...blankEdit(), instr: { lead: 2 } };
  const s = autoSummary(rec, edit);
  assert.match(s.growth, /Scene leadership/);
  assert.match(s.match, /rates their scene leadership higher/);
  assert.match(s.match, /Self-identified stressors/);
});

test('agency outputs never contain reflections r1 or r2', () => {
  const edit = { ...blankEdit(), instr: { lead: 3 }, summary: { strengths: 'a', growth: 'b', match: 'c', comments: 'd' } };
  for (const out of [summaryStandalone(rec, edit), summaryPlain(rec, edit)]) {
    assert.ok(!out.includes(R1) && !out.includes(R2));
    assert.ok(out.includes('I learn best with a clear plan.'));
  }
  const csv = buildCsv([{ rec, edit }]);
  assert.ok(!csv.includes(R1) && !csv.includes(R2));
});

test('standalone summary escapes html in free text', () => {
  const edit = { ...blankEdit(), summary: { match: '<script>x</script>' } };
  assert.ok(!summaryStandalone(rec, edit).includes('<script>x'));
});

test('csv has a BOM, a header and one row per student, quotes escaped', () => {
  const csv = buildCsv([{ rec: { ...rec, name: 'Q "Quote" S' }, edit: null }, { rec, edit: null }]);
  assert.ok(csv.startsWith('﻿"Name"'));
  assert.equal(csv.split('\r\n').length, 3);
  assert.ok(csv.includes('"Q ""Quote"" S"'));
});
