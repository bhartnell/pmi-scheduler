import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePalsPractice } from '../lib/pals-practice.ts';

const base = { student_id: 's1', lab_day_id: 'd1', scenario_id: 'c1' };

test('normalises pass / fail casing', () => {
  const a = validatePalsPractice({ ...base, result: 'pass' });
  assert.ok(a.ok && a.value.result === 'PASS');
  const b = validatePalsPractice({ ...base, result: 'Fail' });
  assert.ok(b.ok && b.value.result === 'NR');
});

test('rejects missing ids and unknown result', () => {
  assert.equal(validatePalsPractice({ ...base, student_id: null, result: 'pass' }).ok, false);
  assert.equal(validatePalsPractice({ ...base, lab_day_id: '', result: 'pass' }).ok, false);
  assert.equal(validatePalsPractice({ ...base, scenario_id: null, result: 'pass' }).ok, false);
  assert.equal(validatePalsPractice({ ...base, result: 'watch' }).ok, false);
});

test('watch is tri-state and keeps a trimmed note only when true', () => {
  const w = validatePalsPractice({ ...base, result: 'PASS', watch: true, watch_note: '  slow to shock  ' });
  assert.ok(w.ok && w.value.watch === true && w.value.watch_note === 'slow to shock');
  const n = validatePalsPractice({ ...base, result: 'PASS', watch: false, watch_note: 'ignored' });
  assert.ok(n.ok && n.value.watch === false && n.value.watch_note === null);
  const u = validatePalsPractice({ ...base, result: 'PASS' });
  assert.ok(u.ok && u.value.watch === null);
});

test('NR attempt drops watch; non-boolean watch rejected', () => {
  const r = validatePalsPractice({ ...base, result: 'NR', watch: true, watch_note: 'x' });
  assert.ok(r.ok && r.value.watch === null && r.value.watch_note === null);
  assert.equal(validatePalsPractice({ ...base, result: 'pass', watch: 'yes' as unknown as boolean }).ok, false);
});
