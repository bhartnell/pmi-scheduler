import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireStudentContext } from '@/lib/view-as-student';

/**
 * GET /api/student/profile
 * Returns the current student's full profile data.
 * Combines data from lab_users (auth info) and students (program record).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireStudentContext(request);
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();

    if (!auth.found) {
      // Return partial profile from lab_users if no student record yet
      // (this can only happen for a real student, not a view-as session).
      const { data: labUser } = await supabase
        .from('lab_users')
        .select('id, name, email, role')
        .ilike('email', auth.viewerEmail)
        .single();
      return NextResponse.json({
        success: true,
        profile: {
          lab_user: labUser ?? null,
          student: null,
          message: 'Student record not yet linked. Contact your instructor.',
        },
      });
    }

    const labUser = { id: auth.id, name: `${auth.firstName} ${auth.lastName}`, email: auth.email, role: 'student' };

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
        opt_out_non_essential,
        agency,
        status,
        cohort_id,
        created_at,
        cohort:cohorts!students_cohort_id_fkey(
          id,
          cohort_number,
          start_date,
          end_date,
          program:programs(id, name, abbreviation)
        )
      `)
      .eq('id', auth.id)
      .single();

    if (studentError || !student) {
      // Row existed a moment ago (requireStudentContext found it) but the
      // richer select failed — treat the same as not-yet-linked.
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
    const auth = await requireStudentContext(request);
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();

    if (!auth.found) {
      return NextResponse.json(
        { success: false, error: 'Student record not found. Contact your instructor.' },
        { status: 404 }
      );
    }
    const existing = { id: auth.id };

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
        cohort:cohorts!students_cohort_id_fkey(
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
