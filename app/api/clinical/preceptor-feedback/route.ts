import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// Auto-flag threshold: any individual rating at or below this value triggers a flag
const AUTO_FLAG_THRESHOLD = 2;

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !hasMinRole(callerUser.role, 'instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const studentId = searchParams.get('student_id');
    const internshipId = searchParams.get('internship_id');
    const flaggedOnly = searchParams.get('flagged') === 'true';

    let query = supabase
      .from('preceptor_feedback')
      .select(`
        *,
        students (
          id,
          first_name,
          last_name
        )
      `)
      .order('shift_date', { ascending: false });

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    if (internshipId) {
      query = query.eq('internship_id', internshipId);
    }

    if (flaggedOnly) {
      query = query.eq('is_flagged', true);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, feedback: data });
  } catch (error) {
    console.error('Error fetching preceptor feedback:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch feedback' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('role, name')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !hasMinRole(callerUser.role, 'instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    if (!body.student_id) {
      return NextResponse.json({ success: false, error: 'Student is required' }, { status: 400 });
    }

    if (!body.preceptor_name?.trim()) {
      return NextResponse.json({ success: false, error: 'Preceptor name is required' }, { status: 400 });
    }

    // Auto-flag if any rating is at or below the threshold
    const ratings = [
      body.clinical_skills_rating,
      body.professionalism_rating,
      body.communication_rating,
      body.overall_rating,
    ].filter((r) => r != null);

    const autoFlag = ratings.some((r) => r <= AUTO_FLAG_THRESHOLD);
    const isFlagged = body.is_flagged === true || autoFlag;

    const { data, error } = await supabase
      .from('preceptor_feedback')
      .insert({
        student_id: body.student_id,
        internship_id: body.internship_id || null,
        preceptor_name: body.preceptor_name.trim(),
        preceptor_email: body.preceptor_email?.trim() || null,
        clinical_site: body.clinical_site?.trim() || null,
        shift_date: body.shift_date || null,
        clinical_skills_rating: body.clinical_skills_rating || null,
        professionalism_rating: body.professionalism_rating || null,
        communication_rating: body.communication_rating || null,
        overall_rating: body.overall_rating || null,
        strengths: body.strengths?.trim() || null,
        areas_for_improvement: body.areas_for_improvement?.trim() || null,
        comments: body.comments?.trim() || null,
        is_flagged: isFlagged,
        submitted_by: callerUser.name || session.user.email,
      })
      .select(`
        *,
        students (
          id,
          first_name,
          last_name
        )
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, feedback: data });
  } catch (error) {
    console.error('Error creating preceptor feedback:', error);
    return NextResponse.json({ success: false, error: 'Failed to create feedback' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !hasMinRole(callerUser.role, 'instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ success: false, error: 'Feedback ID is required' }, { status: 400 });
    }

    // Re-evaluate auto-flag on update
    const ratings = [
      body.clinical_skills_rating,
      body.professionalism_rating,
      body.communication_rating,
      body.overall_rating,
    ].filter((r) => r != null);

    const autoFlag = ratings.length > 0 && ratings.some((r) => r <= AUTO_FLAG_THRESHOLD);

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Only include fields present in the body
    if (body.preceptor_name !== undefined) updatePayload.preceptor_name = body.preceptor_name?.trim();
    if (body.preceptor_email !== undefined) updatePayload.preceptor_email = body.preceptor_email?.trim() || null;
    if (body.clinical_site !== undefined) updatePayload.clinical_site = body.clinical_site?.trim() || null;
    if (body.shift_date !== undefined) updatePayload.shift_date = body.shift_date || null;
    if (body.clinical_skills_rating !== undefined) updatePayload.clinical_skills_rating = body.clinical_skills_rating || null;
    if (body.professionalism_rating !== undefined) updatePayload.professionalism_rating = body.professionalism_rating || null;
    if (body.communication_rating !== undefined) updatePayload.communication_rating = body.communication_rating || null;
    if (body.overall_rating !== undefined) updatePayload.overall_rating = body.overall_rating || null;
    if (body.strengths !== undefined) updatePayload.strengths = body.strengths?.trim() || null;
    if (body.areas_for_improvement !== undefined) updatePayload.areas_for_improvement = body.areas_for_improvement?.trim() || null;
    if (body.comments !== undefined) updatePayload.comments = body.comments?.trim() || null;

    // is_flagged: respect explicit value, but auto-flag always wins
    if (body.is_flagged !== undefined || autoFlag) {
      updatePayload.is_flagged = body.is_flagged === true || autoFlag;
    }

    const { data, error } = await supabase
      .from('preceptor_feedback')
      .update(updatePayload)
      .eq('id', body.id)
      .select(`
        *,
        students (
          id,
          first_name,
          last_name
        )
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, feedback: data });
  } catch (error) {
    console.error('Error updating preceptor feedback:', error);
    return NextResponse.json({ success: false, error: 'Failed to update feedback' }, { status: 500 });
  }
}
