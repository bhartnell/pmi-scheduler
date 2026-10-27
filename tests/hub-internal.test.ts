import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hubCourseOf, hubUrlFor, isAgendaBlock, isHubInternalLabDay } from '../lib/hub-internal.ts';

test('only ACLS and PALS section lab days are hub-internal', () => {
  assert.equal(isHubInternalLabDay({ cert_course: 'pals' }), true);
  assert.equal(isHubInternalLabDay({ cert_course: 'ACLS' }), true);
  assert.equal(isHubInternalLabDay({ cert_course: null }), false);
  assert.equal(isHubInternalLabDay({}), false);
  assert.equal(hubCourseOf('bls'), null);
});

test('agenda blocks are recognised by their tag, the umbrella block is not', () => {
  assert.equal(isAgendaBlock('agenda-line:pals:d1-l1'), true);
  assert.equal(isAgendaBlock('DRAFT special-date placeholder'), false);
  assert.equal(isAgendaBlock(null), false);
});

test('hub urls carry cohort and day and never a lab day page', () => {
  assert.equal(hubUrlFor('pals', 'c1', '2026-11-02'), '/labs/pals-hub?cohortId=c1&date=2026-11-02');
  assert.equal(hubUrlFor('acls', null, '2026-11-02'), '/labs/acls-hub/board?date=2026-11-02');
});
