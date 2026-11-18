import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isScenarioLetter, scenarioSolidColor, scenarioSoftColor, caseLabel, caseLabelFrom, buildCaseNames, sortCases } from '../lib/osce-scenario-letters.ts';

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

test('caseLabel: name present, null, empty or blank', () => {
  assert.equal(caseLabel('G', 'Asthma'), 'Asthma');
  assert.equal(caseLabel('G', ' Asthma '), 'Asthma');
  assert.equal(caseLabel('G', null), 'G');
  assert.equal(caseLabel('G', undefined), 'G');
  assert.equal(caseLabel('G', ''), 'G');
  assert.equal(caseLabel('G', '   '), 'G');
  assert.equal(caseLabel(null, null), '');
});
test('caseLabelFrom / buildCaseNames fall back to the letter', () => {
  const names = buildCaseNames([{ scenario_letter: 'D', short_name: 'CHF' }, { scenario_letter: 'C', short_name: null }, { scenario_letter: 'E', short_name: '' }]);
  assert.deepEqual(names, { D: 'CHF' });
  assert.equal(caseLabelFrom('D', names), 'CHF');
  assert.equal(caseLabelFrom('C', names), 'C');
  assert.equal(caseLabelFrom('D', null), 'D');
  assert.equal(buildCaseNames(null).A, undefined);
});
test('sortCases: active first, then name A-Z, letter when unnamed', () => {
  const rows = [
    { scenario_letter: 'I', short_name: 'Bradycardia', is_active: true },
    { scenario_letter: 'G', short_name: 'Asthma', is_active: true },
    { scenario_letter: 'C', short_name: null, is_active: false },
    { scenario_letter: 'D', short_name: 'CHF', is_active: true },
  ];
  assert.deepEqual(sortCases(rows).map(r => r.scenario_letter), ['G', 'I', 'D', 'C']);
});
