import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - List summative scenarios
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('summative_scenarios')
      .select('*')
      .order('scenario_number', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, scenarios: data });
  } catch (error) {
    console.error('Error fetching summative scenarios:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch scenarios' }, { status: 500 });
  }
}
