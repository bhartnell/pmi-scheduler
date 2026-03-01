import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/student/communication-preferences
 * Returns the current student's communication preferences.
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

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select(
        'id, preferred_contact_method, best_contact_times, language_preference, contact_opt_out'
      )
      .ilike('email', session.user.email)
      .single();

    if (studentError || !student) {
      return NextResponse.json(
        { success: false, error: 'Student record not found. Contact your instructor.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, preferences: student });
  } catch (error) {
    console.error('Error fetching communication preferences:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch communication preferences' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/student/communication-preferences
 * Updates the current student's communication preferences.
 * Allowed fields: preferred_contact_method, best_contact_times,
 *                 language_preference, contact_opt_out
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

    // Validate preferred_contact_method if provided
    const validContactMethods = ['email', 'phone', 'text', 'in_person'];
    if (
      body.preferred_contact_method !== undefined &&
      body.preferred_contact_method !== null &&
      !validContactMethods.includes(body.preferred_contact_method)
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid contact method value' },
        { status: 400 }
      );
    }

    // Build update object with whitelisted fields only
    const updates: Record<string, string | boolean | null> = {};

    if ('preferred_contact_method' in body) {
      updates.preferred_contact_method = body.preferred_contact_method || 'email';
    }
    if ('best_contact_times' in body) {
      updates.best_contact_times = body.best_contact_times === '' ? null : body.best_contact_times;
    }
    if ('language_preference' in body) {
      updates.language_preference = body.language_preference || 'en';
    }
    if ('contact_opt_out' in body) {
      updates.contact_opt_out = Boolean(body.contact_opt_out);
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
      .select(
        'id, preferred_contact_method, best_contact_times, language_preference, contact_opt_out'
      )
      .single();

    if (updateError) {
      console.error('Error updating communication preferences:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update communication preferences' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, preferences: updated });
  } catch (error) {
    console.error('Error updating communication preferences:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update communication preferences' },
      { status: 500 }
    );
  }
}
