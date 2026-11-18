import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isScenarioLetter, scenarioSolidColor, scenarioSoftColor } from '../lib/osce-scenario-letters.ts';

test('accepts any single capital letter, including G-J', () => {
  for (const l of ['A', 'F', 'G', 'H', 'I', 'J', 'Z']) assert.equal(isScenarioLetter(l), true);
});
test('rejects lowercase, multi-char, empty, non-strings', () => {
  for (const l of ['a', 'AB', '', '1', ' G', null, undefined, 7]) assert.equal(isScenarioLetter(l), false);
});
test('G-J have distinct colours; unknown letters fall back', () => {
  const solid = ['G', 'H', 'I', 'J'].map(scenarioSolidColor);
  assert.equal(new Set(solid).size, 4);
  assert.equal(scenarioSolidColor('Q'), 'bg-slate-500');
  assert.equal(scenarioSolidColor(undefined), 'bg-slate-500');
  assert.ok(scenarioSoftColor('Q').includes('slate'));
});
