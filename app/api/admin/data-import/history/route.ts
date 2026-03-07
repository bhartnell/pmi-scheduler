import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const importType = searchParams.get('importType');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('import_history')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (importType) {
      query = query.eq('import_type', importType);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      history: data || [],
      pagination: { limit, offset, total: count || 0 },
    });
  } catch (error) {
    console.error('Error fetching import history:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch import history' },
      { status: 500 }
    );
  }
}
