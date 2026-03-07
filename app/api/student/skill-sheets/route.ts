import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/student/skill-sheets
 *
 * Returns the student's skill sheet data:
 *   - All active skills from the skills table
 *   - Signoff status for each skill (from skill_signoffs)
 *   - Linked skill sheets from the skill_sheets/canonical_skills tables (if available)
 *   - Summary stats (X of Y signed off)
 *
 * Access: student role only. Data is always scoped to the requesting student.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Verify user is a student
    const { data: labUser, error: labUserError } = await supabase
      .from('lab_users')
      .select('id, email, role')
      .ilike('email', session.user.email)
      .single();

    if (labUserError || !labUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (labUser.role !== 'student') {
      return NextResponse.json({ success: false, error: 'Student access only' }, { status: 403 });
    }

    // 2. Resolve student record
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select(`
        id,
        first_name,
        last_name,
        email,
        cohort_id,
        cohort:cohorts(
          id,
          cohort_number,
          program:programs(name, abbreviation)
        )
      `)
      .ilike('email', session.user.email)
      .single();

    if (studentError || !student) {
      return NextResponse.json({
        success: true,
        studentFound: false,
        message: 'Student record not found. Please contact your instructor.',
        skills: [],
        summary: { total: 0, signedOff: 0, remaining: 0, percentage: 0 },
      });
    }

    const studentId = student.id;

    // 3. Fetch all active skills
    let skills: any[] = [];
    let categories: string[] = [];

    try {
      const { data: allSkills } = await supabase
        .from('skills')
        .select('id, name, category, description, is_active')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (allSkills && allSkills.length > 0) {
        skills = allSkills;
        categories = [...new Set(allSkills.map((s: any) => s.category || 'other'))].sort();
      }
    } catch {
      // Skills table may not exist yet
    }

    // 4. Fetch all signoffs for this student (only non-revoked)
    let signoffs: any[] = [];
    try {
      const { data: signoffData } = await supabase
        .from('skill_signoffs')
        .select(`
          id,
          skill_id,
          signed_off_by,
          signed_off_at,
          lab_day_id,
          revoked_at,
          lab_day:lab_days(id, date, title)
        `)
        .eq('student_id', studentId)
        .is('revoked_at', null)
        .order('signed_off_at', { ascending: false });

      if (signoffData) {
        signoffs = signoffData;
      }
    } catch {
      // Table may not exist yet
    }

    // 5. Fetch skill sheets (for linking document URLs to skills)
    let skillSheetMap = new Map<string, any>();
    try {
      const { data: sheets } = await supabase
        .from('skill_sheets')
        .select(`
          id,
          skill_name,
          program,
          source,
          overview,
          canonical_skill_id,
          canonical_skill:canonical_skills(id, canonical_name, skill_category)
        `)
        .order('source_priority', { ascending: true });

      if (sheets && sheets.length > 0) {
        // Map by skill name (lowercase) for loose matching
        sheets.forEach((sheet: any) => {
          const key = (sheet.skill_name || '').toLowerCase().trim();
          if (!skillSheetMap.has(key)) {
            skillSheetMap.set(key, sheet);
          }
        });
      }
    } catch {
      // Table may not exist yet
    }

    // 6. Build signoff map keyed by skill_id
    const signoffMap = new Map<string, any>();
    signoffs.forEach((s: any) => {
      signoffMap.set(s.skill_id, s);
    });

    // 7. Enrich skills with signoff status and skill sheet info
    const enrichedSkills = skills.map((skill: any) => {
      const signoff = signoffMap.get(skill.id);
      const sheet = skillSheetMap.get((skill.name || '').toLowerCase().trim());

      return {
        id: skill.id,
        name: skill.name,
        category: skill.category || 'other',
        description: skill.description || null,
        signedOff: !!signoff,
        signedOffAt: signoff?.signed_off_at || null,
        signedOffBy: signoff?.signed_off_by || null,
        labDayDate: signoff?.lab_day ? (signoff.lab_day as any)?.date || null : null,
        labDayTitle: signoff?.lab_day ? (signoff.lab_day as any)?.title || null : null,
        hasSkillSheet: !!sheet,
        skillSheetId: sheet?.id || null,
        skillSheetSource: sheet?.source || null,
        skillSheetOverview: sheet?.overview || null,
      };
    });

    // 8. Summary stats
    const total = enrichedSkills.length;
    const signedOff = enrichedSkills.filter((s) => s.signedOff).length;

    return NextResponse.json({
      success: true,
      studentFound: true,
      student: {
        id: student.id,
        firstName: student.first_name,
        lastName: student.last_name,
        cohort: student.cohort
          ? {
              id: (student.cohort as any).id,
              cohortNumber: (student.cohort as any).cohort_number,
              program: (student.cohort as any).program,
            }
          : null,
      },
      skills: enrichedSkills,
      categories,
      summary: {
        total,
        signedOff,
        remaining: total - signedOff,
        percentage: total > 0 ? Math.round((signedOff / total) * 100) : 0,
      },
    });
  } catch (error) {
    console.error('Error fetching student skill sheets:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch skill sheet data' },
      { status: 500 }
    );
  }
}
