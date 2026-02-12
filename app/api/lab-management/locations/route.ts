import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client lazily to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// GET - List active room locations for station assignment
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      if (error.code === '42P01') {
        return NextResponse.json({ success: true, locations: [] });
      }
      throw error;
    }

    return NextResponse.json({ success: true, locations: locations || [] });
  } catch (error: any) {
    console.error('Error fetching locations:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch locations' },
      { status: 500 }
    );
  }
}
