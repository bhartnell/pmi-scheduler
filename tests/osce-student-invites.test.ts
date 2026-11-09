import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSlotTime, resolveOsceStudent, deterministicStudentEventId, buildOsceStudentEventBody, upsertOsceStudentEvent,
} from '../lib/osce-student-invites.ts';

test('slot time follows block start + offset + (slot-1) x length', () => {
  assert.deepEqual(computeSlotTime({ blockStart: '08:30:00', offsetMin: 0, slotNumber: 1, minutesPerStudent: 30 }), { start: '08:30', end: '09:00' });
  assert.deepEqual(computeSlotTime({ blockStart: '13:00:00', offsetMin: 15, slotNumber: 3, minutesPerStudent: 30 }), { start: '14:15', end: '14:45' });
});

const roster = [
  { id: '1', first_name: 'Marshall', last_name: 'Kent', email: 'a@x' },
  { id: '2', first_name: 'A', last_name: 'Smith', email: 's@x' },
  { id: '3', first_name: 'B', last_name: 'Smith', email: 't@x' },
  { id: '4', first_name: 'C', last_name: 'Lee', email: null },
];

test('resolution never guesses between candidates or invents an email', () => {
  assert.equal(resolveOsceStudent('KENT (MARSHALL)', roster).status, 'resolved');
  assert.equal(resolveOsceStudent('SMITH', roster).status, 'unresolved');
  assert.equal(resolveOsceStudent('LEE', roster).status, 'unresolved');
  assert.equal(resolveOsceStudent('NOBODY', roster).status, 'unresolved');
});

test('event body: student is the only guest, no evaluators, arrive-early line', () => {
  const b = buildOsceStudentEventBody({ eventLabel: 'E', blockLabel: 'B', date: '2026-11-12', slot: { start: '08:45', end: '09:15' }, firstName: 'M', lastName: 'K', email: 'a@x' });
  assert.equal(b.attendees.length, 1);
  assert.equal(b.summary, 'Paramedic OSCE - M K');
  assert.match(b.description, /arrive 10 minutes early/);
  assert.equal(b.start.dateTime, '2026-11-12T08:45:00');
});

test('create uses a deterministic id and sendUpdates=all; 409 falls back to update, never a duplicate', async () => {
  const body = buildOsceStudentEventBody({ eventLabel: 'E', blockLabel: 'B', date: '2026-11-12', slot: { start: '08:45', end: '09:15' }, firstName: 'M', lastName: 'K', email: 'a@x' });
  const calls: string[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (init?.method === 'POST') return new Response('exists', { status: 409 });
    return new Response(JSON.stringify({ status: 'confirmed', summary: body.summary, description: body.description, location: body.location, start: body.start, end: body.end }), { status: 200 });
  }) as unknown as typeof fetch;
  const rowId = '9db8de8b-1111-2222-3333-444455556666';
  const r = await upsertOsceStudentEvent({ accessToken: 't', scheduleRowId: rowId, body, fetchImpl });
  assert.equal(r.status, 'unchanged');
  assert.match(calls[0], /POST .*sendUpdates=all/);
  assert.match(calls[1], new RegExp(deterministicStudentEventId(rowId)));
  assert.ok(!calls.some((c) => c.startsWith('PATCH')));
});
