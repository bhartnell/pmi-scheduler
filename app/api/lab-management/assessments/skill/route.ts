import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const studentId = searchParams.get('studentId');
  const stationId = searchParams.get('stationId');

  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('skill_assessments')
      .select(`
        *,
        student:students(id, first_name, last_name),
        station:lab_stations(id, station_number, skill_name)
      `)
      .order('assessed_at', { ascending: false });

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    if (stationId) {
      query = query.eq('lab_station_id', stationId);
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
    const supabase = getSupabaseAdmin();

    const body = await request.json();
    
    const { data, error } = await supabase
      .from('skill_assessments')
      .insert({
        student_id: body.student_id,
        lab_station_id: body.lab_station_id || null,
        skill_name: body.skill_name,
        attempt_number: body.attempt_number || 1,
        preparation_score: body.preparation_score || null,
        technique_score: body.technique_score || null,
        safety_score: body.safety_score || null,
        overall_competency: body.overall_competency,
        passed: body.passed || false,
        comments: body.comments || null,
        assessed_by: body.assessed_by || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, assessment: data });
  } catch (error) {
    console.error('Error creating skill assessment:', error);
    return NextResponse.json({ success: false, error: 'Failed to create assessment' }, { status: 500 });
  }
}
