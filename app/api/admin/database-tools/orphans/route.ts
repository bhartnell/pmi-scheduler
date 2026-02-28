import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isSuperadmin } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// Helper – resolve current user from session email
// ---------------------------------------------------------------------------
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, role')
    .ilike('email', email)
    .single();
  return data;
}

// ---------------------------------------------------------------------------
// GET /api/admin/database-tools/orphans
//
// Scans for orphaned records referencing non-existent parent records.
// Checks:
//   - lab_day_students without matching lab_days
//   - skill_signoffs without matching students
//   - user_notifications without matching lab_users
//
// Returns counts by type.
// Requires superadmin role.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !isSuperadmin(currentUser.role)) {
      return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    // Run all orphan checks in parallel using raw SQL via rpc or individual queries
    // We use the Supabase client for each check separately

    // 1. lab_day_students without matching lab_days
    const { data: labDayStudents, error: err1 } = await supabase
      .from('lab_day_students')
      .select('id, lab_day_id');

    if (err1) throw err1;

    const { data: labDays, error: err2 } = await supabase
      .from('lab_days')
      .select('id');

    if (err2) throw err2;

    const labDayIds = new Set((labDays ?? []).map((r) => r.id));
    const orphanedLabDayStudents = (labDayStudents ?? []).filter(
      (r) => !labDayIds.has(r.lab_day_id)
    );

    // 2. skill_signoffs without matching students
    const { data: skillSignoffs, error: err3 } = await supabase
      .from('skill_signoffs')
      .select('id, student_id');

    if (err3) throw err3;

    const { data: students, error: err4 } = await supabase
      .from('students')
      .select('id');

    if (err4) throw err4;

    const studentIds = new Set((students ?? []).map((r) => r.id));
    const orphanedSkillSignoffs = (skillSignoffs ?? []).filter(
      (r) => !studentIds.has(r.student_id)
    );

    // 3. user_notifications without matching lab_users
    const { data: notifications, error: err5 } = await supabase
      .from('user_notifications')
      .select('id, user_id');

    if (err5) throw err5;

    const { data: labUsers, error: err6 } = await supabase
      .from('lab_users')
      .select('id');

    if (err6) throw err6;

    const labUserIds = new Set((labUsers ?? []).map((r) => r.id));
    const orphanedNotifications = (notifications ?? []).filter(
      (r) => !labUserIds.has(r.user_id)
    );

    const orphans = [
      {
        type: 'lab_day_students',
        description: 'Lab day student assignments without matching lab days',
        count: orphanedLabDayStudents.length,
        ids: orphanedLabDayStudents.map((r) => r.id),
      },
      {
        type: 'skill_signoffs',
        description: 'Skill signoffs without matching students',
        count: orphanedSkillSignoffs.length,
        ids: orphanedSkillSignoffs.map((r) => r.id),
      },
      {
        type: 'user_notifications',
        description: 'Notifications without matching users',
        count: orphanedNotifications.length,
        ids: orphanedNotifications.map((r) => r.id),
      },
    ];

    const totalOrphans = orphans.reduce((sum, o) => sum + o.count, 0);

    return NextResponse.json({
      success: true,
      orphans,
      totalOrphans,
    });
  } catch (error) {
    console.error('Error scanning for orphans:', error);
    return NextResponse.json({ error: 'Failed to scan for orphaned records' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/database-tools/orphans
//
// Query params:
//   ?dry_run=true - preview only (default true)
//   ?types=lab_day_students,skill_signoffs,user_notifications - which types to clean
//
// Removes orphaned records. Requires superadmin role.
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !isSuperadmin(currentUser.role)) {
      return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dry_run') !== 'false';
    const typesParam = searchParams.get('types');
    const selectedTypes = typesParam
      ? typesParam.split(',').map((t) => t.trim())
      : ['lab_day_students', 'skill_signoffs', 'user_notifications'];

    // First, re-scan to get the IDs to delete
    const supabase = getSupabaseAdmin();

    const results: { type: string; count: number }[] = [];

    if (selectedTypes.includes('lab_day_students')) {
      const { data: labDayStudents } = await supabase
        .from('lab_day_students')
        .select('id, lab_day_id');
      const { data: labDays } = await supabase.from('lab_days').select('id');
      const labDayIds = new Set((labDays ?? []).map((r) => r.id));
      const orphanIds = (labDayStudents ?? [])
        .filter((r) => !labDayIds.has(r.lab_day_id))
        .map((r) => r.id);

      if (!dryRun && orphanIds.length > 0) {
        await supabase.from('lab_day_students').delete().in('id', orphanIds);
      }
      results.push({ type: 'lab_day_students', count: orphanIds.length });
    }

    if (selectedTypes.includes('skill_signoffs')) {
      const { data: skillSignoffs } = await supabase
        .from('skill_signoffs')
        .select('id, student_id');
      const { data: students } = await supabase.from('students').select('id');
      const studentIds = new Set((students ?? []).map((r) => r.id));
      const orphanIds = (skillSignoffs ?? [])
        .filter((r) => !studentIds.has(r.student_id))
        .map((r) => r.id);

      if (!dryRun && orphanIds.length > 0) {
        await supabase.from('skill_signoffs').delete().in('id', orphanIds);
      }
      results.push({ type: 'skill_signoffs', count: orphanIds.length });
    }

    if (selectedTypes.includes('user_notifications')) {
      const { data: notifications } = await supabase
        .from('user_notifications')
        .select('id, user_id');
      const { data: labUsers } = await supabase.from('lab_users').select('id');
      const labUserIds = new Set((labUsers ?? []).map((r) => r.id));
      const orphanIds = (notifications ?? [])
        .filter((r) => !labUserIds.has(r.user_id))
        .map((r) => r.id);

      if (!dryRun && orphanIds.length > 0) {
        await supabase.from('user_notifications').delete().in('id', orphanIds);
      }
      results.push({ type: 'user_notifications', count: orphanIds.length });
    }

    const totalCleaned = results.reduce((sum, r) => sum + r.count, 0);

    return NextResponse.json({
      success: true,
      dryRun,
      results,
      totalCleaned,
    });
  } catch (error) {
    console.error('Error cleaning orphaned records:', error);
    return NextResponse.json({ error: 'Failed to clean orphaned records' }, { status: 500 });
  }
}
