import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - List active room locations for station assignment
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

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
