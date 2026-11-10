import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDayTabs, pickActiveDay, groupDayAssessments, formatDayDate } from '../lib/osce-dashboard.ts';

const blocks = [
  { id: 'pm', day_number: 1, label: 'Afternoon', date: '2026-11-12', start_time: '13:00:00', end_time: '16:00:00', sort_order: 2 },
  { id: 'am', day_number: 1, label: 'Morning', date: '2026-11-12', start_time: '08:30:00', end_time: '12:00:00', sort_order: 1 },
  { id: 'd2', day_number: 2, label: 'Morning', date: '2026-11-19', start_time: '08:30:00', end_time: '12:00:00', sort_order: 1 },
];
const mk = (id: string, name: string, slot: number, day = 1) => ({ id, student_name: name, slot_number: slot, day_number: day, assessment_date: day === 1 ? '2026-11-12' : '2026-11-19' });
const roster = [
  { student_name: 'KENT', time_block_id: 'am', slot_number: 1 },
  { student_name: 'LEE', time_block_id: 'am', slot_number: 2 },
  { student_name: 'ORTIZ', time_block_id: 'pm', slot_number: 1 },
];

test('day tabs come from blocks', () => {
  const tabs = buildDayTabs(blocks, []);
  assert.deepEqual(tabs.map((t) => t.label), ['Day 1 - Thu Nov 12', 'Day 2 - Thu Nov 19']);
  assert.equal(formatDayDate('2026-03-30'), 'Mon Mar 30');
});
test('active day: today, else next upcoming', () => {
  const tabs = buildDayTabs(blocks, []);
  assert.equal(pickActiveDay(tabs, '2026-11-19'), 2);
  assert.equal(pickActiveDay(tabs, '2026-11-10'), 1);
  assert.equal(pickActiveDay(tabs, '2026-11-15'), 2);
  assert.equal(pickActiveDay(tabs, '2026-12-01'), 2);
});
test('morning before afternoon, then slot, with start times', () => {
  const a = [mk('3', 'ORTIZ', 1), mk('2', 'LEE', 2), mk('1', 'KENT', 1)];
  const g = groupDayAssessments(1, a, roster, blocks, { minutes_per_student: 30, first_slot_offset_min: 0 });
  assert.deepEqual(g.map((x) => x.blockLabel), ['Morning', 'Afternoon']);
  assert.deepEqual(g[0].items.map((i) => [i.assessment.student_name, i.startTime]), [['KENT', '8:30 AM'], ['LEE', '9:00 AM']]);
  assert.equal(g[1].items[0].startTime, '1:00 PM');
});
test('no offset chosen means no time; unmatched go last', () => {
  const g = groupDayAssessments(1, [mk('9', 'NOBODY', 5), mk('1', 'kent ', 1)], roster, blocks, { minutes_per_student: 30, first_slot_offset_min: null });
  assert.equal(g[0].items[0].startTime, null);
  assert.equal(g[1].blockId, null);
});
