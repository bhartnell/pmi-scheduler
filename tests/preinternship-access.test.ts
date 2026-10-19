import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AccessError, createPreinternshipService, isPreinternshipInstructor, recordKeyFor,
  type Actor, type ResponseData, type ReviewData, type Store, type StoredResponse,
} from '../lib/preinternship.ts';

function memStore(): Store {
  const responses = new Map<string, StoredResponse & { deleted?: boolean }>();
  const reviews = new Map<string, ReviewData & { userId: string }>();
  return {
    async getResponse(id) { const r = responses.get(id); return r && !r.deleted ? r : null; },
    async upsertResponse(id, cohortId, data) {
      const prior = responses.get(id);
      responses.set(id, { id, cohortId, data, locked: prior && !prior.deleted ? prior.locked : false });
    },
    async listResponses() { return [...responses.values()].filter((r) => !r.deleted); },
    async softDeleteResponse(id) { const r = responses.get(id); if (!r || r.deleted) return false; r.deleted = true; return true; },
    async setLocked(id, locked) { const r = responses.get(id); if (!r || r.deleted) return false; r.locked = locked; return true; },
    async listReviews() { return Object.fromEntries([...reviews].map(([k, v]) => [k, v])); },
    async upsertReview(key, userId, review) { reviews.set(key, { ...review, userId }); },
    async softDeleteReview(key) { return reviews.delete(key); },
  };
}

const student = (id: string): Actor => ({ id, role: 'student', email: `${id}@x.edu`, cohortId: 'c1' });
const instructor: Actor = { id: 'i1', role: 'instructor', name: 'Rae' };
const good = (over: Partial<ResponseData> = {}) => ({
  v: 1, name: 'A', ratings: { lead: 3, judg: 2 }, scenarios: { s1: 'A' },
  reflections: { r1: 'secret one', r2: 'secret two', r3: 'for the agency' }, prefs: {}, ack: true, ...over,
});
const deny = async (p: Promise<unknown>, status: number) =>
  assert.rejects(p, (e: unknown) => e instanceof AccessError && e.status === status);

test('instructor role set excludes students, volunteers and agency roles', () => {
  for (const r of ['superadmin', 'admin', 'lead_instructor', 'instructor']) assert.ok(isPreinternshipInstructor(r), r);
  for (const r of ['student', 'guest', 'pending', 'volunteer_instructor', 'agency_liaison', 'agency_observer', 'program_director', null, undefined])
    assert.ok(!isPreinternshipInstructor(r as string), String(r));
});

test('student A cannot read student B response: reads are keyed by the actor only', async () => {
  const svc = createPreinternshipService(memStore());
  await svc.saveMyResponse(student('A'), good({ name: 'Alice' }));
  assert.equal(await svc.getMyResponse(student('B')), null);
  assert.equal((await svc.getMyResponse(student('A')))?.name, 'Alice');
});

test('student B saving never touches student A', async () => {
  const svc = createPreinternshipService(memStore());
  await svc.saveMyResponse(student('A'), good({ name: 'Alice' }));
  await svc.saveMyResponse(student('B'), good({ name: 'Bob' }));
  assert.equal((await svc.getMyResponse(student('A')))?.name, 'Alice');
});

test('students are denied every instructor-side method', async () => {
  const svc = createPreinternshipService(memStore());
  const s = student('A');
  await svc.saveMyResponse(s, good());
  await deny(svc.listResponses(s), 403);
  await deny(svc.deleteResponse(s, 'A'), 403);
  await deny(svc.unlockResponse(s, 'A'), 403);
  await deny(svc.listReviews(s), 403);
  await deny(svc.saveReview(s, recordKeyFor('A'), { instr: { lead: 3 } }), 403);
  await deny(svc.deleteReview(s, recordKeyFor('A')), 403);
  await deny(svc.getAgencyView(s, 'A'), 403);
});

test('volunteer instructor and agency roles are denied instructor methods', async () => {
  const svc = createPreinternshipService(memStore());
  for (const role of ['volunteer_instructor', 'agency_liaison', 'agency_observer']) {
    await deny(svc.listResponses({ id: 'x', role }), 403);
    await deny(svc.listReviews({ id: 'x', role }), 403);
  }
});

test('instructors cannot use the student own-response methods', async () => {
  const svc = createPreinternshipService(memStore());
  await deny(svc.saveMyResponse(instructor, good()), 403);
  await deny(svc.getMyResponse(instructor), 403);
});

test('instructor reads all responses and writes reviews', async () => {
  const svc = createPreinternshipService(memStore());
  await svc.saveMyResponse(student('A'), good());
  await svc.saveMyResponse(student('B'), good());
  assert.equal((await svc.listResponses(instructor)).length, 2);
  await svc.saveReview(instructor, recordKeyFor('A'), { instr: { lead: 4 } });
  const reviews = await svc.listReviews(instructor);
  assert.deepEqual(Object.keys(reviews), ['r-A']);
  assert.equal(reviews['r-A'].preparedBy, 'Rae');
});

test('review for a nonexistent response is rejected', async () => {
  const svc = createPreinternshipService(memStore());
  await deny(svc.saveReview(instructor, 'r-nobody', { instr: { lead: 3 } }), 404);
  await deny(svc.saveReview(instructor, 'bad-key', { instr: { lead: 3 } }), 400);
});

test('response locks once reviewed; student edit refused until instructor unlocks', async () => {
  const svc = createPreinternshipService(memStore());
  await svc.saveMyResponse(student('A'), good({ name: 'v1' }));
  await svc.saveReview(instructor, recordKeyFor('A'), { instr: { lead: 3 } });
  await deny(svc.saveMyResponse(student('A'), good({ name: 'v2' })), 423);
  assert.equal((await svc.getMyResponse(student('A')))?.name, 'v1');
  await svc.unlockResponse(instructor, 'A');
  await svc.saveMyResponse(student('A'), good({ name: 'v2' }));
  assert.equal((await svc.getMyResponse(student('A')))?.name, 'v2');
});

test('agency view strips reflections r1 and r2 and keeps r3', async () => {
  const svc = createPreinternshipService(memStore());
  await svc.saveMyResponse(student('A'), good());
  const v = await svc.getAgencyView(instructor, 'A');
  assert.deepEqual(v.response.reflections, { r3: 'for the agency' });
  assert.ok(!JSON.stringify(v).includes('secret'));
});

test('agency view with no r3 carries no reflections at all', async () => {
  const svc = createPreinternshipService(memStore());
  await svc.saveMyResponse(student('A'), good({ reflections: { r1: 'secret one', r2: 'secret two' } }));
  const v = await svc.getAgencyView(instructor, 'A');
  assert.deepEqual(v.response.reflections, {});
});

test('submission validation: ack required, bad ids and values refused, server sets timestamp', async () => {
  const svc = createPreinternshipService(memStore());
  await deny(svc.saveMyResponse(student('A'), good({ ack: false })), 400);
  await deny(svc.saveMyResponse(student('A'), good({ ratings: { lead: 9 } })), 400);
  await deny(svc.saveMyResponse(student('A'), good({ ratings: { bogus: 2 } })), 400);
  await deny(svc.saveMyResponse(student('A'), good({ scenarios: { s1: 'Z' } })), 400);
  await deny(svc.saveMyResponse(student('A'), null), 400);
  await svc.saveMyResponse(student('A'), { ...good(), submittedAt: '1999-01-01T00:00:00Z' });
  assert.notEqual((await svc.getMyResponse(student('A')))?.submittedAt, '1999-01-01T00:00:00Z');
});

test('deleted response disappears from lists and cannot be reviewed', async () => {
  const svc = createPreinternshipService(memStore());
  await svc.saveMyResponse(student('A'), good());
  await svc.deleteResponse(instructor, 'A');
  assert.equal((await svc.listResponses(instructor)).length, 0);
  await deny(svc.saveReview(instructor, recordKeyFor('A'), { instr: { lead: 3 } }), 404);
  await deny(svc.deleteResponse(instructor, 'A'), 404);
});
