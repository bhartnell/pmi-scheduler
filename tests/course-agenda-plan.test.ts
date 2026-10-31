import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  planAgendaDay, labDayForSection, addMinutes, agendaTag,
  type AgendaLine, type AgendaLabDay,
} from '../lib/course-agenda-plan.ts';

const line = (over: Partial<AgendaLine>): AgendaLine => ({
  line_key: 'k', day_index: 1, sort_order: 10, start_time: '08:30:00', duration_minutes: 5,
  label: 'Course Introduction', line_type: 'lecture', section_key: null, ...over,
});
const sectionA: AgendaLabDay = {
  id: 'ld-a', section_number: 2, section_label: 'Section A — Learning Stations',
  start_time: '14:45:00', end_time: '16:05:00',
};
const lines: AgendaLine[] = [
  line({ line_key: 'd1-intro', sort_order: 10 }),
  line({ line_key: 'd1-lunch', sort_order: 20, start_time: '12:00', duration_minutes: 60, label: 'Lunch', line_type: 'lunch' }),
  line({ line_key: 'd1-sectiona', sort_order: 30, start_time: '14:45', duration_minutes: 60, label: 'Section A — Learning Stations', line_type: 'lab', section_key: 'A' }),
  line({ line_key: 'd1-sectionb', sort_order: 40, start_time: '15:50', duration_minutes: 100, label: 'Section B — Case Scenario Practice', line_type: 'lab', section_key: 'B' }),
  line({ line_key: 'd1-end', sort_order: 50, start_time: '17:30', duration_minutes: 0, label: 'End of Day 1' }),
];

test('addMinutes rolls hours', () => assert.equal(addMinutes('08:55', 10), '09:05'));

test('labDayForSection matches the Section letter in the label', () => {
  assert.equal(labDayForSection([sectionA], 'A')?.id, 'ld-a');
  assert.equal(labDayForSection([sectionA], 'B'), undefined);
});

test('section blocks take the lab_days times and link, not the template times', () => {
  const { blocks } = planAgendaDay({ course: 'pals', date: '2026-11-02', lines, labDays: [sectionA], existingTags: new Set() });
  const a = blocks.find((b) => b.line_key === 'd1-sectiona')!;
  assert.equal(a.start_time, '14:45');
  assert.equal(a.end_time, '16:05');
  assert.equal(a.linked_lab_day_id, 'ld-a');
  assert.equal(a.linked_section_number, 2);
  assert.equal(a.block_type, 'lab');
});

test('missing section is reported, not guessed; end marker writes no block', () => {
  const { blocks, warnings } = planAgendaDay({ course: 'pals', date: '2026-11-02', lines, labDays: [sectionA], existingTags: new Set() });
  assert.ok(!blocks.some((b) => b.line_key === 'd1-sectionb'));
  assert.deepEqual(warnings.map((w) => [w.line_key, w.reason]), [['d1-sectionb', 'missing_section'], ['d1-end', 'zero_duration_marker']]);
});

test('plain lines use template times; titles use hyphen not em dash', () => {
  const { blocks } = planAgendaDay({ course: 'pals', date: '2026-11-02', lines, labDays: [sectionA], existingTags: new Set() });
  const lunch = blocks.find((b) => b.line_key === 'd1-lunch')!;
  assert.equal(lunch.start_time, '12:00');
  assert.equal(lunch.end_time, '13:00');
  assert.equal(lunch.block_type, 'non_instructional');
  const a = blocks.find((b) => b.line_key === 'd1-sectiona')!;
  assert.equal(a.title, 'PALS LAB · Section A - Learning Stations');
  assert.ok(blocks.every((b) => !b.title.includes('—')));
});

test('idempotent: a tagged line already on the date is skipped', () => {
  const { blocks } = planAgendaDay({
    course: 'pals', date: '2026-11-02', lines, labDays: [sectionA],
    existingTags: new Set([agendaTag('pals', 'd1-intro')]),
  });
  assert.equal(blocks.find((b) => b.line_key === 'd1-intro')!.action, 'skip_existing');
  assert.equal(blocks.find((b) => b.line_key === 'd1-lunch')!.action, 'create');
});
