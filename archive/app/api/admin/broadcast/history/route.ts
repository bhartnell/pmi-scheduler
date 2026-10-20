import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// GET /api/admin/broadcast/history
// Returns paginated list of past broadcasts.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const { data, error, count } = await supabase
      .from('broadcast_history')
      .select('*', { count: 'exact' })
      .order('sent_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      broadcasts: data || [],
      pagination: { limit, offset, total: count || 0 },
    });
  } catch (error) {
    console.error('Error fetching broadcast history:', error);
    return NextResponse.json(
      { success: false, error: (error as Error)?.message || 'Failed to fetch broadcast history' },
      { status: 500 }
    );
  }
}
