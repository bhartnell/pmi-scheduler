import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/student/profile
 * Returns the current student's full profile data.
 * Combines data from lab_users (auth info) and students (program record).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Verify this is a student account
    const { data: labUser, error: labUserError } = await supabase
      .from('lab_users')
      .select('id, name, email, role')
      .ilike('email', session.user.email)
      .single();

    if (labUserError || !labUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (labUser.role !== 'student') {
      return NextResponse.json({ success: false, error: 'Student access only' }, { status: 403 });
    }

    // Fetch student record joined with cohort info
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select(`
        id,
        first_name,
        last_name,
        email,
        student_number,
        enrollment_date,
        phone,
        address,
        emergency_contact_name,
        emergency_contact_phone,
        emergency_contact_relationship,
        learning_style,
        preferred_contact_method,
        best_contact_times,
        language_preference,
        contact_opt_out,
        agency,
        status,
        cohort_id,
        created_at,
        cohort:cohorts(
          id,
          cohort_number,
          start_date,
          end_date,
          program:programs(id, name, abbreviation)
        )
      `)
      .ilike('email', session.user.email)
      .single();

    if (studentError || !student) {
      // Return partial profile from lab_users if no student record yet
      return NextResponse.json({
        success: true,
        profile: {
          lab_user: labUser,
          student: null,
          message: 'Student record not yet linked. Contact your instructor.',
        },
      });
    }

    return NextResponse.json({
      success: true,
      profile: {
        lab_user: labUser,
        student,
      },
    });
  } catch (error) {
    console.error('Error fetching student profile:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch profile' }, { status: 500 });
  }
}

/**
 * PUT /api/student/profile
 * Updates the current student's editable profile fields.
 * Only allows updating: phone, address, emergency_contact_name,
 * emergency_contact_phone, emergency_contact_relationship, learning_style.
 * Does NOT allow updates to: name, email, cohort_id, student_number, enrollment_date.
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Verify this is a student account
    const { data: labUser, error: labUserError } = await supabase
      .from('lab_users')
      .select('id, name, email, role')
      .ilike('email', session.user.email)
      .single();

    if (labUserError || !labUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (labUser.role !== 'student') {
      return NextResponse.json({ success: false, error: 'Student access only' }, { status: 403 });
    }

    // Confirm the student record exists and belongs to this user
    const { data: existing, error: existingError } = await supabase
      .from('students')
      .select('id, email')
      .ilike('email', session.user.email)
      .single();

    if (existingError || !existing) {
      return NextResponse.json(
        { success: false, error: 'Student record not found. Contact your instructor.' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Whitelist: only allow these fields to be updated
    const allowed = [
      'phone',
      'address',
      'emergency_contact_name',
      'emergency_contact_phone',
      'emergency_contact_relationship',
      'learning_style',
    ] as const;

    type AllowedField = (typeof allowed)[number];

    const updates: Partial<Record<AllowedField, string | null>> = {};

    for (const field of allowed) {
      if (field in body) {
        const val = body[field];
        // Allow empty string to clear a field (stored as null)
        updates[field] = val === '' ? null : val;
      }
    }

    // Validate learning_style if provided
    const validLearningStyles = ['visual', 'auditory', 'kinesthetic', 'reading'];
    if (
      updates.learning_style !== undefined &&
      updates.learning_style !== null &&
      !validLearningStyles.includes(updates.learning_style)
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid learning style value' },
        { status: 400 }
      );
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from('students')
      .update(updates)
      .eq('id', existing.id)
      .select(`
        id,
        first_name,
        last_name,
        email,
        student_number,
        enrollment_date,
        phone,
        address,
        emergency_contact_name,
        emergency_contact_phone,
        emergency_contact_relationship,
        learning_style,
        cohort_id,
        cohort:cohorts(
          id,
          cohort_number,
          start_date,
          program:programs(id, name, abbreviation)
        )
      `)
      .single();

    if (updateError) {
      console.error('Error updating student profile:', updateError);
      return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 });
    }

    return NextResponse.json({ success: true, student: updated });
  } catch (error) {
    console.error('Error updating student profile:', error);
    return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 });
  }
}
