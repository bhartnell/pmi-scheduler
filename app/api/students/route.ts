import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET - List students, optionally filtered by cohort
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const cohortId = searchParams.get('cohortId');
    const search = searchParams.get('search');
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    let query = getSupabaseAdmin()
      .from('students')
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        cohort_id,
        status,
        cohort:cohorts(id, cohort_number, program:programs(abbreviation))
      `)
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });

    if (cohortId) {
      query = query.eq('cohort_id', cohortId);
    }

    if (activeOnly) {
      query = query.in('status', ['active', 'enrolled']);
    }

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, students: data || [] });
  } catch (error) {
    console.error('Error fetching students:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch students' }, { status: 500 });
  }
}
