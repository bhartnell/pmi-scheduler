import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// GET - List active room locations for station assignment
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    // Allow volunteer_instructor+ to view locations
    const auth = await requireAuth('volunteer_instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const searchParams = request.nextUrl.searchParams;
    const locationType = searchParams.get('type') || 'room';

    const { data: locations, error } = await supabase
      .from('locations')
      .select('id, name')
      .eq('location_type', locationType)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      // Table might not exist yet - return empty array
      if ((error as any).code === '42P01') {
        return NextResponse.json({ success: true, locations: [] });
      }
      throw error;
    }

    const response = NextResponse.json({ success: true, locations: locations || [] });
    response.headers.set('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1200');
    return response;
  } catch (error) {
    console.error('Error fetching locations:', error);
    return NextResponse.json(
      { success: false, error: (error as Error)?.message || 'Failed to fetch locations' },
      { status: 500 }
    );
  }
}
