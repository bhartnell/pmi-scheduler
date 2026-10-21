import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/audit';

// GET: programs with their default roster + every active instructor (for the checklist).
export async function GET() {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;
    const supabase = getSupabaseAdmin();

    const [programs, roster, users] = await Promise.all([
      supabase.from('programs').select('id, name, abbreviation').eq('is_active', true).order('name'),
      supabase.from('program_default_instructors').select('program_id, user_id'),
      supabase
        .from('lab_users')
        .select('id, name, email, role, is_part_time')
        .eq('is_active', true)
        .in('role', ['superadmin', 'admin', 'lead_instructor', 'program_director', 'instructor', 'volunteer_instructor'])
        .order('name'),
    ]);
    const err = programs.error || roster.error || users.error;
    if (err) return NextResponse.json({ success: false, error: err.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      programs: programs.data,
      roster: roster.data,
      instructors: users.data,
    });
  } catch (e) {
    console.error('program-rosters GET', e);
    return NextResponse.json({ success: false, error: 'Failed to load rosters' }, { status: 500 });
  }
}

// PUT { programId, userId, selected }: add or remove one instructor from a program roster.
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const { programId, userId, selected } = await request.json();
    if (!programId || !userId || typeof selected !== 'boolean') {
      return NextResponse.json({ success: false, error: 'programId, userId, selected required' }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();

    const { error } = selected
      ? await supabase
          .from('program_default_instructors')
          .upsert(
            { program_id: programId, user_id: userId, added_by: user.email, source: 'admin-ui' },
            { onConflict: 'program_id,user_id', ignoreDuplicates: true },
          )
      : await supabase
          .from('program_default_instructors')
          .delete()
          .eq('program_id', programId)
          .eq('user_id', userId);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    logAuditEvent({
      user: { id: user.id, email: user.email, role: user.role },
      action: 'update',
      resourceType: 'program_default_instructors',
      resourceId: programId,
      resourceDescription: `Default roster ${selected ? 'add' : 'remove'} for user ${userId}`,
      metadata: { programId, userId, selected },
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('program-rosters PUT', e);
    return NextResponse.json({ success: false, error: 'Failed to update roster' }, { status: 500 });
  }
}
