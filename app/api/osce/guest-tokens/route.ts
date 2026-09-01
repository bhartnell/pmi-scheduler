import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - Admin: list guest tokens. Optional ?event_id= to scope to one event
// (every OSCE event gets its own independent token set — Repeatability Rule).
export async function GET(req: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('event_id');

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('osce_guest_tokens')
      .select('*')
      .order('created_at', { ascending: false });

    if (eventId) {
      query = query.eq('event_id', eventId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json({ success: true, tokens: data });
  } catch (err) {
    console.error('Error fetching guest tokens:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch tokens' }, { status: 500 });
  }
}

async function resolveDefaultEventId(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<string | null> {
  const { data } = await supabase
    .from('osce_events')
    .select('id')
    .in('status', ['open', 'closed'])
    .order('start_date', { ascending: false })
    .limit(1)
    .single();
  return data?.id || null;
}

function mapRole(r: string | null | undefined): 'md' | 'faculty' | 'agency' | null {
  if (!r) return null;
  const lower = r.toLowerCase();
  if (['md', 'faculty', 'agency'].includes(lower)) return lower as 'md' | 'faculty' | 'agency';
  if (lower.includes('md') || lower.includes('medical director') || lower.includes('physician')) return 'md';
  if (lower.includes('faculty') || lower.includes('instructor')) return 'faculty';
  if (lower.includes('agency') || lower.includes('fire') || lower.includes('ems')) return 'agency';
  return null;
}

// POST - Admin: create guest token(s). Three modes:
//   1. Single: { event_id?, evaluator_name, email?, agency?, evaluator_role?, valid_hours? }
//      — event_id defaults to the most recent open/closed event when omitted.
//   2. Invite list: { event_id?, invites: [{ name, email, agency?, role? }], valid_hours? }
//      — for adding a fresh list of external evaluator contacts who aren't
//      necessarily already an osce_observers row.
//   3. Bulk-from-observers: { event_id?, bulk: true, valid_hours? }
//      — generates tokens (with email copied over) for every registered
//      observer on that event who doesn't already have an active token.
export async function POST(req: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const supabase = getSupabaseAdmin();

    // ── Mode 2: invite list — a fresh batch of external evaluator contacts ──
    if (Array.isArray(body.invites)) {
      const eventId: string | null = body.event_id || await resolveDefaultEventId(supabase);
      if (!eventId) {
        return NextResponse.json({ success: false, error: 'No OSCE event found — create/select one first' }, { status: 404 });
      }

      const invites = body.invites as Array<{ name?: string; email?: string; agency?: string; role?: string }>;
      const validHours = body.valid_hours || 336; // default 2 weeks — external VIPs need lead time
      const validUntil = new Date(Date.now() + validHours * 60 * 60 * 1000).toISOString();

      const cleaned = invites
        .map(i => ({
          name: (i.name || '').trim(),
          email: (i.email || '').trim().toLowerCase(),
          agency: (i.agency || '').trim() || null,
          role: mapRole(i.role),
        }))
        .filter(i => i.name && i.email);

      if (cleaned.length === 0) {
        return NextResponse.json({ success: false, error: 'No valid invite rows (name + email required)' }, { status: 400 });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalid = cleaned.filter(i => !emailRegex.test(i.email));
      if (invalid.length > 0) {
        return NextResponse.json({
          success: false,
          error: `Invalid email address for: ${invalid.map(i => i.name).join(', ')}`,
        }, { status: 400 });
      }

      const toInsert = cleaned.map(i => ({
        event_id: eventId,
        evaluator_name: i.name,
        evaluator_role: i.role,
        email: i.email,
        agency: i.agency,
        valid_until: validUntil,
      }));

      const { data: created, error: insertError } = await supabase
        .from('osce_guest_tokens')
        .insert(toInsert)
        .select();

      if (insertError) throw insertError;

      return NextResponse.json({ success: true, created: created || [] });
    }

    // ── Mode 3: bulk-from-observers ──────────────────────────────────────
    if (body.bulk) {
      const validHours = body.valid_hours || 168; // default 1 week for bulk
      const validUntil = new Date(Date.now() + validHours * 60 * 60 * 1000).toISOString();

      const eventId: string | null = body.event_id || await resolveDefaultEventId(supabase);
      if (!eventId) {
        return NextResponse.json({ success: false, error: 'No active OSCE event found' }, { status: 404 });
      }

      // Fetch all observers for the event — including email, so the token
      // can actually be emailed (previously only name/role were copied).
      const { data: observers, error: obsError } = await supabase
        .from('osce_observers')
        .select('id, name, email, agency, role')
        .eq('event_id', eventId);

      if (obsError) throw obsError;
      if (!observers || observers.length === 0) {
        return NextResponse.json({ success: false, error: 'No registered observers found' }, { status: 404 });
      }

      // Fetch existing tokens for this event to avoid duplicates (match by evaluator_name)
      const { data: existingTokens } = await supabase
        .from('osce_guest_tokens')
        .select('evaluator_name')
        .eq('event_id', eventId)
        .gt('valid_until', new Date().toISOString());

      const existingNames = new Set((existingTokens || []).map(t => t.evaluator_name.toLowerCase()));

      // Filter to observers who don't already have an active token
      const needsToken = observers.filter(o => !existingNames.has(o.name.toLowerCase()));

      if (needsToken.length === 0) {
        return NextResponse.json({
          success: true,
          created: [],
          skipped: observers.length,
          message: 'All observers already have active tokens',
        });
      }

      // Insert tokens in bulk
      const toInsert = needsToken.map(o => ({
        event_id: eventId,
        evaluator_name: o.name,
        evaluator_role: mapRole(o.role),
        email: o.email || null,
        agency: o.agency || null,
        valid_until: validUntil,
      }));

      const { data: created, error: insertError } = await supabase
        .from('osce_guest_tokens')
        .insert(toInsert)
        .select();

      if (insertError) throw insertError;

      return NextResponse.json({
        success: true,
        created: created || [],
        skipped: observers.length - needsToken.length,
      });
    }

    // ── Mode 1: single token ──────────────────────────────────────────────
    const { evaluator_name, evaluator_role, email, agency, valid_hours, event_id } = body;

    if (!evaluator_name) {
      return NextResponse.json({ success: false, error: 'evaluator_name is required' }, { status: 400 });
    }

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json({ success: false, error: 'Invalid email address' }, { status: 400 });
      }
    }

    const validUntil = valid_hours
      ? new Date(Date.now() + valid_hours * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 336 * 60 * 60 * 1000).toISOString();

    // Resolve which event this token grants access to. Callers may pass an
    // explicit event_id; otherwise default to the most recent open/closed
    // event. Without this, tokens were created with event_id left null, so
    // /api/osce/validate-token could never resolve an event title/pin for
    // them (fixed in PR #90; kept here so this mode still works without an
    // explicit event_id from older callers).
    const resolvedEventId: string | null = event_id || await resolveDefaultEventId(supabase);

    const { data, error } = await supabase
      .from('osce_guest_tokens')
      .insert({
        evaluator_name,
        evaluator_role: mapRole(evaluator_role) || evaluator_role || null,
        email: email ? email.trim().toLowerCase() : null,
        agency: agency?.trim() || null,
        valid_until: validUntil,
        event_id: resolvedEventId,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, token: data });
  } catch (err) {
    console.error('Error creating guest token:', err);
    return NextResponse.json({ success: false, error: 'Failed to create token' }, { status: 500 });
  }
}

// DELETE - Admin: revoke a token
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const tokenId = searchParams.get('id');

    if (!tokenId) {
      return NextResponse.json({ success: false, error: 'Token id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('osce_guest_tokens')
      .delete()
      .eq('id', tokenId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error revoking token:', err);
    return NextResponse.json({ success: false, error: 'Failed to revoke token' }, { status: 500 });
  }
}
