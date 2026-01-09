import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - List lab groups for a cohort
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cohortId = searchParams.get('cohortId');
  const includeMembers = searchParams.get('includeMembers') !== 'false';

  if (!cohortId) {
    return NextResponse.json({ success: false, error: 'cohortId is required' }, { status: 400 });
  }

  try {
    let query = supabase
      .from('lab_groups')
      .select(includeMembers ? `
        *,
        members:lab_group_members(
          id,
          assigned_at,
          student:students(
            id,
            first_name,
            last_name,
            photo_url,
            email,
            status
          )
        )
      ` : '*')
      .eq('cohort_id', cohortId)
      .eq('is_active', true)
      .order('display_order')
      .order('name');

    const { data, error } = await query;

    if (error) throw error;

    // Also get ungrouped students for this cohort
    const { data: ungrouped, error: ungroupedError } = await supabase
      .from('students')
      .select('id, first_name, last_name, photo_url, email, status')
      .eq('cohort_id', cohortId)
      .eq('status', 'active')
      .not('id', 'in', `(SELECT student_id FROM lab_group_members)`)
      .order('last_name');

    // Manual filter for ungrouped since the subquery might not work
    const groupedStudentIds = new Set<string>();
    if (includeMembers && data) {
      data.forEach((group: any) => {
        group.members?.forEach((member: any) => {
          if (member.student) {
            groupedStudentIds.add(member.student.id);
          }
        });
      });
    }

    // Get all active students in cohort
    const { data: allStudents } = await supabase
      .from('students')
      .select('id, first_name, last_name, photo_url, email, status')
      .eq('cohort_id', cohortId)
      .eq('status', 'active')
      .order('last_name');

    const ungroupedStudents = allStudents?.filter(s => !groupedStudentIds.has(s.id)) || [];

    return NextResponse.json({ 
      success: true, 
      groups: data || [],
      ungroupedStudents
    });
  } catch (error) {
    console.error('Error fetching lab groups:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch lab groups' }, { status: 500 });
  }
}

// POST - Create a new lab group
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.cohort_id || !body.name) {
      return NextResponse.json({ success: false, error: 'cohort_id and name are required' }, { status: 400 });
    }

    // Get the next display order
    const { data: existing } = await supabase
      .from('lab_groups')
      .select('display_order')
      .eq('cohort_id', body.cohort_id)
      .order('display_order', { ascending: false })
      .limit(1);

    const nextOrder = (existing?.[0]?.display_order || 0) + 1;

    const { data, error } = await supabase
      .from('lab_groups')
      .insert({
        cohort_id: body.cohort_id,
        name: body.name,
        display_order: body.display_order ?? nextOrder,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, group: data });
  } catch (error) {
    console.error('Error creating lab group:', error);
    return NextResponse.json({ success: false, error: 'Failed to create lab group' }, { status: 500 });
  }
}
