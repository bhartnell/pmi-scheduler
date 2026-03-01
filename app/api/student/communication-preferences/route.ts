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
        'id, preferred_contact_method, best_contact_times, language_preference, opt_out_non_essential'
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
 *                 language_preference, opt_out_non_essential
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
    const updates: Record<string, string | string[] | boolean | null> = {};

    if ('preferred_contact_method' in body) {
      updates.preferred_contact_method = body.preferred_contact_method || null;
    }
    if ('best_contact_times' in body) {
      // best_contact_times is TEXT[] in the database.
      // Accept either an array or a comma-separated string from the client.
      const val = body.best_contact_times;
      if (val === '' || val === null || val === undefined) {
        updates.best_contact_times = null;
      } else if (Array.isArray(val)) {
        updates.best_contact_times = val.length === 0 ? null : val;
      } else {
        const parts = String(val).split(',').map((s: string) => s.trim()).filter(Boolean);
        updates.best_contact_times = parts.length === 0 ? null : parts;
      }
    }
    if ('language_preference' in body) {
      updates.language_preference = body.language_preference || 'en';
    }
    if ('opt_out_non_essential' in body) {
      updates.opt_out_non_essential = Boolean(body.opt_out_non_essential);
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
        'id, preferred_contact_method, best_contact_times, language_preference, opt_out_non_essential'
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
