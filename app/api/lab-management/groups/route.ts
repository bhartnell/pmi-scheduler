import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cohortId = searchParams.get('cohortId');

  try {
    let query = supabase
      .from('student_groups')
      .select(`
        *,
        cohort:cohorts(
          id,
          cohort_number,
          program:programs(abbreviation)
        )
      `)
      .eq('is_active', true)
      .order('group_number');

    if (cohortId) {
      query = query.eq('cohort_id', cohortId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, groups: data });
  } catch (error) {
    console.error('Error fetching groups:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch groups' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.cohort_id) {
      return NextResponse.json({ success: false, error: 'Cohort is required' }, { status: 400 });
    }

    // Get next group number
    const { data: existingGroups } = await supabase
      .from('student_groups')
      .select('group_number')
      .eq('cohort_id', body.cohort_id)
      .order('group_number', { ascending: false })
      .limit(1);

    const nextNumber = (existingGroups?.[0]?.group_number || 0) + 1;

    const { data, error } = await supabase
      .from('student_groups')
      .insert({
        cohort_id: body.cohort_id,
        name: body.name || `Group ${nextNumber}`,
        group_number: body.group_number || nextNumber,
        description: body.description || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, group: data });
  } catch (error) {
    console.error('Error creating group:', error);
    return NextResponse.json({ success: false, error: 'Failed to create group' }, { status: 500 });
  }
}
