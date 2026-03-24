// PUBLIC: No auth required — token-based poll access
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/ride-along-poll/[token] — fetch poll details (no auth)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = getSupabaseAdmin();

    const { data: poll, error } = await supabase
      .from('ride_along_polls')
      .select('*')
      .eq('token', token)
      .single();

    if (error || !poll) {
      return NextResponse.json(
        { success: false, error: 'Poll not found' },
        { status: 404 }
      );
    }

    if (poll.status === 'closed') {
      return NextResponse.json(
        { success: false, error: 'This poll has been closed', poll: { title: poll.title, status: 'closed' } },
        { status: 410 }
      );
    }

    if (poll.deadline && new Date(poll.deadline) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'This poll has passed its deadline', poll: { title: poll.title, status: 'closed' } },
        { status: 410 }
      );
    }

    // Get cohort info if available
    let cohortLabel = '';
    if (poll.cohort_id) {
      const { data: cohort } = await supabase
        .from('cohorts')
        .select('cohort_number, program:programs(abbreviation)')
        .eq('id', poll.cohort_id)
        .single();
      if (cohort) {
        const prog = Array.isArray(cohort.program) ? cohort.program[0] : cohort.program;
        cohortLabel = `${prog?.abbreviation || 'EMT'} Group ${cohort.cohort_number}`;
      }
    }

    // Get semester info if available
    let semesterLabel = '';
    if (poll.semester_id) {
      const { data: semester } = await supabase
        .from('semesters')
        .select('name')
        .eq('id', poll.semester_id)
        .single();
      if (semester) {
        semesterLabel = semester.name;
      }
    }

    return NextResponse.json({
      success: true,
      poll: {
        id: poll.id,
        title: poll.title,
        deadline: poll.deadline,
        status: poll.status,
        cohort_id: poll.cohort_id,
        semester_id: poll.semester_id,
        cohortLabel,
        semesterLabel,
      },
    });
  } catch (error) {
    console.error('Error fetching ride-along poll:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch poll' },
      { status: 500 }
    );
  }
}

// POST /api/ride-along-poll/[token] — submit availability (no auth)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = getSupabaseAdmin();

    // Verify poll exists and is active
    const { data: poll, error: pollError } = await supabase
      .from('ride_along_polls')
      .select('*')
      .eq('token', token)
      .single();

    if (pollError || !poll) {
      return NextResponse.json(
        { success: false, error: 'Poll not found' },
        { status: 404 }
      );
    }

    if (poll.status === 'closed') {
      return NextResponse.json(
        { success: false, error: 'This poll has been closed' },
        { status: 410 }
      );
    }

    if (poll.deadline && new Date(poll.deadline) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'This poll has passed its deadline' },
        { status: 410 }
      );
    }

    const body = await request.json();
    const { first_name, last_name, email, available_days, preferred_shift_type, unavailable_dates, notes } = body;

    if (!first_name || !last_name || !email) {
      return NextResponse.json(
        { success: false, error: 'Name and email are required' },
        { status: 400 }
      );
    }

    // Match student by email
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .ilike('email', email.trim())
      .single();

    if (!student) {
      return NextResponse.json(
        { success: false, error: 'No student found with that email address. Please use your @my.pmi.edu email.' },
        { status: 404 }
      );
    }

    // Check if student already submitted for this poll's cohort/semester
    let matchQuery = supabase
      .from('ride_along_availability')
      .select('id')
      .eq('student_id', student.id);

    if (poll.cohort_id) matchQuery = matchQuery.eq('cohort_id', poll.cohort_id);
    if (poll.semester_id) matchQuery = matchQuery.eq('semester_id', poll.semester_id);

    const { data: existing } = await matchQuery.maybeSingle();

    const availabilityData = {
      available_days: available_days || {},
      preferred_shift_type: preferred_shift_type || [],
      unavailable_dates: unavailable_dates || [],
      notes: notes || null,
    };

    if (existing) {
      // Update existing
      const { error: updateError } = await supabase
        .from('ride_along_availability')
        .update(availabilityData)
        .eq('id', existing.id);

      if (updateError) throw updateError;

      return NextResponse.json({ success: true, updated: true });
    } else {
      // Insert new
      const { error: insertError } = await supabase
        .from('ride_along_availability')
        .insert({
          student_id: student.id,
          cohort_id: poll.cohort_id || null,
          semester_id: poll.semester_id || null,
          ...availabilityData,
        });

      if (insertError) throw insertError;

      return NextResponse.json({ success: true, updated: false });
    }
  } catch (error) {
    console.error('Error submitting ride-along availability:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit availability' },
      { status: 500 }
    );
  }
}
