import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canViewAllScoreSheets } from '../lib/permissions.ts';

test('instructor-level roles and above get the staff branch', () => {
  for (const r of ['superadmin', 'admin', 'lead_instructor', 'instructor', 'volunteer_instructor']) {
    assert.equal(canViewAllScoreSheets(r), true, r);
  }
});
test('students and non-instructor roles do not', () => {
  for (const r of ['student', 'guest', 'pending', 'program_director', 'agency_observer', '', null, undefined, 'bogus']) {
    assert.equal(canViewAllScoreSheets(r as string), false, String(r));
  }
});
