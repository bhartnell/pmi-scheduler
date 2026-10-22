import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStudentHome, type StudentLabDayRow, type StudentLeadRow } from '../lib/student-home.ts';

const lead = (o: Partial<StudentLeadRow> = {}): StudentLeadRow => ({ date: '2026-10-12', title: 'GI bleed', room: 'Lab Bay 1', course: null, phase: null, result: null, ...o });
const day = (o: Partial<StudentLabDayRow> = {}): StudentLabDayRow => ({ date: '2026-11-02', title: 'PALS Certification - Day 1', start_time: '08:30:00', cert_course: 'pals', is_archived: false, ...o });
const TODAY = '2026-10-22';

test('untagged rows count as lab, never guessed into a course', () => {
  const h = buildStudentHome([lead(), lead(), lead({ course: 'ACLS', phase: 'testing', result: 'pass', date: '2026-10-06' })], [], TODAY);
  assert.equal(h.leads.total, 3);
  assert.equal(h.leads.lab, 2);
  assert.equal(h.leads.acls, 1);
  assert.equal(h.leads.pals, 0);
});
test('ACLS passed needs a passing testing row; fail only means needs_retest', () => {
  const pass = buildStudentHome([lead({ course: 'ACLS', phase: 'testing', result: 'pass', date: '2026-10-06' })], [], TODAY);
  assert.deepEqual(pass.acls, { status: 'passed', date: '2026-10-06' });
  const fail = buildStudentHome([lead({ course: 'ACLS', phase: 'testing', result: 'fail' })], [], TODAY);
  assert.equal(fail.acls.status, 'needs_retest');
  assert.equal(fail.leads.graded.needsRep, 1);
});
test('ungraded rows show no pass', () => {
  const h = buildStudentHome([lead()], [], TODAY);
  assert.equal(h.cases[0].result, 'led');
  assert.equal(h.leads.graded.pass, 0);
});
test('PALS coming up from future cert days, archived and past days ignored', () => {
  const h = buildStudentHome([], [day({ date: '2026-11-03', title: 'PALS Certification - Day 2', cert_course: null }), day(), day({ date: '2026-10-01' }), day({ date: '2026-11-09', is_archived: true })], TODAY);
  assert.equal(h.pals.status, 'coming_up');
  assert.equal(h.pals.upcomingStart, '2026-11-02');
  assert.equal(h.pals.upcomingEnd, '2026-11-03');
  assert.equal(h.comingUp.length, 2);
  assert.equal(h.comingUp[1].kind, 'cert');
});
test('one coming-up entry per date; cases newest first', () => {
  const h = buildStudentHome([lead({ date: '2026-10-05' }), lead({ date: '2026-10-12' })], [day({ cert_course: null, title: 'Lab', date: '2026-10-23' }), day({ cert_course: null, title: 'Lab sec 2', date: '2026-10-23' })], TODAY);
  assert.equal(h.comingUp.length, 1);
  assert.equal(h.cases[0].date, '2026-10-12');
  assert.equal(h.leads.lastDate, '2026-10-12');
});
