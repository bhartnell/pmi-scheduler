import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// GET /api/admin/webhooks/[id]/logs
//
// Query params:
//   ?page=1     - page number (default 1)
//   ?limit=25   - results per page (default 25, max 100)
// ---------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '25', 10)));
    const offset = (page - 1) * limit;

    const supabase = getSupabaseAdmin();

    // Verify webhook exists
    const { data: webhook, error: webhookError } = await supabase
      .from('webhooks')
      .select('id, name')
      .eq('id', id)
      .single();

    if (webhookError || !webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    const { data: logs, error, count } = await supabase
      .from('webhook_deliveries')
      .select('*', { count: 'exact' })
      .eq('webhook_id', id)
      .order('delivered_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      logs: logs ?? [],
      total: count ?? 0,
      page,
      limit,
      pages: Math.ceil((count ?? 0) / limit),
    });
  } catch (error) {
    console.error('Error fetching webhook logs:', error);
    return NextResponse.json({ error: 'Failed to fetch webhook logs' }, { status: 500 });
  }
}
