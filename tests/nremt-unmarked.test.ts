import test from 'node:test';
import assert from 'node:assert/strict';
import { unmarkedSteps } from '../lib/nremt-unmarked.ts';

const simple = (n: number) => ({ step_number: n, instruction: `step ${n}`, sub_items: null });
const subbed = (n: number) => ({ step_number: n, instruction: `step ${n}`, sub_items: [{}, {}, {}] });

test('simple step with no mark counts as unmarked', () => {
  assert.deepEqual(unmarkedSteps([simple(1)], {}, {}).map((s) => s.step_number), [1]);
  assert.equal(unmarkedSteps([simple(1)], { 1: null }, {}).length, 1);
});
test('simple step marked X (fail) or check (pass) is not unmarked', () => {
  assert.equal(unmarkedSteps([simple(1)], { 1: 'fail' }, {}).length, 0);
  assert.equal(unmarkedSteps([simple(1)], { 1: 'pass' }, {}).length, 0);
});
test('sub-item step with nothing ticked is unmarked', () => {
  assert.equal(unmarkedSteps([subbed(2)], {}, {}).length, 1);
  assert.equal(unmarkedSteps([subbed(2)], {}, { 2: [false, false, false] }).length, 1);
});
test('sub-item step with one box ticked is not unmarked', () => {
  assert.equal(unmarkedSteps([subbed(2)], {}, { 2: [false, true, false] }).length, 0);
});
