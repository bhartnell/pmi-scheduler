import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole, isSuperadmin, canManageStudentRoster } from '@/lib/permissions';
import { requireAuth } from '@/lib/api-auth';
import { createDeletionRequestIfAbsent } from '@/lib/deletion-requests';

async function getCallerRole(email: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', email)
    .single();
  return data?.role ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user, session } = auth;

  const callerRole = await getCallerRole(session.user.email);
  if (!callerRole || !hasMinRole(callerRole, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('students')
      .select(`
        *,
        cohort:cohorts!students_cohort_id_fkey(
          id,
          cohort_number,
          program:programs(name, abbreviation)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    const { count: teamLeadCount } = await supabase
      .from('team_lead_log')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', id);

    const { data: lastTL } = await supabase
      .from('team_lead_log')
      .select('date')
      .eq('student_id', id)
      .order('date', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({ 
      success: true, 
      student: {
        ...data,
        team_lead_count: teamLeadCount || 0,
        last_team_lead_date: lastTL?.date || null
      }
    });
  } catch (error) {
    console.error('Error fetching student:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch student' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user, session } = auth;

  const callerRole = await getCallerRole(session.user.email);
  if (!callerRole || !hasMinRole(callerRole, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const body = await request.json();

    const allowedFields: Record<string, unknown> = {};
    if (body.first_name !== undefined) allowedFields.first_name = body.first_name;
    if (body.last_name !== undefined) allowedFields.last_name = body.last_name;
    if (body.email !== undefined) allowedFields.email = body.email;
    if (body.phone !== undefined) allowedFields.phone = body.phone;
    if (body.cohort_id !== undefined) allowedFields.cohort_id = body.cohort_id;
    let statusChangedTo: string | null = null;
    if (body.status !== undefined) {
      // Lifecycle status (active/withdrawn/graduated/on_hold) is
      // FERPA-adjacent — restrict actually CHANGING it to lead_instructor+,
      // same as the dedicated /withdraw, /graduate, /transfer, /re-enroll
      // routes. The generic edit form always round-trips the current
      // status even when the caller only touched an unrelated field
      // (notes, phone, scrub size…), so only gate on a real change —
      // otherwise every save from a plain instructor would 403.
      const { data: current } = await supabase
        .from('students')
        .select('status')
        .eq('id', id)
        .single();
      if (current && current.status !== body.status && !canManageStudentRoster(callerRole)) {
        return NextResponse.json(
          { error: 'Forbidden — lead instructor or above required to change student status' },
          { status: 403 }
        );
      }
      if (current && current.status !== body.status) {
        statusChangedTo = body.status;
      }
      allowedFields.status = body.status;
    }
    if (body.notes !== undefined) allowedFields.notes = body.notes;
    if (body.photo_url !== undefined) allowedFields.photo_url = body.photo_url;
    if (body.scrub_top_size !== undefined) allowedFields.scrub_top_size = body.scrub_top_size;
    if (body.scrub_bottom_size !== undefined) allowedFields.scrub_bottom_size = body.scrub_bottom_size;
    // Day-1 intake fields — coordinator captures these at first
    // introduction. Stored on the canonical student row so they
    // persist through cohort moves and graduation. See
    // /academics/cohorts/[id]/intake for the entry surface.
    if (body.prior_cert_level !== undefined) allowedFields.prior_cert_level = body.prior_cert_level;
    if (body.agency !== undefined) allowedFields.agency = body.agency;
    if (body.removed_from_cohort !== undefined) allowedFields.removed_from_cohort = body.removed_from_cohort;
    if (body.removed_at !== undefined) allowedFields.removed_at = body.removed_at;
    if (body.removed_reason !== undefined) allowedFields.removed_reason = body.removed_reason;

    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('students')
      .update(allowedFields)
      .eq('id', id)
      .select(`
        *,
        cohort:cohorts!students_cohort_id_fkey(
          id,
          cohort_number,
          program:programs(name, abbreviation)
        )
      `)
      .single();

    if (error) throw error;

    // This generic edit path can change lifecycle status directly
    // (e.g. the status dropdown on the student edit form), bypassing
    // the dedicated /withdraw and /graduate routes' enrollment sync.
    // Mirror that sync here so an active student_program_enrollments
    // row never goes stale — a stale 'active' row blocks a later
    // re-enroll via the one_active_enrollment_per_student constraint.
    if (statusChangedTo === 'withdrawn' || statusChangedTo === 'graduated') {
      const { error: enrollErr } = await supabase
        .from('student_program_enrollments')
        .update({
          status: statusChangedTo,
          end_date: new Date().toISOString().slice(0, 10),
          updated_at: new Date().toISOString(),
        })
        .eq('student_id', id)
        .eq('status', 'active');
      if (enrollErr) {
        console.error('[students PATCH] enrollment sync failed', enrollErr);
      }
    }

    return NextResponse.json({ success: true, student: data });
  } catch (error) {
    console.error('Error updating student:', error);
    return NextResponse.json({ success: false, error: 'Failed to update student' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user, session } = auth;

  const callerRole = await getCallerRole(session.user.email);
  if (!callerRole || !isSuperadmin(callerRole)) {
    // Non-superadmin: queue a deletion request so it reaches the admin approval
    // queue (instead of silently 403-ing with nothing recorded).
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { data: s } = await supabase.from('students').select('first_name, last_name').eq('id', id).maybeSingle();
    await createDeletionRequestIfAbsent(supabase, {
      itemType: 'student', itemId: id,
      itemName: s ? `${s.first_name} ${s.last_name}`.trim() : id, requestedBy: user.id,
    });
    return NextResponse.json({ error: 'Student deletion requires superadmin approval via deletion requests' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting student:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete student' }, { status: 500 });
  }
}
