import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findInstructionEntry,
  findInstructionEntryByCode,
  resolveInstructionEntry,
} from '../lib/nremt-instructions.ts';

const CODES: Array<[string, string, number]> = [
  ['E201', 'Patient Assessment - Trauma', 10],
  ['E202', 'Patient Assessment - Medical', 15],
  ['E203', 'BVM Ventilation of an Apneic Adult Patient', 5],
  ['E204', 'Oxygen Administration by Non-Rebreather Mask', 5],
  ['E211', 'Spinal Immobilization (Seated Patient)', 10],
  ['E212', 'Spinal Immobilization (Supine Patient)', 10],
  ['E213', 'Bleeding Control/Shock Management', 10],
  ['E215', 'Cardiac Arrest Management / AED', 10],
  ['E216', 'Joint Immobilization', 5],
  ['E217', 'Long Bone Immobilization', 5],
];

test('each NREMT code returns its own entry and time limit', () => {
  for (const [code, skill, mins] of CODES) {
    const e = findInstructionEntryByCode(code);
    assert.equal(e?.skillName, skill, code);
    assert.equal(e?.timeLimitMinutes, mins, code);
  }
  assert.equal(findInstructionEntryByCode('E999'), null);
  assert.equal(findInstructionEntryByCode(null), null);
});

test('real Nov 25 station names resolve to the right skill', () => {
  const cases: Array<[string, string]> = [
    ['Patient Assessment — Medical', 'Patient Assessment - Medical'],
    ['Patient Assessment — Medical 2', 'Patient Assessment - Medical'],
    ['Patient Assessment - Medical', 'Patient Assessment - Medical'],
    ['Trauma', 'Patient Assessment - Trauma'],
    ['Trauma 2', 'Patient Assessment - Trauma'],
    ['Trauma 3', 'Patient Assessment - Trauma'],
    ['Medical 2', 'Patient Assessment - Medical'],
    ['Patient Assessment — Trauma 2', 'Patient Assessment - Trauma'],
    ['Patient Assessment — Trauma 3', 'Patient Assessment - Trauma'],
    ['Cardiac Arrest/AED', 'Cardiac Arrest Management / AED'],
    ['Cardiac Arrest/AED 2', 'Cardiac Arrest Management / AED'],
    ['Cardiac Arrest/AED 3', 'Cardiac Arrest Management / AED'],
    ['BVM of Adult Apneic Patient (2)', 'BVM Ventilation of an Apneic Adult Patient'],
    ['O2 Administration by NRB (2)', 'Oxygen Administration by Non-Rebreather Mask'],
    ['Supine Spinal Immobilization', 'Spinal Immobilization (Supine Patient)'],
    ['Bleeding Control / Shock Management', 'Bleeding Control/Shock Management'],
  ];
  for (const [name, skill] of cases) {
    assert.equal(findInstructionEntry(name)?.skillName, skill, name);
  }
});

test('Medical never returns Trauma and the reverse', () => {
  for (const n of ['Patient Assessment — Medical', 'Medical 2', 'Patient Assessment - Medical']) {
    assert.notEqual(findInstructionEntry(n)?.skillName, 'Patient Assessment - Trauma', n);
  }
  for (const n of ['Trauma', 'Trauma 2', 'Patient Assessment — Trauma 3']) {
    assert.notEqual(findInstructionEntry(n)?.skillName, 'Patient Assessment - Medical', n);
  }
});

test('a name that matches two entries equally returns null', () => {
  assert.equal(findInstructionEntry('Patient Assessment'), null);
  assert.equal(findInstructionEntry('Spinal Immobilization'), null);
  assert.equal(findInstructionEntry(''), null);
});

test('code wins over a conflicting name', () => {
  const e = resolveInstructionEntry('Patient Assessment — Trauma', 'E202');
  assert.equal(e?.skillName, 'Patient Assessment - Medical');
  assert.equal(e?.timeLimitMinutes, 15);
  // no code: name is the fallback
  assert.equal(resolveInstructionEntry('Trauma', null)?.timeLimitMinutes, 10);
});
