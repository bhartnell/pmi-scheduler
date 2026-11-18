import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEventAcceptingEvaluators } from '../lib/osce-event-pin.ts';

const fall = { status: 'open', start_date: '2026-11-12', end_date: '2026-11-19' };
const spring = { status: 'open', start_date: '2026-04-09', end_date: '2026-04-16' };

test('closed event inside its window is active (matches validate-pin)', () => {
  assert.equal(isEventAcceptingEvaluators({ ...fall, status: 'closed' }, '2026-11-13'), true);
});
test('open event outside its window (Spring today) is inactive', () => {
  assert.equal(isEventAcceptingEvaluators(spring, '2026-11-13'), false);
});
test('open event inside window is active; edge days start-1 and end+1 count', () => {
  assert.equal(isEventAcceptingEvaluators(fall, '2026-11-13'), true);
  assert.equal(isEventAcceptingEvaluators(fall, '2026-11-11'), true);
  assert.equal(isEventAcceptingEvaluators(fall, '2026-11-20'), true);
  assert.equal(isEventAcceptingEvaluators(fall, '2026-11-21'), false);
});
test('missing event is inactive; draft/archived status is inactive', () => {
  assert.equal(isEventAcceptingEvaluators(null, '2026-11-13'), false);
  assert.equal(isEventAcceptingEvaluators({ ...fall, status: 'draft' }, '2026-11-13'), false);
});
