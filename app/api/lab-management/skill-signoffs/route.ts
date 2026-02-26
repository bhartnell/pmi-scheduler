import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { hasMinRole } from '@/lib/permissions';

// GET /api/lab-management/skill-signoffs
// Query params: ?student_id=X or ?lab_day_id=X or ?skill_id=X
// Returns signoffs with student and skill info. Requires instructor+.
export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const studentId = searchParams.get('student_id');
  const labDayId = searchParams.get('lab_day_id');
  const skillId = searchParams.get('skill_id');

  try {
    // Verify user role
    const supabase = getSupabaseAdmin();
    const { data: userRecord } = await supabase
      .from('lab_users')
      .select('role')
      .eq('email', session.user.email)
      .single();

    if (!userRecord || !hasMinRole(userRecord.role, 'instructor')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let query = supabase
      .from('skill_signoffs')
      .select('*')
      .order('signed_off_at', { ascending: false });

    if (studentId) query = query.eq('student_id', studentId);
    if (labDayId) query = query.eq('lab_day_id', labDayId);
    if (skillId) query = query.eq('skill_id', skillId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, signoffs: data || [] });
  } catch (error) {
    console.error('Error fetching skill signoffs:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch signoffs' }, { status: 500 });
  }
}

// POST /api/lab-management/skill-signoffs
// Body: { student_id, skill_id, lab_day_id?, notes? }
//    OR { student_ids: string[], skill_id, lab_day_id?, notes? } for bulk
// Requires instructor+.
export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: userRecord } = await supabase
      .from('lab_users')
      .select('role')
      .eq('email', session.user.email)
      .single();

    if (!userRecord || !hasMinRole(userRecord.role, 'instructor')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { skill_id, lab_day_id } = body;

    if (!skill_id) {
      return NextResponse.json({ success: false, error: 'skill_id is required' }, { status: 400 });
    }

    // Determine list of student IDs (bulk vs single)
    const studentIds: string[] = Array.isArray(body.student_ids)
      ? body.student_ids
      : body.student_id
        ? [body.student_id]
        : [];

    if (studentIds.length === 0) {
      return NextResponse.json({ success: false, error: 'student_id or student_ids is required' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const rows = studentIds.map((sid) => ({
      student_id: sid,
      skill_id,
      lab_day_id: lab_day_id || null,
      signed_off_by: session.user!.email!,
      signed_off_at: now,
      revoked_by: null,
      revoked_at: null,
      revoke_reason: null,
    }));

    // Upsert: if a record exists and was revoked, restore it. If already signed (not revoked), skip.
    const results: any[] = [];
    const skipped: string[] = [];

    for (const row of rows) {
      // Check for existing signoff
      const { data: existing } = await supabase
        .from('skill_signoffs')
        .select('id, revoked_at')
        .eq('student_id', row.student_id)
        .eq('skill_id', row.skill_id)
        .single();

      if (existing && !existing.revoked_at) {
        // Already signed off and not revoked — skip
        skipped.push(row.student_id);
        continue;
      }

      if (existing && existing.revoked_at) {
        // Was revoked — update to restore
        const { data: updated, error: updateError } = await supabase
          .from('skill_signoffs')
          .update({
            signed_off_by: row.signed_off_by,
            signed_off_at: row.signed_off_at,
            lab_day_id: row.lab_day_id,
            revoked_by: null,
            revoked_at: null,
            revoke_reason: null,
          })
          .eq('id', existing.id)
          .select()
          .single();
        if (updateError) throw updateError;
        if (updated) results.push(updated);
      } else {
        // New signoff
        const { data: inserted, error: insertError } = await supabase
          .from('skill_signoffs')
          .insert(row)
          .select()
          .single();
        if (insertError) throw insertError;
        if (inserted) results.push(inserted);
      }
    }

    return NextResponse.json({
      success: true,
      signoffs: results,
      skipped_count: skipped.length,
    });
  } catch (error) {
    console.error('Error creating skill signoff:', error);
    return NextResponse.json({ success: false, error: 'Failed to create signoff' }, { status: 500 });
  }
}

// PUT /api/lab-management/skill-signoffs
// Body: { id, revoke_reason? }
// Revokes a signoff. Requires lead_instructor+.
export async function PUT(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: userRecord } = await supabase
      .from('lab_users')
      .select('role')
      .eq('email', session.user.email)
      .single();

    if (!userRecord || !hasMinRole(userRecord.role, 'lead_instructor')) {
      return NextResponse.json({ error: 'Forbidden — lead instructor or above required' }, { status: 403 });
    }

    const body = await request.json();
    const { id, revoke_reason } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('skill_signoffs')
      .update({
        revoked_by: session.user.email,
        revoked_at: new Date().toISOString(),
        revoke_reason: revoke_reason || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, signoff: data });
  } catch (error) {
    console.error('Error revoking skill signoff:', error);
    return NextResponse.json({ success: false, error: 'Failed to revoke signoff' }, { status: 500 });
  }
}
