// app/api/lab-management/assessments/skill/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const labStationId = searchParams.get('labStationId');
    const labDayId = searchParams.get('labDayId');
    const studentId = searchParams.get('studentId');
    const cohortId = searchParams.get('cohortId');

    let query = supabase
      .from('skill_assessments')
      .select(`
        *,
        student:students!skill_assessments_student_id_fkey(id, first_name, last_name, photo_url),
        grader:lab_users!skill_assessments_graded_by_fkey(id, name)
      `)
      .order('assessed_at', { ascending: false });

    if (labStationId) {
      query = query.eq('lab_station_id', labStationId);
    }

    if (labDayId) {
      query = query.eq('lab_day_id', labDayId);
    }

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    if (cohortId) {
      query = query.eq('cohort_id', cohortId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, assessments: data });
  } catch (error) {
    console.error('Error fetching skill assessments:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch assessments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      lab_station_id,
      lab_day_id,
      skill_name,
      student_id,
      cohort_id,
      preparation_safety,
      technical_performance,
      critical_thinking,
      time_management,
      overall_competency,
      narrative_feedback,
      graded_by,
    } = body;

    if (!lab_station_id || !lab_day_id || !skill_name || !student_id || !cohort_id) {
      return NextResponse.json(
        { success: false, error: 'Lab station, lab day, skill name, student, and cohort are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('skill_assessments')
      .insert({
        lab_station_id,
        lab_day_id,
        skill_name,
        student_id,
        cohort_id,
        preparation_safety: preparation_safety ?? null,
        technical_performance: technical_performance ?? null,
        critical_thinking: critical_thinking ?? null,
        time_management: time_management ?? null,
        overall_competency: overall_competency ?? null,
        narrative_feedback: narrative_feedback || null,
        graded_by: graded_by || null,
        assessed_at: new Date().toISOString(),
      })
      .select(`
        *,
        student:students!skill_assessments_student_id_fkey(id, first_name, last_name, photo_url),
        grader:lab_users!skill_assessments_graded_by_fkey(id, name)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, assessment: data });
  } catch (error) {
    console.error('Error creating skill assessment:', error);
    return NextResponse.json({ success: false, error: 'Failed to create assessment' }, { status: 500 });
  }
}
