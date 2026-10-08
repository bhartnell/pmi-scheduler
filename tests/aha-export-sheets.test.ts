import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportRowsFor } from '../lib/reports/aha/exportSheets.ts';

const att = (id: string, result: string, met: number, date: string) => ({
  id, caseCode: 'C', certTier: null, result, chain: ['bradycardia', 'vf', 'asystole'], metCount: met, segments: [], stationDate: date,
});
const row = (attempts: ReturnType<typeof att>[], best: ReturnType<typeof att> | null, flags: string[] = []) => ({
  student: { id: 's1', firstName: 'Test', lastName: 'Synthetic' }, best, variant: null, allAttempts: attempts, flags,
});

test('zero-pass student exports ALL attempt sheets, in date order', () => {
  const a = [att('a2', 'fail', 20, '2026-10-06'), att('a1', 'fail', 15, '2026-10-05')];
  const out = exportRowsFor(row(a, a[0], ['No pass — best fail used for documentation']));
  assert.deepEqual(out.map((r) => r.best?.id), ['a1', 'a2']);
  assert.ok(out.every((r) => r.flags.some((f) => f.includes('No passing attempt'))));
  assert.ok(out.every((r) => !r.flags.some((f) => f.startsWith('No pass —'))));
});

test('student with a pass exports only the best sheet', () => {
  const a = [att('f', 'fail', 10, '2026-10-05'), att('p', 'pass', 30, '2026-10-06')];
  const out = exportRowsFor(row(a, a[1]));
  assert.equal(out.length, 1);
  assert.equal(out[0].best?.id, 'p');
});

test('no attempts and single fail are unchanged', () => {
  assert.equal(exportRowsFor(row([], null)).length, 1);
  const f = att('f', 'fail', 5, '2026-10-05');
  assert.equal(exportRowsFor(row([f], f)).length, 1);
});
