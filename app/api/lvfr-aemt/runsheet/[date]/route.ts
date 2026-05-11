import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/lvfr-aemt/runsheet/[date]
 *
 * Returns the runsheet for a single date — two header rows (morning,
 * afternoon) plus their child items. Auto-creates the empty header
 * rows on first read so the UI can start adding items immediately
 * without a separate "create runsheet" call. If the caller wants the
 * runsheet pre-populated from pmi_schedule_blocks they hit the
 * `/seed` sibling route instead — first-read here intentionally
 * stays empty so seeding never happens behind the user's back.
 *
 * Response:
 *   {
 *     success: true,
 *     date: 'YYYY-MM-DD',
 *     sessions: [
 *       { id, session, notes, items: [{ id, title, ..., is_completed, completed_by_name }] },
 *       ...
 *     ]
 *   }
 *
 * PATCH /api/lvfr-aemt/runsheet/[date]?session=morning
 * Body: { notes?: string }
 *
 * Updates the notes field on a single session header row. Used by
 * the runsheet UI's "Notes" textarea (debounced save).
 */

type SessionKey = 'morning' | 'afternoon';
const SESSIONS: SessionKey[] = ['morning', 'afternoon'];

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T12:00:00'));
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { date } = await params;
  if (!isValidDate(date)) {
    return NextResponse.json({ success: false, error: 'invalid date' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Step 1: ensure the two header rows exist. UPSERT keyed on
  // (date, session) means we never duplicate, and concurrent first
  // reads from two instructors both end up safe.
  const headerRows = SESSIONS.map(session => ({ date, session }));
  const { error: upsertErr } = await supabase
    .from('lvfr_day_schedule')
    .upsert(headerRows, { onConflict: 'date,session', ignoreDuplicates: true });
  if (upsertErr) {
    return NextResponse.json({ success: false, error: upsertErr.message }, { status: 500 });
  }

  // Step 2: load the two header rows with their items joined.
  const { data: sessions, error: fetchErr } = await supabase
    .from('lvfr_day_schedule')
    .select(`
      id,
      session,
      notes,
      updated_at,
      cohort_id,
      items:lvfr_schedule_items(
        id,
        title,
        item_type,
        estimated_minutes,
        sort_order,
        is_completed,
        completed_at,
        completed_by,
        notes,
        source_block_id
      )
    `)
    .eq('date', date)
    .order('session');
  if (fetchErr) {
    return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
  }

  // Step 3: hydrate completed_by_name in one round-trip rather than
  // an N+1 join. The supabase-js embed for completed_by FK would
  // collide with the existing FK to lab_users elsewhere, so do it by
  // hand.
  const completedByIds = new Set<string>();
  for (const s of sessions ?? []) {
    for (const it of (s.items ?? []) as Array<{ completed_by?: string | null }>) {
      if (it.completed_by) completedByIds.add(it.completed_by);
    }
  }
  let nameById: Record<string, string> = {};
  if (completedByIds.size > 0) {
    const { data: users } = await supabase
      .from('lab_users')
      .select('id, name')
      .in('id', Array.from(completedByIds));
    nameById = Object.fromEntries((users ?? []).map(u => [u.id, u.name]));
  }

  const shaped = (sessions ?? []).map(s => ({
    id: s.id,
    session: s.session,
    notes: s.notes,
    updated_at: s.updated_at,
    cohort_id: s.cohort_id,
    items: ((s.items ?? []) as Array<{
      id: string;
      title: string;
      item_type: string | null;
      estimated_minutes: number | null;
      sort_order: number;
      is_completed: boolean;
      completed_at: string | null;
      completed_by: string | null;
      notes: string | null;
      source_block_id: string | null;
    }>)
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title))
      .map(it => ({
        ...it,
        completed_by_name: it.completed_by ? nameById[it.completed_by] ?? null : null,
      })),
  }));

  return NextResponse.json({ success: true, date, sessions: shaped });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { date } = await params;
  if (!isValidDate(date)) {
    return NextResponse.json({ success: false, error: 'invalid date' }, { status: 400 });
  }

  const session = request.nextUrl.searchParams.get('session') as SessionKey | null;
  if (!session || !SESSIONS.includes(session)) {
    return NextResponse.json(
      { success: false, error: 'session query param must be morning or afternoon' },
      { status: 400 },
    );
  }

  let body: { notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid body' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('lvfr_day_schedule')
    .update({ notes: body.notes ?? null, updated_at: new Date().toISOString() })
    .eq('date', date)
    .eq('session', session);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
