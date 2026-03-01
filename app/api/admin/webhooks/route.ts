import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Helper – resolve current user from session email
// ---------------------------------------------------------------------------
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// ---------------------------------------------------------------------------
// GET /api/admin/webhooks
//
// Returns all webhooks with recent delivery stats (last delivery status,
// success rate over last 50 deliveries).
// ---------------------------------------------------------------------------
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    const { data: webhooks, error } = await supabase
      .from('webhooks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // For each webhook, fetch recent delivery stats
    const enriched = await Promise.all(
      (webhooks ?? []).map(async (wh: any) => {
        const { data: logs } = await supabase
          .from('webhook_deliveries')
          .select('success, response_status, delivered_at')
          .eq('webhook_id', wh.id)
          .order('delivered_at', { ascending: false })
          .limit(50);

        const recent = logs ?? [];
        const totalDeliveries = recent.length;
        const successCount = recent.filter((l: any) => l.success).length;
        const lastDelivery = recent[0] ?? null;

        return {
          ...wh,
          stats: {
            total_deliveries: totalDeliveries,
            success_count: successCount,
            failure_count: totalDeliveries - successCount,
            success_rate: totalDeliveries > 0 ? Math.round((successCount / totalDeliveries) * 100) : null,
            last_delivery_at: lastDelivery?.delivered_at ?? null,
            last_delivery_success: lastDelivery?.success ?? null,
            last_delivery_status: lastDelivery?.response_status ?? null,
          },
        };
      })
    );

    return NextResponse.json({ success: true, webhooks: enriched });
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    return NextResponse.json({ error: 'Failed to fetch webhooks' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/webhooks
//
// Body: { name, url, secret?, events, is_active?, headers? }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json() as {
      name: string;
      url: string;
      secret?: string | null;
      events: string[];
      is_active?: boolean;
    };

    const { name, url, secret, events, is_active = true } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Webhook name is required' }, { status: 400 });
    }
    if (!url?.trim()) {
      return NextResponse.json({ error: 'Webhook URL is required' }, { status: 400 });
    }
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid webhook URL' }, { status: 400 });
    }
    if (!events || events.length === 0) {
      return NextResponse.json({ error: 'At least one event must be selected' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Auto-generate secret if requested (empty string = generate)
    const resolvedSecret = secret === '' ? crypto.randomBytes(32).toString('hex') : (secret ?? null);

    const { data: webhook, error } = await supabase
      .from('webhooks')
      .insert({
        name: name.trim(),
        url: url.trim(),
        secret: resolvedSecret,
        events,
        is_active,
        created_by: currentUser.email,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, webhook }, { status: 201 });
  } catch (error) {
    console.error('Error creating webhook:', error);
    return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 });
  }
}
