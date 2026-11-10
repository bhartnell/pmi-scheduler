import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearFuturePlacements, todayPhoenix, type FuturePlan } from '../lib/withdraw-future.ts';

function fakeSupabase(opts: { archiveFails?: boolean }) {
  const log: string[] = [];
  const client: any = {
    from(table: string) {
      return {
        insert: async (rows: any[]) => {
          log.push(`insert:${table}:${rows.length}`);
          return { error: opts.archiveFails ? { message: 'no table' } : null };
        },
        delete: () => ({ eq: async (_c: string, id: string) => { log.push(`delete:${table}:${id}`); return { error: null }; } }),
      };
    },
  };
  return { client, log };
}

const plan: FuturePlan = {
  notes: [],
  rows: [
    { table: 'exam_signups', id: 'e1', label: 'Exam signup', date: '2026-12-01', row: { id: 'e1' } },
    { table: 'osce_student_schedule', id: 'o1', label: 'OSCE slot', date: '2026-12-02', row: { id: 'o1' }, googleEventId: 'g1' },
  ],
};

test('archive first, then cancel invite and delete', async () => {
  const { client, log } = fakeSupabase({});
  const cancelled: string[] = [];
  const r = await clearFuturePlacements({ supabase: client, plan, by: 'a@b', reason: null, cancelInvite: async (id) => { cancelled.push(id); return true; } });
  assert.equal(log[0], 'insert:deleted_records_archive:2');
  assert.equal(r.cleared.length, 2);
  assert.deepEqual(cancelled, ['g1']);
  assert.equal(r.invites_cancelled, 1);
});

test('archive failure removes nothing and cancels nothing', async () => {
  const { client, log } = fakeSupabase({ archiveFails: true });
  const r = await clearFuturePlacements({ supabase: client, plan, by: 'a@b', reason: null, cancelInvite: async () => { throw new Error('must not run'); } });
  assert.equal(r.cleared.length, 0);
  assert.equal(log.filter((l) => l.startsWith('delete')).length, 0);
  assert.equal(r.failed.length, 1);
});

test('empty plan is a no-op', async () => {
  const { client, log } = fakeSupabase({});
  const r = await clearFuturePlacements({ supabase: client, plan: { rows: [], notes: [] }, by: 'x', reason: null });
  assert.equal(log.length, 0);
  assert.equal(r.batch_id, null);
});

test('todayPhoenix is a YYYY-MM-DD string', () => {
  assert.match(todayPhoenix(new Date('2026-11-10T20:00:00Z')), /^2026-11-10$/);
});
