import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// GET /api/admin/webhooks/[id]
//
// Returns a single webhook with recent delivery logs (last 20).
// ---------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: webhook, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
      }
      throw error;
    }

    const { data: logs } = await supabase
      .from('webhook_deliveries')
      .select('*')
      .eq('webhook_id', id)
      .order('delivered_at', { ascending: false })
      .limit(20);

    return NextResponse.json({ success: true, webhook, logs: logs ?? [] });
  } catch (error) {
    console.error('Error fetching webhook:', error);
    return NextResponse.json({ error: 'Failed to fetch webhook' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/admin/webhooks/[id]
//
// Body: { name?, url?, secret?, events?, is_active?, headers? }
// ---------------------------------------------------------------------------
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const { id } = await params;
    const body = await request.json() as {
      name?: string;
      url?: string;
      secret?: string | null;
      events?: string[];
      is_active?: boolean;
    };

    const supabase = getSupabaseAdmin();

    // Verify webhook exists
    const { data: existing, error: existsError } = await supabase
      .from('webhooks')
      .select('id')
      .eq('id', id)
      .single();

    if (existsError || !existing) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    // Validate URL if provided
    if (body.url !== undefined) {
      try {
        new URL(body.url);
      } catch {
        return NextResponse.json({ error: 'Invalid webhook URL' }, { status: 400 });
      }
    }

    // Validate events if provided
    if (body.events !== undefined && body.events.length === 0) {
      return NextResponse.json({ error: 'At least one event must be selected' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.url !== undefined) updates.url = body.url.trim();
    if (body.secret !== undefined) updates.secret = body.secret;
    if (body.events !== undefined) updates.events = body.events;
    if (body.is_active !== undefined) updates.is_active = body.is_active;

    const { data: webhook, error: updateError } = await supabase
      .from('webhooks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, webhook });
  } catch (error) {
    console.error('Error updating webhook:', error);
    return NextResponse.json({ error: 'Failed to update webhook' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/webhooks/[id]
// ---------------------------------------------------------------------------
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('webhooks')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 });
  }
}
