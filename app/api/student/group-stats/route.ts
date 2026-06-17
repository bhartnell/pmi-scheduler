import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/student/group-stats
 *
 * Privacy-scoped GROUP AGGREGATE for the authenticated student's own lab group.
 * Returns ONLY aggregates (member count + averages) — never individual members'
 * names or per-student rows — so a student can compare themselves to their
 * group without seeing other individuals' progress.
 *
 * Access: student role only; implicitly scoped to the caller's own group
 * (resolved from their lab_group_members row). A student can't request another
 * group's stats.
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = getSupabaseAdmin();

    const { data: labUser } = await supabase
      .from('lab_users')
      .select('id, role')
      .ilike('email', session.user.email)
      .single();
    if (!labUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (labUser.role !== 'student') return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const { data: student } = await supabase
      .from('students')
      .select('id')
      .ilike('email', session.user.email)
      .single();
    if (!student) return NextResponse.json({ success: true, group: null });

    // The caller's lab group (a student is in exactly one — unique on student_id).
    const { data: membership } = await supabase
      .from('lab_group_members')
      .select('lab_group_id, lab_group:lab_groups(id, name)')
      .eq('student_id', student.id)
      .maybeSingle();
    if (!membership?.lab_group_id) return NextResponse.json({ success: true, group: null });

    const groupId = membership.lab_group_id;
    const { data: members } = await supabase
      .from('lab_group_members')
      .select('student_id')
      .eq('lab_group_id', groupId);
    const memberIds = (members || []).map(m => m.student_id);
    const memberCount = memberIds.length;
    if (memberCount === 0) return NextResponse.json({ success: true, group: null });

    // Aggregate over members — counts/sums only, no per-student exposure.
    const [scenRes, skillRes, tlRes] = await Promise.all([
      supabase.from('scenario_assessments').select('team_lead_id, overall_score').in('team_lead_id', memberIds),
      supabase.from('skill_signoffs').select('student_id').in('student_id', memberIds).is('revoked_at', null),
      supabase.from('team_lead_log').select('student_id').in('student_id', memberIds),
    ]);

    const scen = scenRes.data || [];
    const scenScores = scen.map(s => s.overall_score).filter((v): v is number => typeof v === 'number');
    const skills = skillRes.data || [];
    const tl = tlRes.data || [];

    const avg = (total: number) => Math.round((total / memberCount) * 10) / 10;

    return NextResponse.json({
      success: true,
      group: {
        id: groupId,
        name: (membership.lab_group as { name?: string } | null)?.name || 'Your group',
        memberCount,
      },
      averages: {
        scenariosAssessed: avg(scen.length),
        scenarioScore: scenScores.length ? Math.round((scenScores.reduce((a, b) => a + b, 0) / scenScores.length) * 10) / 10 : 0,
        skillsCompleted: avg(skills.length),
        teamLeadCount: avg(tl.length),
      },
    });
  } catch (error) {
    console.error('Error fetching group stats:', error);
    return NextResponse.json({ error: 'Failed to fetch group stats' }, { status: 500 });
  }
}
