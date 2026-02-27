import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// Auto-flag threshold: any individual rating at or below this triggers a flag
const AUTO_FLAG_THRESHOLD = 2;

// GET: Validate token, return internship/student info if valid
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = getSupabaseAdmin();

    const { data: tokenRecord, error } = await supabase
      .from('preceptor_eval_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (error || !tokenRecord) {
      return NextResponse.json(
        { success: false, error: 'invalid', message: 'This evaluation link is invalid.' },
        { status: 404 }
      );
    }

    if (tokenRecord.status === 'submitted') {
      return NextResponse.json(
        { success: false, error: 'used', message: 'This evaluation has already been submitted.' },
        { status: 410 }
      );
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'expired', message: 'This evaluation link has expired.' },
        { status: 410 }
      );
    }

    // Fetch internship details for the form header
    const { data: internship } = await supabase
      .from('student_internships')
      .select(`
        id,
        agency_name,
        current_phase,
        status,
        internship_start_date,
        students (
          id,
          first_name,
          last_name
        )
      `)
      .eq('id', tokenRecord.internship_id)
      .single();

    return NextResponse.json({
      success: true,
      token: {
        id: tokenRecord.id,
        preceptor_email: tokenRecord.preceptor_email,
        expires_at: tokenRecord.expires_at,
      },
      internship,
    });
  } catch (error) {
    console.error('Error validating preceptor eval token:', error);
    return NextResponse.json(
      { success: false, error: 'server_error', message: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

// POST: Submit evaluation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = getSupabaseAdmin();

    // Re-validate token
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('preceptor_eval_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (tokenError || !tokenRecord) {
      return NextResponse.json(
        { success: false, error: 'invalid', message: 'This evaluation link is invalid.' },
        { status: 404 }
      );
    }

    if (tokenRecord.status === 'submitted') {
      return NextResponse.json(
        { success: false, error: 'used', message: 'This evaluation has already been submitted.' },
        { status: 410 }
      );
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'expired', message: 'This evaluation link has expired.' },
        { status: 410 }
      );
    }

    const body = await request.json();

    const {
      clinical_skills_rating,
      professionalism_rating,
      communication_rating,
      overall_rating,
      strengths,
      areas_for_improvement,
      comments,
      preceptor_signature,
      shift_date,
    } = body;

    // Validate required ratings
    if (!clinical_skills_rating || !professionalism_rating || !communication_rating || !overall_rating) {
      return NextResponse.json(
        { success: false, error: 'validation', message: 'All ratings are required.' },
        { status: 400 }
      );
    }

    if (!preceptor_signature?.trim()) {
      return NextResponse.json(
        { success: false, error: 'validation', message: 'Preceptor signature is required.' },
        { status: 400 }
      );
    }

    // Fetch student_id from internship
    const { data: internship } = await supabase
      .from('student_internships')
      .select('student_id, agency_name')
      .eq('id', tokenRecord.internship_id)
      .single();

    if (!internship) {
      return NextResponse.json(
        { success: false, error: 'not_found', message: 'Internship not found.' },
        { status: 404 }
      );
    }

    // Auto-flag if any rating is at or below threshold
    const ratings = [clinical_skills_rating, professionalism_rating, communication_rating, overall_rating].filter(
      (r) => r != null
    );
    const autoFlag = ratings.some((r) => r <= AUTO_FLAG_THRESHOLD);

    // Insert into preceptor_feedback
    const { data: feedback, error: feedbackError } = await supabase
      .from('preceptor_feedback')
      .insert({
        student_id: internship.student_id,
        internship_id: tokenRecord.internship_id,
        preceptor_name: preceptor_signature.trim(),
        preceptor_email: tokenRecord.preceptor_email,
        clinical_site: internship.agency_name || null,
        shift_date: shift_date || new Date().toISOString().split('T')[0],
        clinical_skills_rating,
        professionalism_rating,
        communication_rating,
        overall_rating,
        strengths: strengths?.trim() || null,
        areas_for_improvement: areas_for_improvement?.trim() || null,
        comments: comments?.trim() || null,
        is_flagged: autoFlag,
        submitted_by: `${preceptor_signature.trim()} (via preceptor portal)`,
      })
      .select()
      .single();

    if (feedbackError) throw feedbackError;

    // Mark token as submitted
    await supabase
      .from('preceptor_eval_tokens')
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('id', tokenRecord.id);

    return NextResponse.json({ success: true, feedback_id: feedback.id });
  } catch (error) {
    console.error('Error submitting preceptor evaluation:', error);
    return NextResponse.json(
      { success: false, error: 'server_error', message: 'Failed to submit evaluation. Please try again.' },
      { status: 500 }
    );
  }
}
