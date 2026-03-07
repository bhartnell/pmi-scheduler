// ---------------------------------------------------------------------------
// Achievement Definitions & Checking Logic
// Task 89: Gamification — Leaderboards, Badges, Stats
// ---------------------------------------------------------------------------

export interface AchievementDefinition {
  type: string;
  name: string;
  description: string;
  icon: string;
  category: 'completion' | 'mastery' | 'performance' | 'streak';
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  // Completion
  {
    type: 'first_responder',
    name: 'First Responder',
    description: 'Score 90%+ on first attempt',
    icon: '🏅',
    category: 'completion',
  },
  {
    type: 'persistent_learner',
    name: 'Persistent Learner',
    description: 'Improve score by 20%+ on a retry',
    icon: '📈',
    category: 'completion',
  },
  {
    type: 'completionist',
    name: 'Completionist',
    description: 'Complete every case in the library',
    icon: '🏆',
    category: 'completion',
  },
  {
    type: 'speed_medic',
    name: 'Speed Medic',
    description: 'Complete a case under estimated time with 80%+ accuracy',
    icon: '⚡',
    category: 'completion',
  },

  // Category mastery
  {
    type: 'cardiac_master',
    name: 'Cardiac Master',
    description: 'Complete all cardiac cases with 80%+',
    icon: '❤️',
    category: 'mastery',
  },
  {
    type: 'trauma_master',
    name: 'Trauma Master',
    description: 'Complete all trauma cases with 80%+',
    icon: '🦴',
    category: 'mastery',
  },
  {
    type: 'respiratory_master',
    name: 'Respiratory Master',
    description: 'Complete all respiratory cases with 80%+',
    icon: '🫁',
    category: 'mastery',
  },
  {
    type: 'peds_master',
    name: 'Pediatric Master',
    description: 'Complete all pediatric cases with 80%+',
    icon: '👶',
    category: 'mastery',
  },
  {
    type: 'medical_master',
    name: 'Medical Master',
    description: 'Complete all medical cases with 80%+',
    icon: '💊',
    category: 'mastery',
  },
  {
    type: 'ob_master',
    name: 'OB Master',
    description: 'Complete all OB cases with 80%+',
    icon: '🤱',
    category: 'mastery',
  },

  // Performance
  {
    type: 'protocol_perfect',
    name: 'Protocol Perfect',
    description: '100% on treatment questions in a case',
    icon: '✅',
    category: 'performance',
  },
  {
    type: 'scene_safety_first',
    name: 'Scene Safety First',
    description: 'Never miss a scene safety question across 10+ cases',
    icon: '🛡️',
    category: 'performance',
  },

  // Streak
  {
    type: 'hot_streak',
    name: 'Hot Streak',
    description: '5 cases in a row with 80%+ score',
    icon: '🔥',
    category: 'streak',
  },
  {
    type: 'daily_practice',
    name: 'Daily Practice',
    description: 'Complete at least 1 case per day for 7 days',
    icon: '📅',
    category: 'streak',
  },
];

// Map for quick lookup by type
const ACHIEVEMENT_MAP = new Map(ACHIEVEMENTS.map((a) => [a.type, a]));

export function getAchievementDefinition(type: string): AchievementDefinition | undefined {
  return ACHIEVEMENT_MAP.get(type);
}

// ---------------------------------------------------------------------------
// Category-to-mastery-type mapping
// ---------------------------------------------------------------------------
const CATEGORY_MASTERY: Record<string, string> = {
  Cardiac: 'cardiac_master',
  Trauma: 'trauma_master',
  Respiratory: 'respiratory_master',
  Peds: 'peds_master',
  Medical: 'medical_master',
  OB: 'ob_master',
};

// ---------------------------------------------------------------------------
// checkAchievements — called after a case is completed
// ---------------------------------------------------------------------------

interface SupabaseClient {
  from(table: string): any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * Check all achievement conditions for a student after completing a case.
 * Awards any newly earned achievements and returns the list of new ones.
 */
export async function checkAchievements(
  supabase: SupabaseClient,
  studentId: string,
  caseId: string,
  score: number,
  maxScore: number,
  timeTakenSeconds: number
): Promise<AchievementDefinition[]> {
  const newlyEarned: AchievementDefinition[] = [];
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  // 1. Get existing achievements for this student
  const { data: existingAchievements } = await supabase
    .from('student_achievements')
    .select('achievement_type')
    .eq('student_id', studentId);

  const earnedTypes = new Set(
    (existingAchievements || []).map((a: { achievement_type: string }) => a.achievement_type)
  );

  // Helper: award an achievement if not already earned
  async function award(type: string, metadata: Record<string, unknown> = {}) {
    if (earnedTypes.has(type)) return;
    const def = ACHIEVEMENT_MAP.get(type);
    if (!def) return;

    await supabase.from('student_achievements').insert({
      student_id: studentId,
      achievement_type: type,
      achievement_name: def.name,
      metadata: { case_id: caseId, ...metadata },
    });

    earnedTypes.add(type);
    newlyEarned.push(def);
  }

  // -----------------------------------------------------------------------
  // COMPLETION achievements
  // -----------------------------------------------------------------------

  // first_responder: Score 90%+ on first attempt
  if (!earnedTypes.has('first_responder') && percentage >= 90) {
    // Check that this is attempt 1 for this case
    const { data: attempts } = await supabase
      .from('case_practice_progress')
      .select('attempt_number')
      .eq('student_id', studentId)
      .eq('case_id', caseId)
      .eq('status', 'completed')
      .order('attempt_number', { ascending: true })
      .limit(1);

    if (attempts && attempts.length > 0 && attempts[0].attempt_number === 1) {
      await award('first_responder', { score: percentage });
    }
  }

  // persistent_learner: Improve score by 20%+ on a retry
  if (!earnedTypes.has('persistent_learner')) {
    const { data: prevAttempts } = await supabase
      .from('case_practice_progress')
      .select('total_points, max_points, attempt_number')
      .eq('student_id', studentId)
      .eq('case_id', caseId)
      .eq('status', 'completed')
      .order('attempt_number', { ascending: true });

    if (prevAttempts && prevAttempts.length >= 2) {
      // Compare latest attempt to worst prior attempt
      const scores = prevAttempts.map((a: { total_points: number; max_points: number }) =>
        a.max_points > 0 ? Math.round((a.total_points / a.max_points) * 100) : 0
      );
      const minPrev = Math.min(...scores.slice(0, -1));
      const latest = scores[scores.length - 1];
      if (latest - minPrev >= 20) {
        await award('persistent_learner', {
          previous_score: minPrev,
          new_score: latest,
        });
      }
    }
  }

  // completionist: Complete every case in the library
  if (!earnedTypes.has('completionist')) {
    const { count: totalCases } = await supabase
      .from('case_studies')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .or('is_published.eq.true,visibility.eq.official');

    const { data: completedCases } = await supabase
      .from('case_practice_progress')
      .select('case_id')
      .eq('student_id', studentId)
      .eq('status', 'completed');

    const uniqueCompleted = new Set(
      (completedCases || []).map((c: { case_id: string }) => c.case_id)
    );

    if (totalCases && totalCases > 0 && uniqueCompleted.size >= totalCases) {
      await award('completionist', { total_cases: totalCases });
    }
  }

  // speed_medic: Complete case under estimated time with 80%+ accuracy
  if (!earnedTypes.has('speed_medic') && percentage >= 80) {
    const { data: caseData } = await supabase
      .from('case_studies')
      .select('estimated_duration_minutes')
      .eq('id', caseId)
      .single();

    if (caseData?.estimated_duration_minutes) {
      const estimatedSeconds = caseData.estimated_duration_minutes * 60;
      if (timeTakenSeconds < estimatedSeconds) {
        await award('speed_medic', {
          time_taken: timeTakenSeconds,
          estimated: estimatedSeconds,
          score: percentage,
        });
      }
    }
  }

  // -----------------------------------------------------------------------
  // MASTERY achievements — one per category
  // -----------------------------------------------------------------------
  for (const [category, achievementType] of Object.entries(CATEGORY_MASTERY)) {
    if (earnedTypes.has(achievementType)) continue;

    // Get all active cases in this category
    const { data: categoryCases } = await supabase
      .from('case_studies')
      .select('id')
      .eq('category', category)
      .eq('is_active', true)
      .or('is_published.eq.true,visibility.eq.official');

    if (!categoryCases || categoryCases.length === 0) continue;

    const caseIds = categoryCases.map((c: { id: string }) => c.id);

    // Get best score per case for this student
    const { data: progress } = await supabase
      .from('case_practice_progress')
      .select('case_id, total_points, max_points')
      .eq('student_id', studentId)
      .eq('status', 'completed')
      .in('case_id', caseIds);

    if (!progress) continue;

    // Group by case_id, take best score per case
    const bestByCase = new Map<string, number>();
    for (const p of progress as Array<{ case_id: string; total_points: number; max_points: number }>) {
      const pct = p.max_points > 0 ? Math.round((p.total_points / p.max_points) * 100) : 0;
      const current = bestByCase.get(p.case_id) ?? 0;
      if (pct > current) bestByCase.set(p.case_id, pct);
    }

    // Check: all category cases completed with 80%+
    const allMastered = caseIds.every((id: string) => (bestByCase.get(id) ?? 0) >= 80);
    if (allMastered) {
      await award(achievementType, { category, case_count: caseIds.length });
    }
  }

  // -----------------------------------------------------------------------
  // PERFORMANCE achievements
  // -----------------------------------------------------------------------

  // protocol_perfect: 100% on treatment questions in a case
  // (check if all questions in completed case scored perfectly)
  if (!earnedTypes.has('protocol_perfect') && percentage === 100) {
    await award('protocol_perfect', { score: 100 });
  }

  // scene_safety_first: Never miss a scene safety question across 10+ cases
  if (!earnedTypes.has('scene_safety_first')) {
    // Count completed cases
    const { data: completedProgress } = await supabase
      .from('case_practice_progress')
      .select('case_id')
      .eq('student_id', studentId)
      .eq('status', 'completed');

    const completedCaseIds = new Set(
      (completedProgress || []).map((p: { case_id: string }) => p.case_id)
    );

    if (completedCaseIds.size >= 10) {
      // Check for any incorrect scene safety responses
      // We look for responses in phase IDs containing "scene" with is_correct = false
      const { data: incorrectSafety } = await supabase
        .from('case_responses')
        .select('id')
        .eq('student_id', studentId)
        .eq('is_correct', false)
        .ilike('phase_id', '%scene%')
        .limit(1);

      if (!incorrectSafety || incorrectSafety.length === 0) {
        await award('scene_safety_first', { cases_completed: completedCaseIds.size });
      }
    }
  }

  // -----------------------------------------------------------------------
  // STREAK achievements
  // -----------------------------------------------------------------------

  // hot_streak: 5 cases in a row with 80%+ score
  if (!earnedTypes.has('hot_streak')) {
    const { data: recentCompleted } = await supabase
      .from('case_practice_progress')
      .select('total_points, max_points')
      .eq('student_id', studentId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(5);

    if (recentCompleted && recentCompleted.length >= 5) {
      const allAbove80 = recentCompleted.every(
        (r: { total_points: number; max_points: number }) =>
          r.max_points > 0 && Math.round((r.total_points / r.max_points) * 100) >= 80
      );
      if (allAbove80) {
        await award('hot_streak', { streak_count: 5 });
      }
    }
  }

  // daily_practice: Complete at least 1 case per day for 7 days
  if (!earnedTypes.has('daily_practice')) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentDays } = await supabase
      .from('case_practice_progress')
      .select('completed_at')
      .eq('student_id', studentId)
      .eq('status', 'completed')
      .gte('completed_at', sevenDaysAgo.toISOString())
      .order('completed_at', { ascending: true });

    if (recentDays && recentDays.length >= 7) {
      // Count distinct days
      const uniqueDays = new Set(
        recentDays
          .filter((r: { completed_at: string | null }) => r.completed_at)
          .map((r: { completed_at: string }) => r.completed_at.substring(0, 10))
      );
      if (uniqueDays.size >= 7) {
        await award('daily_practice', { consecutive_days: 7 });
      }
    }
  }

  return newlyEarned;
}
