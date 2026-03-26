import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - Admin: list all guest tokens
export async function GET() {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('osce_guest_tokens')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, tokens: data });
  } catch (err) {
    console.error('Error fetching guest tokens:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch tokens' }, { status: 500 });
  }
}

// POST - Admin: create a new guest token (single or bulk for all observers)
export async function POST(req: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const supabase = getSupabaseAdmin();

    // Bulk mode: generate tokens for all registered observers who don't have one
    if (body.bulk) {
      const validHours = body.valid_hours || 168; // default 1 week for bulk
      const validUntil = new Date(Date.now() + validHours * 60 * 60 * 1000).toISOString();

      // Get the most recent open/closed event
      const { data: event } = await supabase
        .from('osce_events')
        .select('id')
        .in('status', ['open', 'closed'])
        .order('start_date', { ascending: false })
        .limit(1)
        .single();

      if (!event) {
        return NextResponse.json({ success: false, error: 'No active OSCE event found' }, { status: 404 });
      }

      // Fetch all observers for the event
      const { data: observers, error: obsError } = await supabase
        .from('osce_observers')
        .select('id, name, role')
        .eq('event_id', event.id);

      if (obsError) throw obsError;
      if (!observers || observers.length === 0) {
        return NextResponse.json({ success: false, error: 'No registered observers found' }, { status: 404 });
      }

      // Fetch existing tokens to avoid duplicates (match by evaluator_name)
      const { data: existingTokens } = await supabase
        .from('osce_guest_tokens')
        .select('evaluator_name')
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

      // Map observer role to token role
      const mapRole = (r: string | null): string | null => {
        if (!r) return null;
        const lower = r.toLowerCase();
        if (lower.includes('md') || lower.includes('medical director') || lower.includes('physician')) return 'md';
        if (lower.includes('faculty') || lower.includes('instructor')) return 'faculty';
        if (lower.includes('agency') || lower.includes('fire') || lower.includes('ems')) return 'agency';
        return null;
      };

      // Insert tokens in bulk
      const toInsert = needsToken.map(o => ({
        evaluator_name: o.name,
        evaluator_role: mapRole(o.role),
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

    // Single token creation
    const { evaluator_name, evaluator_role, valid_hours } = body;

    if (!evaluator_name) {
      return NextResponse.json({ success: false, error: 'evaluator_name is required' }, { status: 400 });
    }

    const validUntil = valid_hours
      ? new Date(Date.now() + valid_hours * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('osce_guest_tokens')
      .insert({
        evaluator_name,
        evaluator_role: evaluator_role || null,
        valid_until: validUntil,
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
