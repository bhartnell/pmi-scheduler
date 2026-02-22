import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/users/list
 * Returns a list of active users for dropdowns (task assignment, etc.)
 * Any authenticated user can access this endpoint.
 */
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
      .from('lab_users')
      .select('id, name, email')
      .order('name', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, users: data || [] });
  } catch (error) {
    console.error('Error fetching users list:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch users' }, { status: 500 });
  }
}
