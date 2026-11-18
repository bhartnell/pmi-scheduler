import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canViewOsceCases } from '../lib/osce-scenario-access.ts';

test('staff roles can view OSCE cases', () => {
  for (const r of ['superadmin', 'admin', 'lead_instructor', 'instructor', 'agency_liaison', 'volunteer_instructor']) {
    assert.equal(canViewOsceCases(r), true, r);
  }
});

test('student, guest, observer, program director, pending, unknown and empty are refused', () => {
  for (const r of ['student', 'guest', 'agency_observer', 'program_director', 'pending', 'nonsense', '', null, undefined]) {
    assert.equal(canViewOsceCases(r as string | null | undefined), false, String(r));
  }
});
