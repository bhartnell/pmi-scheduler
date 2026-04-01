import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/volunteer/invites — list invite campaigns
export async function GET() {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('volunteer_invites')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Enrich with registration counts per invite
    const inviteIds = (data || []).map((i: { id: string }) => i.id);
    let regCounts: Record<string, number> = {};

    if (inviteIds.length > 0) {
      const { data: regs } = await supabase
        .from('volunteer_registrations')
        .select('invite_id')
        .in('invite_id', inviteIds)
        .neq('status', 'cancelled');

      if (regs) {
        for (const r of regs) {
          if (r.invite_id) {
            regCounts[r.invite_id] = (regCounts[r.invite_id] || 0) + 1;
          }
        }
      }
    }

    const enriched = (data || []).map((i: Record<string, unknown>) => ({
      ...i,
      registration_count: regCounts[i.id as string] || 0,
    }));

    return NextResponse.json({ success: true, data: enriched });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/volunteer/invites — create invite campaign
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { name, invite_type, event_ids, message, deadline } = body;

    if (!name || !invite_type || !event_ids?.length) {
      return NextResponse.json(
        { success: false, error: 'Name, invite type, and at least one event are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('volunteer_invites')
      .insert({
        name,
        invite_type,
        event_ids,
        message: message || null,
        deadline: deadline || null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
