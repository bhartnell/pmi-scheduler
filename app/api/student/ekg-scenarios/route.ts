import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireStudentContext } from '@/lib/view-as-student';

/**
 * GET /api/student/ekg-scenarios
 * Get the current student's EKG scores and scenario participation (or, for
 * an admin viewing as a student, that student's — read-only).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const auth = await requireStudentContext(request);
    if (auth instanceof NextResponse) return auth;

    if (!auth.found) {
      // Student record not found - they might not be in the system yet
      return NextResponse.json({
        success: true,
        ekg_scores: [],
        scenario_participation: [],
        summary: {
          ekg: {
            total_tests: 0,
            avg_score: 0,
            latest_score: null,
            baseline_score: null
          },
          scenarios: {
            total: 0,
            by_role: {
              team_lead: 0,
              med_tech: 0,
              monitor_tech: 0,
              airway_tech: 0,
              observer: 0
            }
          }
        },
        message: 'Student record not found. Please contact your instructor.'
      });
    }
    const student = { id: auth.id, first_name: auth.firstName, last_name: auth.lastName, email: auth.email };

    // Get EKG scores for this student
    const { data: ekgScores, error: ekgError } = await supabase
      .from('ekg_warmup_scores')
      .select('*')
      .eq('student_id', student.id)
      .order('date', { ascending: false });

    if (ekgError) {
      console.error('Error fetching EKG scores:', ekgError);
      return NextResponse.json({ success: false, error: 'Failed to fetch EKG scores' }, { status: 500 });
    }

    // Get scenario participation for this student
    const { data: scenarioParticipation, error: scenarioError } = await supabase
      .from('scenario_participation')
      .select(`
        id,
        scenario_id,
        role,
        date,
        notes,
        created_at,
        scenario:scenarios(id, title, category)
      `)
      .eq('student_id', student.id)
      .order('date', { ascending: false });

    if (scenarioError) {
      console.error('Error fetching scenario participation:', scenarioError);
      return NextResponse.json({ success: false, error: 'Failed to fetch scenario participation' }, { status: 500 });
    }

    // Calculate EKG summary statistics
    const totalTests = ekgScores?.length || 0;
    let avgScore = 0;
    let latestScore = null;
    let baselineScore = null;

    if (ekgScores && ekgScores.length > 0) {
      // Calculate average score as percentage
      const totalPercent = ekgScores.reduce((sum, test) => {
        return sum + (test.score / test.max_score) * 100;
      }, 0);
      avgScore = Math.round(totalPercent / ekgScores.length);

      // Get latest score
      const latest = ekgScores[0];
      latestScore = {
        score: latest.score,
        max_score: latest.max_score,
        percentage: Math.round((latest.score / latest.max_score) * 100),
        date: latest.date
      };

      // Find baseline score
      const baseline = ekgScores.find(test => test.is_baseline);
      if (baseline) {
        baselineScore = {
          score: baseline.score,
          max_score: baseline.max_score,
          percentage: Math.round((baseline.score / baseline.max_score) * 100),
          date: baseline.date
        };
      }
    }

    // Calculate scenario participation by role
    const byRole = {
      team_lead: 0,
      med_tech: 0,
      monitor_tech: 0,
      airway_tech: 0,
      observer: 0
    };

    if (scenarioParticipation) {
      scenarioParticipation.forEach(participation => {
        const role = participation.role as keyof typeof byRole;
        if (role in byRole) {
          byRole[role]++;
        }
      });
    }

    return NextResponse.json({
      success: true,
      student: {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name
      },
      ekg_scores: ekgScores || [],
      scenario_participation: scenarioParticipation || [],
      summary: {
        ekg: {
          total_tests: totalTests,
          avg_score: avgScore,
          latest_score: latestScore,
          baseline_score: baselineScore
        },
        scenarios: {
          total: scenarioParticipation?.length || 0,
          by_role: byRole
        }
      }
    });
  } catch (error) {
    console.error('Error fetching student EKG and scenario data:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch student data' }, { status: 500 });
  }
}
