import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

async function getCallerRole(email: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', email)
    .single();
  return data?.role ?? null;
}

const VALID_SURVEY_TYPES = ['hospital_preceptor', 'field_preceptor'];

// GET - Fetch all surveys for this internship
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const callerRole = await getCallerRole(session.user.email);
    if (!callerRole || !hasMinRole(callerRole, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const { data: surveys, error } = await supabase
      .from('closeout_surveys')
      .select('*')
      .eq('internship_id', id)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('Error fetching closeout surveys:', error.message);
      return NextResponse.json({ success: false, error: 'Failed to fetch surveys' }, { status: 500 });
    }

    return NextResponse.json({ success: true, surveys: surveys || [] });
  } catch (error) {
    console.error('Error in surveys GET:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch surveys' }, { status: 500 });
  }
}

// POST - Submit a new survey
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const callerRole = await getCallerRole(session.user.email);
    if (!callerRole || !hasMinRole(callerRole, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { survey_type, preceptor_name, agency_name, responses } = body;

    if (!survey_type || !VALID_SURVEY_TYPES.includes(survey_type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid survey_type. Must be hospital_preceptor or field_preceptor.' },
        { status: 400 }
      );
    }

    if (!responses || typeof responses !== 'object') {
      return NextResponse.json({ success: false, error: 'responses is required' }, { status: 400 });
    }

    if (survey_type === 'field_preceptor') {
      if (!preceptor_name?.trim()) {
        return NextResponse.json({ success: false, error: 'preceptor_name is required for field surveys' }, { status: 400 });
      }
      if (!agency_name?.trim()) {
        return NextResponse.json({ success: false, error: 'agency_name is required for field surveys' }, { status: 400 });
      }
    }

    const { data: survey, error } = await supabase
      .from('closeout_surveys')
      .insert({
        internship_id: id,
        survey_type,
        preceptor_name: preceptor_name?.trim() || null,
        agency_name: agency_name?.trim() || null,
        responses,
        submitted_by: session.user.email,
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting closeout survey:', error.message);
      return NextResponse.json({ success: false, error: 'Failed to save survey' }, { status: 500 });
    }

    return NextResponse.json({ success: true, survey });
  } catch (error) {
    console.error('Error in surveys POST:', error);
    return NextResponse.json({ success: false, error: 'Failed to save survey' }, { status: 500 });
  }
}

// PUT - Update an existing survey
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const callerRole = await getCallerRole(session.user.email);
    if (!callerRole || !hasMinRole(callerRole, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { survey_id, survey_type, preceptor_name, agency_name, responses } = body;

    if (!survey_id) {
      return NextResponse.json({ success: false, error: 'survey_id is required' }, { status: 400 });
    }

    if (!survey_type || !VALID_SURVEY_TYPES.includes(survey_type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid survey_type. Must be hospital_preceptor or field_preceptor.' },
        { status: 400 }
      );
    }

    if (!responses || typeof responses !== 'object') {
      return NextResponse.json({ success: false, error: 'responses is required' }, { status: 400 });
    }

    if (survey_type === 'field_preceptor') {
      if (!preceptor_name?.trim()) {
        return NextResponse.json({ success: false, error: 'preceptor_name is required for field surveys' }, { status: 400 });
      }
      if (!agency_name?.trim()) {
        return NextResponse.json({ success: false, error: 'agency_name is required for field surveys' }, { status: 400 });
      }
    }

    const { data: survey, error } = await supabase
      .from('closeout_surveys')
      .update({
        survey_type,
        preceptor_name: preceptor_name?.trim() || null,
        agency_name: agency_name?.trim() || null,
        responses,
        submitted_by: session.user.email,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', survey_id)
      .eq('internship_id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating closeout survey:', error.message);
      return NextResponse.json({ success: false, error: 'Failed to update survey' }, { status: 500 });
    }

    return NextResponse.json({ success: true, survey });
  } catch (error) {
    console.error('Error in surveys PUT:', error);
    return NextResponse.json({ success: false, error: 'Failed to update survey' }, { status: 500 });
  }
}

// DELETE - Delete a survey
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const callerRole = await getCallerRole(session.user.email);
    if (!callerRole || !hasMinRole(callerRole, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get('surveyId');

    if (!surveyId) {
      return NextResponse.json({ success: false, error: 'surveyId query parameter is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('closeout_surveys')
      .delete()
      .eq('id', surveyId)
      .eq('internship_id', id);

    if (error) {
      console.error('Error deleting closeout survey:', error.message);
      return NextResponse.json({ success: false, error: 'Failed to delete survey' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in surveys DELETE:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete survey' }, { status: 500 });
  }
}
