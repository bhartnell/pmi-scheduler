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
  const studentId = searchParams.get('studentId');

  try {
    let query = supabase
      .from('student_learning_styles')
      .select(`
        *,
        student:students(
          id,
          first_name,
          last_name,
          agency,
          cohort_id,
          cohort:cohorts(
            id,
            cohort_number,
            program:programs(abbreviation)
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Filter by cohort if specified
    let filteredData = data;
    if (cohortId) {
      filteredData = data?.filter((ls: any) => ls.student?.cohort_id === cohortId) || [];
    }

    return NextResponse.json({ success: true, learningStyles: filteredData });
  } catch (error) {
    console.error('Error fetching learning styles:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch learning styles' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Check if student already has learning style
    const { data: existing } = await supabase
      .from('student_learning_styles')
      .select('id')
      .eq('student_id', body.student_id)
      .single();

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('student_learning_styles')
        .update({
          primary_style: body.primary_style,
          social_style: body.social_style,
          processing_style: body.processing_style || null,
          structure_style: body.structure_style || null,
          assessment_data: body.assessment_data || null,
          assessed_date: body.assessed_date || new Date().toISOString().split('T')[0],
          notes: body.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select(`
          *,
          student:students(
            id,
            first_name,
            last_name,
            agency,
            cohort:cohorts(
              id,
              cohort_number,
              program:programs(abbreviation)
            )
          )
        `)
        .single();

      if (error) throw error;

      return NextResponse.json({ success: true, learningStyle: data });
    } else {
      // Create new
      const { data, error } = await supabase
        .from('student_learning_styles')
        .insert({
          student_id: body.student_id,
          primary_style: body.primary_style,
          social_style: body.social_style,
          processing_style: body.processing_style || null,
          structure_style: body.structure_style || null,
          assessment_data: body.assessment_data || null,
          assessed_date: body.assessed_date || new Date().toISOString().split('T')[0],
          notes: body.notes || null,
        })
        .select(`
          *,
          student:students(
            id,
            first_name,
            last_name,
            agency,
            cohort:cohorts(
              id,
              cohort_number,
              program:programs(abbreviation)
            )
          )
        `)
        .single();

      if (error) throw error;

      return NextResponse.json({ success: true, learningStyle: data });
    }
  } catch (error) {
    console.error('Error saving learning style:', error);
    return NextResponse.json({ success: false, error: 'Failed to save learning style' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('student_learning_styles')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting learning style:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete learning style' }, { status: 500 });
  }
}
