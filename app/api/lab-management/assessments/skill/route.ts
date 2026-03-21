import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import { logAuditEvent } from '@/lib/audit';

export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

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
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

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

    // FERPA audit: log skill assessment creation
    logAuditEvent({
      user: { id: user.id, email: user.email, role: user.role },
      action: 'assessment_created',
      resourceType: 'skill_assessment',
      resourceId: data?.id,
      resourceDescription: `Created skill assessment for student ${body.student_id}: ${body.skill_name}`,
      metadata: { studentId: body.student_id, skillName: body.skill_name, passed: body.passed, overallCompetency: body.overall_competency },
    }).catch(console.error);

    return NextResponse.json({ success: true, assessment: data });
  } catch (error) {
    console.error('Error creating skill assessment:', error);
    return NextResponse.json({ success: false, error: 'Failed to create assessment' }, { status: 500 });
  }
}
