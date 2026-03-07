import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { ACHIEVEMENTS } from '@/lib/achievements';

// ---------------------------------------------------------------------------
// GET /api/cases/achievements/[studentId]
//
// Returns all achievements for a student, both earned and unearned.
// Students can only view their own achievements.
// Instructors+ can view any student's achievements.
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const { studentId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Check authorization
    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('id, role')
      .ilike('email', session.user.email)
      .single();

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isInstructor = hasMinRole(currentUser.role, 'instructor');

    // If not an instructor, verify the student is viewing their own achievements
    if (!isInstructor) {
      const { data: studentRecord } = await supabase
        .from('students')
        .select('id')
        .ilike('email', session.user.email)
        .single();

      if (!studentRecord || studentRecord.id !== studentId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Fetch earned achievements
    const { data: earned, error: earnedError } = await supabase
      .from('student_achievements')
      .select('id, achievement_type, achievement_name, earned_at, metadata')
      .eq('student_id', studentId)
      .order('earned_at', { ascending: false });

    if (earnedError) {
      throw earnedError;
    }

    // Build a set of earned achievement types
    const earnedTypes = new Set(
      (earned || []).map((a: { achievement_type: string }) => a.achievement_type)
    );

    // Map earned achievements with full definition info
    const earnedAchievements = (earned || []).map((a: {
      id: string;
      achievement_type: string;
      achievement_name: string;
      earned_at: string;
      metadata: Record<string, unknown>;
    }) => {
      const def = ACHIEVEMENTS.find((d) => d.type === a.achievement_type);
      return {
        id: a.id,
        type: a.achievement_type,
        name: def?.name || a.achievement_name,
        description: def?.description || '',
        icon: def?.icon || '🏅',
        category: def?.category || 'completion',
        earned: true,
        earned_at: a.earned_at,
        metadata: a.metadata,
      };
    });

    // Build unearned achievements list
    const unearnedAchievements = ACHIEVEMENTS
      .filter((a) => !earnedTypes.has(a.type))
      .map((a) => ({
        id: null,
        type: a.type,
        name: a.name,
        description: a.description,
        icon: a.icon,
        category: a.category,
        earned: false,
        earned_at: null,
        metadata: null,
      }));

    // Combine and group by category
    const allAchievements = [...earnedAchievements, ...unearnedAchievements];

    const grouped: Record<string, typeof allAchievements> = {
      completion: [],
      mastery: [],
      performance: [],
      streak: [],
    };

    for (const a of allAchievements) {
      const cat = a.category as keyof typeof grouped;
      if (grouped[cat]) {
        grouped[cat].push(a);
      }
    }

    return NextResponse.json({
      achievements: allAchievements,
      grouped,
      stats: {
        total: ACHIEVEMENTS.length,
        earned: earnedTypes.size,
      },
    });
  } catch (error) {
    console.error('Error fetching achievements:', error);
    return NextResponse.json({ error: 'Failed to fetch achievements' }, { status: 500 });
  }
}
