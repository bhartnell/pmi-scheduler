import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { AuthResult, AuthUser } from '@/lib/api-auth';
import { activeEntries, proctorAllows, type ProctorEntry, type ProctorScope } from '@/lib/nremt-proctor-rules';

// Per-day NREMT proctor access (card 4225cd1c).
//
// SAFETY RULE: this is a SECOND step that runs only AFTER a route's normal instructor
// check has refused. It never changes who the instructor check lets in. Every error in
// here (missing table, query failure, no session) means "no proctor access" and the route
// returns its original refusal.

export type ProctorScopeInput =
  | { labDayId: string | null | undefined }
  | { stationId: string | null | undefined }
  | { cohortId: string | null | undefined }
  | { any: true };

export async function loadProctorEntries(email: string): Promise<ProctorEntry[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('nremt_day_proctors')
    .select('lab_day_id, removed, lab_day:lab_days!inner(id, date, is_nremt_testing, cohort_id)')
    .ilike('email', email)
    .eq('removed', false);
  if (error) throw error; // caller turns this into a refusal
  return (data || []).map((r: any) => ({
    lab_day_id: r.lab_day_id as string,
    removed: r.removed === true,
    lab_day: Array.isArray(r.lab_day) ? r.lab_day[0] ?? null : r.lab_day ?? null,
  }));
}

async function resolveScope(input: ProctorScopeInput): Promise<ProctorScope> {
  if ('any' in input) return { kind: 'any' };
  if ('labDayId' in input) return { kind: 'labDay', labDayId: input.labDayId || '' };
  if ('cohortId' in input) return { kind: 'cohort', cohortId: input.cohortId || '' };
  if (!input.stationId) return { kind: 'station', stationLabDayId: null };
  const { data } = await getSupabaseAdmin().from('lab_stations').select('lab_day_id').eq('id', input.stationId).maybeSingle();
  return { kind: 'station', stationLabDayId: (data?.lab_day_id as string | null) ?? null };
}

/** True when `email` is a live proctor for the scope right now. Any error = false. */
export async function isProctorFor(email: string | null | undefined, input: ProctorScopeInput, now = new Date()): Promise<boolean> {
  try {
    if (!email) return false;
    const entries = await loadProctorEntries(email);
    if (activeEntries(entries, now).length === 0) return false;
    return proctorAllows(entries, await resolveScope(input), now);
  } catch (err) {
    console.error('nremt proctor check failed (refusing):', err);
    return false;
  }
}

/** Lab-day ids the signed-in user is a live proctor for. Error = []. */
export async function proctorLabDayIds(email: string | null | undefined, now = new Date()): Promise<string[]> {
  try {
    if (!email) return [];
    return Array.from(new Set(activeEntries(await loadProctorEntries(email), now).map((e) => e.lab_day_id)));
  } catch (err) {
    console.error('nremt proctor list failed (none):', err);
    return [];
  }
}

/**
 * Second-step auth. Call ONLY with the refusal the instructor check returned. Returns an
 * AuthResult (with the person's own account, so evaluations record their own name) when
 * the refusal was a 403 and the person is a live proctor for the scope; otherwise null and
 * the route returns its original refusal.
 */
export async function proctorAuthFallback(refusal: unknown, input: ProctorScopeInput): Promise<AuthResult | null> {
  try {
    if (!(refusal instanceof NextResponse) || refusal.status !== 403) return null;
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    if (!email) return null;
    if (!(await isProctorFor(email, input))) return null;
    const { data: user } = await getSupabaseAdmin().from('lab_users').select('id, name, email, role').ilike('email', email).single();
    if (!user) return null;
    return { user: user as AuthUser, session: { user: { email } } };
  } catch (err) {
    console.error('nremt proctor fallback failed (refusing):', err);
    return null;
  }
}

/**
 * Evaluate-route variant: the request body names the station (and optionally the lab day).
 * The proctor must be live for that station's lab day, and a lab_day_id in the body must be
 * that same day. Reads a CLONE of the request so the route can still read the body.
 */
export async function proctorEvaluateFallback(request: Request): Promise<AuthResult | null> {
  try {
    const body = await request.clone().json();
    const stationId = typeof body?.station_id === 'string' ? body.station_id : null;
    if (!stationId) return null;
    const { data: station } = await getSupabaseAdmin().from('lab_stations').select('lab_day_id').eq('id', stationId).maybeSingle();
    if (!station?.lab_day_id) return null;
    if (body?.lab_day_id && body.lab_day_id !== station.lab_day_id) return null;
    return await proctorAuthFallback(NextResponse.json({}, { status: 403 }), { stationId });
  } catch (err) {
    console.error('nremt proctor evaluate fallback failed (refusing):', err);
    return null;
  }
}
