import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { logAuditEvent } from '@/lib/audit';

async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id: studentId } = await params;
    const supabase = getSupabaseAdmin();

    // -----------------------------------------------
    // Access control: instructor+ can view any student,
    // students can view their own evaluations
    // -----------------------------------------------
    if (!hasMinRole(currentUser.role, 'instructor')) {
      if (currentUser.role === 'student') {
        // Check if this student's email matches the session email
        const { data: studentRecord } = await supabase
          .from('students')
          .select('id, email')
          .eq('id', studentId)
          .single();

        if (
          !studentRecord ||
          studentRecord.email?.toLowerCase() !== session.user.email.toLowerCase()
        ) {
          return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }
      } else {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    }

    // -----------------------------------------------
    // Fetch all evaluations for this student
    // -----------------------------------------------
    const { data: evaluations, error: evalError } = await supabase
      .from('student_skill_evaluations')
      .select(`
        id,
        skill_sheet_id,
        lab_day_id,
        evaluation_type,
        result,
        evaluator_id,
        notes,
        flagged_items,
        created_at,
        team_role,
        team_evaluation_id
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (evalError) {
      if (evalError.message?.includes('does not exist')) {
        return NextResponse.json({ success: true, groups: [] });
      }
      throw evalError;
    }

    if (!evaluations || evaluations.length === 0) {
      return NextResponse.json({ success: true, groups: [] });
    }

    // -----------------------------------------------
    // Fetch related skill sheets
    // -----------------------------------------------
    const skillSheetIds = [...new Set(evaluations.map(e => e.skill_sheet_id))];

    const { data: skillSheets, error: sheetsError } = await supabase
      .from('skill_sheets')
      .select(`
        id,
        skill_name,
        program,
        source,
        canonical_skill_id
      `)
      .in('id', skillSheetIds);

    if (sheetsError && !sheetsError.message?.includes('does not exist')) {
      throw sheetsError;
    }

    const sheetMap: Record<string, {
      id: string;
      skill_name: string;
      program: string;
      source: string;
      canonical_skill_id: string | null;
    }> = {};
    for (const sheet of skillSheets || []) {
      sheetMap[sheet.id] = sheet;
    }

    // -----------------------------------------------
    // Fetch related canonical skills
    // -----------------------------------------------
    const canonicalSkillIds = [
      ...new Set(
        (skillSheets || [])
          .map(s => s.canonical_skill_id)
          .filter((id): id is string => id != null)
      ),
    ];

    const canonicalMap: Record<string, {
      id: string;
      canonical_name: string;
      skill_category: string;
    }> = {};

    if (canonicalSkillIds.length > 0) {
      const { data: canonicalSkills, error: canonError } = await supabase
        .from('canonical_skills')
        .select('id, canonical_name, skill_category')
        .in('id', canonicalSkillIds);

      if (canonError && !canonError.message?.includes('does not exist')) {
        throw canonError;
      }

      for (const cs of canonicalSkills || []) {
        canonicalMap[cs.id] = cs;
      }
    }

    // -----------------------------------------------
    // Fetch evaluator info
    // -----------------------------------------------
    const evaluatorIds = [
      ...new Set(
        evaluations
          .map(e => e.evaluator_id)
          .filter((id): id is string => id != null)
      ),
    ];

    const evaluatorMap: Record<string, { name: string; email: string }> = {};

    if (evaluatorIds.length > 0) {
      const { data: evaluators, error: evalUsersError } = await supabase
        .from('lab_users')
        .select('id, name, email')
        .in('id', evaluatorIds);

      if (evalUsersError && !evalUsersError.message?.includes('does not exist')) {
        throw evalUsersError;
      }

      for (const ev of evaluators || []) {
        evaluatorMap[ev.id] = { name: ev.name, email: ev.email };
      }
    }

    // -----------------------------------------------
    // Fetch team leader names for assistant evaluations
    // -----------------------------------------------
    const teamEvalIds = evaluations
      .filter(e => e.team_evaluation_id)
      .map(e => e.team_evaluation_id as string);

    const teamLeaderMap: Record<string, string> = {};
    if (teamEvalIds.length > 0) {
      // Get the leader evaluations
      const { data: leaderEvals } = await supabase
        .from('student_skill_evaluations')
        .select('id, student_id')
        .in('id', teamEvalIds);

      if (leaderEvals && leaderEvals.length > 0) {
        const leaderStudentIds = [...new Set(leaderEvals.map(e => e.student_id))];
        const { data: leaderStudents } = await supabase
          .from('students')
          .select('id, first_name, last_name')
          .in('id', leaderStudentIds);

        const studentNameMap: Record<string, string> = {};
        for (const s of leaderStudents || []) {
          studentNameMap[s.id] = `${s.last_name}, ${s.first_name}`;
        }

        for (const le of leaderEvals || []) {
          teamLeaderMap[le.id] = studentNameMap[le.student_id] || 'Unknown';
        }
      }
    }

    // -----------------------------------------------
    // Group evaluations by canonical_skill_id
    // -----------------------------------------------
    const UNCATEGORIZED_KEY = '__uncategorized__';

    const groupMap: Record<
      string,
      {
        canonical_skill: { id: string; canonical_name: string; skill_category: string } | null;
        evaluations: Array<Record<string, unknown>>;
      }
    > = {};

    for (const evaluation of evaluations) {
      const sheet = sheetMap[evaluation.skill_sheet_id];
      const canonicalSkillId = sheet?.canonical_skill_id || UNCATEGORIZED_KEY;
      const canonicalSkill =
        canonicalSkillId !== UNCATEGORIZED_KEY
          ? canonicalMap[canonicalSkillId] || null
          : null;

      if (!groupMap[canonicalSkillId]) {
        groupMap[canonicalSkillId] = {
          canonical_skill: canonicalSkill,
          evaluations: [],
        };
      }

      const evaluator = evaluation.evaluator_id
        ? evaluatorMap[evaluation.evaluator_id] || { name: 'Unknown', email: '' }
        : { name: 'Unknown', email: '' };

      // Team info
      let teamInfo: { team_role: string; leader_name?: string } | null = null;
      if (evaluation.team_role) {
        teamInfo = { team_role: evaluation.team_role };
        if (evaluation.team_role === 'assistant' && evaluation.team_evaluation_id) {
          teamInfo.leader_name = teamLeaderMap[evaluation.team_evaluation_id] || undefined;
        }
      }

      groupMap[canonicalSkillId].evaluations.push({
        id: evaluation.id,
        skill_sheet_id: evaluation.skill_sheet_id,
        lab_day_id: evaluation.lab_day_id,
        evaluation_type: evaluation.evaluation_type,
        result: evaluation.result,
        notes: evaluation.notes,
        flagged_items: evaluation.flagged_items,
        created_at: evaluation.created_at,
        skill_sheet: sheet
          ? {
              id: sheet.id,
              skill_name: sheet.skill_name,
              program: sheet.program,
              source: sheet.source,
            }
          : null,
        evaluator,
        team_info: teamInfo,
      });
    }

    // Convert groupMap to array, sorted by canonical_name
    const groups = Object.values(groupMap).sort((a, b) => {
      const nameA = a.canonical_skill?.canonical_name || 'Uncategorized';
      const nameB = b.canonical_skill?.canonical_name || 'Uncategorized';
      return nameA.localeCompare(nameB);
    });

    // FERPA audit: log student evaluation access
    logAuditEvent({
      user: { id: currentUser.id, email: currentUser.email, role: currentUser.role },
      action: 'evaluation_viewed',
      resourceType: 'skill_evaluation',
      resourceId: studentId,
      resourceDescription: `Viewed skill evaluations for student ${studentId} (${evaluations.length} evaluations)`,
      metadata: { studentId, evaluationCount: evaluations.length },
    }).catch(console.error);

    return NextResponse.json({ success: true, groups });
  } catch (error) {
    console.error('Error fetching student skill evaluations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch student skill evaluations' },
      { status: 500 }
    );
  }
}
