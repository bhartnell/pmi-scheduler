import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// Pass threshold: overall_score >= 3 (matches scenario-analytics convention)
const PASS_THRESHOLD = 3;
// Difficulty ordering for raise/lower logic
const DIFFICULTY_ORDER = ['basic', 'easy', 'beginner', 'intermediate', 'medium', 'advanced', 'hard', 'expert'];

// Given a difficulty string, return the next step up or down
function adjustDifficulty(current: string, direction: 'raise' | 'lower'): string | null {
  const normalized = (current || '').toLowerCase().trim();
  const idx = DIFFICULTY_ORDER.indexOf(normalized);
  if (idx === -1) return null;

  if (direction === 'raise') {
    // Skip synonyms — jump from basic group to intermediate group to advanced group
    // Simple approach: move two positions up if moving between major groups
    const next = idx + 1;
    if (next >= DIFFICULTY_ORDER.length) return null; // already at max
    return DIFFICULTY_ORDER[next];
  } else {
    const prev = idx - 1;
    if (prev < 0) return null; // already at min
    return DIFFICULTY_ORDER[prev];
  }
}

// Helper to get current user with role
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// GET /api/lab-management/scenarios/[id]/difficulty-recommendation
// Analyze scenario performance data and return a difficulty adjustment recommendation
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !hasMinRole(currentUser.role, 'instructor')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch the scenario to get current difficulty
    const { data: scenario, error: scenarioError } = await supabase
      .from('scenarios')
      .select('id, title, difficulty')
      .eq('id', id)
      .single();

    if (scenarioError || !scenario) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    // Find all lab_stations that use this scenario
    const { data: stations, error: stationsError } = await supabase
      .from('lab_stations')
      .select('id')
      .eq('scenario_id', id);

    if (stationsError) throw stationsError;

    const stationIds = (stations || []).map((s: { id: string }) => s.id);

    // If no stations, there can be no assessments
    if (stationIds.length === 0) {
      return NextResponse.json({
        success: true,
        current_difficulty: scenario.difficulty,
        recommended_difficulty: null,
        pass_rate: null,
        average_score: null,
        total_assessments: 0,
        recommendation_text: 'This scenario has not been used in any lab station yet. No performance data available.',
        confidence: 'none',
      });
    }

    // Fetch all assessments for those stations
    const { data: assessments, error: assessmentsError } = await supabase
      .from('scenario_assessments')
      .select('id, overall_score, issue_level')
      .in('lab_station_id', stationIds);

    if (assessmentsError) throw assessmentsError;

    const total = (assessments || []).length;

    // Not enough data threshold
    const MIN_ASSESSMENTS = 5;

    if (total < MIN_ASSESSMENTS) {
      return NextResponse.json({
        success: true,
        current_difficulty: scenario.difficulty,
        recommended_difficulty: null,
        pass_rate: null,
        average_score: null,
        total_assessments: total,
        recommendation_text: `Not enough data to make a recommendation. At least ${MIN_ASSESSMENTS} assessments are needed (${total} recorded so far).`,
        confidence: 'none',
      });
    }

    // Aggregate scores and pass counts
    let totalScore = 0;
    let scoreCount = 0;
    let passCount = 0;

    (assessments || []).forEach((a: { overall_score: number | null; issue_level: string | null }) => {
      if (a.overall_score !== null && a.overall_score !== undefined) {
        totalScore += a.overall_score;
        scoreCount += 1;
        if (a.overall_score >= PASS_THRESHOLD) {
          passCount += 1;
        }
      } else {
        // No numeric score: use issue_level as proxy — 'none' = pass
        const issueLevel = a.issue_level || 'none';
        if (issueLevel === 'none') {
          passCount += 1;
        }
      }
    });

    const passRate = Math.round((passCount / total) * 100);
    const averageScore = scoreCount > 0 ? Math.round((totalScore / scoreCount) * 10) / 10 : null;

    const currentDifficulty = (scenario.difficulty || '').toLowerCase().trim();

    // Determine recommendation direction
    let direction: 'raise' | 'lower' | 'keep' = 'keep';
    let recommendationText = '';
    let recommendedDifficulty: string | null = null;
    let confidence: 'high' | 'medium' | 'low' | 'none' = 'low';

    if (passRate < 60) {
      direction = 'lower';
      const candidate = adjustDifficulty(currentDifficulty, 'lower');
      recommendedDifficulty = candidate ?? currentDifficulty;
      if (passRate < 40) {
        confidence = 'high';
        recommendationText = `Pass rate is very low at ${passRate}%. Students are struggling significantly with this scenario. Consider lowering the difficulty${candidate ? ` to "${candidate}"` : ''} or reviewing the critical actions and grading criteria.`;
      } else {
        confidence = 'medium';
        recommendationText = `Pass rate of ${passRate}% is below the 60% threshold. This scenario may be slightly too challenging for the current cohort. Consider lowering the difficulty${candidate ? ` to "${candidate}"` : ''}.`;
      }
    } else if (passRate > 95) {
      direction = 'raise';
      const candidate = adjustDifficulty(currentDifficulty, 'raise');
      recommendedDifficulty = candidate ?? currentDifficulty;
      if (passRate === 100) {
        confidence = 'high';
        recommendationText = `All students are passing this scenario (100% pass rate). The scenario may be too easy. Consider raising the difficulty${candidate ? ` to "${candidate}"` : ''} or adding additional critical actions.`;
      } else {
        confidence = 'medium';
        recommendationText = `Pass rate of ${passRate}% is very high. The scenario may not be challenging enough. Consider raising the difficulty${candidate ? ` to "${candidate}"` : ''}.`;
      }
    } else {
      direction = 'keep';
      recommendedDifficulty = null;
      confidence = passRate >= 70 && passRate <= 90 ? 'high' : 'medium';
      recommendationText = `Pass rate of ${passRate}% falls within the acceptable range (60–95%). The current difficulty level appears appropriate for this scenario.`;
    }

    return NextResponse.json({
      success: true,
      current_difficulty: scenario.difficulty,
      recommended_difficulty: recommendedDifficulty,
      direction,
      pass_rate: passRate,
      average_score: averageScore,
      total_assessments: total,
      pass_count: passCount,
      fail_count: total - passCount,
      recommendation_text: recommendationText,
      confidence,
    });
  } catch (error) {
    console.error('Error generating difficulty recommendation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate recommendation' },
      { status: 500 }
    );
  }
}

// POST /api/lab-management/scenarios/[id]/difficulty-recommendation
// Apply the recommended difficulty change: save a version snapshot, then update the scenario
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !hasMinRole(currentUser.role, 'lead_instructor')) {
      return NextResponse.json(
        { error: 'Insufficient permissions — lead instructor or above required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { new_difficulty } = body;

    if (!new_difficulty || typeof new_difficulty !== 'string') {
      return NextResponse.json({ error: 'new_difficulty is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch current scenario to snapshot
    const { data: currentScenario, error: fetchError } = await supabase
      .from('scenarios')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !currentScenario) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    const oldDifficulty = currentScenario.difficulty;
    const normalizedNew = new_difficulty.toLowerCase().trim();

    if (oldDifficulty === normalizedNew) {
      return NextResponse.json({ error: 'New difficulty is the same as current difficulty' }, { status: 400 });
    }

    // Get next version number
    const { data: maxRow } = await supabase
      .from('scenario_versions')
      .select('version_number')
      .eq('scenario_id', id)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();

    const nextVersion = maxRow ? maxRow.version_number + 1 : 1;

    // Save current state as a version before changing difficulty
    const { error: versionError } = await supabase
      .from('scenario_versions')
      .insert({
        scenario_id: id,
        version_number: nextVersion,
        data: currentScenario,
        created_by: session.user.email,
        change_summary: `Difficulty auto-adjusted from "${oldDifficulty}" to "${normalizedNew}" based on performance data`,
      });

    if (versionError) {
      console.error('Error saving version snapshot:', versionError);
      // Non-fatal: continue with the update
    }

    // Update the scenario difficulty
    const { data: updatedScenario, error: updateError } = await supabase
      .from('scenarios')
      .update({
        difficulty: normalizedNew,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      scenario: updatedScenario,
      previous_difficulty: oldDifficulty,
      new_difficulty: normalizedNew,
      version_saved: !versionError,
    });
  } catch (error) {
    console.error('Error applying difficulty recommendation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to apply difficulty change' },
      { status: 500 }
    );
  }
}
