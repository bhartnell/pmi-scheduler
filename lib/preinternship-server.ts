// Server glue for the Pre-Internship Self-Assessment API routes: resolves the
// signed-in actor, builds the Supabase-backed store, maps errors to responses.
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  AccessError, createPreinternshipService,
  type Actor, type ResponseData, type ReviewData, type Store, type StoredResponse,
} from '@/lib/preinternship';

type Row = {
  user_id: string; cohort_id: string | null; locked: boolean; v: number;
  name: string | null; cohort: string | null; email: string | null;
  ratings: Record<string, number>; scenarios: Record<string, string>;
  reflections: Record<string, string>; prefs: Record<string, unknown>;
  ack: boolean; submitted_at: string | null;
};
const COLS = 'user_id, cohort_id, locked, v, name, cohort, email, ratings, scenarios, reflections, prefs, ack, submitted_at';

const toStored = (r: Row): StoredResponse => ({
  id: r.user_id, cohortId: r.cohort_id, locked: r.locked,
  data: {
    v: r.v, name: r.name ?? undefined, cohort: r.cohort ?? undefined, email: r.email ?? undefined,
    ratings: r.ratings, scenarios: r.scenarios, reflections: r.reflections, prefs: r.prefs,
    ack: r.ack, submittedAt: r.submitted_at ?? undefined, source: 'form',
  },
});

function fail(error: { message: string } | null, what: string): void {
  if (error) throw new Error(`${what}: ${error.message}`);
}

export function createSupabaseStore(): Store {
  const sb = getSupabaseAdmin();
  return {
    async getResponse(userId) {
      const { data, error } = await sb.from('preinternship_responses').select(COLS)
        .eq('user_id', userId).is('deleted_at', null).maybeSingle();
      fail(error, 'get response');
      return data ? toStored(data as Row) : null;
    },
    async upsertResponse(userId, cohortId, d: ResponseData) {
      const { data: prior, error: e0 } = await sb.from('preinternship_responses')
        .select('id, deleted_at').eq('user_id', userId).maybeSingle();
      fail(e0, 'lookup response');
      const fields = {
        cohort_id: cohortId, v: d.v, name: d.name ?? null, cohort: d.cohort ?? null, email: d.email ?? null,
        ratings: d.ratings, scenarios: d.scenarios, reflections: d.reflections, prefs: d.prefs,
        ack: d.ack, submitted_at: d.submittedAt ?? new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      if (prior) {
        // A soft-deleted row is revived unlocked; a live unlocked row keeps its flags.
        const revive = prior.deleted_at ? { deleted_at: null, locked: false } : {};
        const { error } = await sb.from('preinternship_responses').update({ ...fields, ...revive }).eq('id', prior.id);
        fail(error, 'update response');
      } else {
        const { error } = await sb.from('preinternship_responses').insert({ user_id: userId, ...fields });
        fail(error, 'insert response');
      }
    },
    async listResponses() {
      const { data, error } = await sb.from('preinternship_responses').select(COLS)
        .is('deleted_at', null).order('submitted_at', { ascending: false });
      fail(error, 'list responses');
      return ((data ?? []) as Row[]).map(toStored);
    },
    async softDeleteResponse(userId) {
      const { data, error } = await sb.from('preinternship_responses')
        .update({ deleted_at: new Date().toISOString() }).eq('user_id', userId).is('deleted_at', null).select('id');
      fail(error, 'delete response');
      return (data?.length ?? 0) > 0;
    },
    async setLocked(userId, locked) {
      const { data, error } = await sb.from('preinternship_responses')
        .update({ locked, updated_at: new Date().toISOString() }).eq('user_id', userId).is('deleted_at', null).select('id');
      fail(error, 'set lock');
      return (data?.length ?? 0) > 0;
    },
    async listReviews() {
      const { data, error } = await sb.from('preinternship_reviews')
        .select('record_key, instr, academic, summary, prepared_by, updated_at, response:preinternship_responses!inner(deleted_at)')
        .is('deleted_at', null).is('response.deleted_at', null);
      fail(error, 'list reviews');
      const out: Record<string, ReviewData> = {};
      for (const r of data ?? []) {
        out[r.record_key] = {
          instr: r.instr, academic: r.academic, summary: r.summary,
          preparedBy: r.prepared_by ?? undefined, updatedAt: r.updated_at, recordKey: r.record_key,
        };
      }
      return out;
    },
    async upsertReview(recordKey, userId, review) {
      const { data: resp, error: e0 } = await sb.from('preinternship_responses').select('id').eq('user_id', userId).single();
      fail(e0, 'lookup response for review');
      const { error } = await sb.from('preinternship_reviews').upsert({
        record_key: recordKey, response_id: resp!.id, instr: review.instr, academic: review.academic ?? {},
        summary: review.summary ?? {}, prepared_by: review.preparedBy ?? null,
        updated_at: new Date().toISOString(), deleted_at: null,
      }, { onConflict: 'record_key' });
      fail(error, 'save review');
    },
    async softDeleteReview(recordKey) {
      const { data, error } = await sb.from('preinternship_reviews')
        .update({ deleted_at: new Date().toISOString() }).eq('record_key', recordKey).is('deleted_at', null).select('id');
      fail(error, 'delete review');
      return (data?.length ?? 0) > 0;
    },
  };
}

/** Run a service call as the signed-in user; maps AccessError to its HTTP status. */
export async function withPreinternship<T>(
  fn: (svc: ReturnType<typeof createPreinternshipService>, actor: Actor) => Promise<T>,
): Promise<NextResponse> {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  try {
    const sb = getSupabaseAdmin();
    const actor: Actor = { id: auth.user.id, role: auth.user.role, name: auth.user.name, email: auth.user.email };
    if (actor.role === 'student') {
      const { data } = await sb.from('students').select('cohort_id').ilike('email', auth.user.email).maybeSingle();
      actor.cohortId = data?.cohort_id ?? null;
    }
    const result = await fn(createPreinternshipService(createSupabaseStore()), actor);
    return NextResponse.json({ success: true, data: result ?? null });
  } catch (e) {
    if (e instanceof AccessError) return NextResponse.json({ success: false, error: e.message }, { status: e.status });
    console.error('[preinternship]', e);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
