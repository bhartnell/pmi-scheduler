import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendWebhookRequest, SAMPLE_PAYLOADS } from '@/lib/webhooks';

// ---------------------------------------------------------------------------
// POST /api/admin/webhooks/[id]/test
//
// Body: { event: string }
//
// Sends a test delivery using a sample payload for the given event type.
// Logs the attempt in webhook_logs.
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const { id } = await params;
    const body = await request.json() as { event?: string };
    const event = body.event;

    if (!event) {
      return NextResponse.json({ error: 'event is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: webhook, error: fetchError } = await supabase
      .from('webhooks')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    const samplePayload = SAMPLE_PAYLOADS[event] ?? { test: true, event };

    const result = await sendWebhookRequest(webhook, event, {
      ...samplePayload,
      _test: true,
    });

    return NextResponse.json({
      success: result.success,
      status: result.status,
      body: result.body,
    });
  } catch (error) {
    console.error('Error sending test webhook:', error);
    return NextResponse.json({ error: 'Failed to send test webhook' }, { status: 500 });
  }
}
