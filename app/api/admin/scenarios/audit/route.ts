import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// Helper – resolve current user
// ---------------------------------------------------------------------------
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// ---------------------------------------------------------------------------
// Types for audit results
// ---------------------------------------------------------------------------
interface FieldStat {
  field: string;
  populated: number;
  empty: number;
  percent: number;
}

interface PhaseAnalysis {
  has_phases: number;
  no_phases: number;
  avg_phase_count: number;
  phases_as_array: number;
  phases_as_other: number;
  phases_with_vitals: number;
  phases_with_expected_actions: number;
  phases_with_presentation_notes: number;
  sample_phase_structures: unknown[];
}

interface CriticalActionsAnalysis {
  has_critical_actions: number;
  as_object_array: number;
  as_string_array: number;
  as_other: number;
  sample_structures: unknown[];
}

interface VitalsAnalysis {
  has_initial_vitals: number;
  vitals_as_object: number;
  vitals_with_bp: number;
  vitals_with_hr: number;
  vitals_with_full_xabcde: number;
  sample_structures: unknown[];
}

interface ScenarioIssue {
  id: string;
  title: string;
  issues: string[];
  category: string | null;
  difficulty: string | null;
  has_phases: boolean;
  phase_count: number;
  has_vitals: boolean;
  has_chief_complaint: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// GET /api/admin/scenarios/audit
//
// Audits all scenarios in the database and returns a comprehensive report
// of data structure, missing fields, and quality issues.
// Requires admin+ role.
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch ALL scenarios with all fields
    const { data: scenarios, error } = await supabase
      .from('scenarios')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!scenarios || scenarios.length === 0) {
      return NextResponse.json({
        success: true,
        audit: {
          total: 0,
          message: 'No scenarios found in database',
        },
      });
    }

    // --- Field population stats ---
    const criticalFields = [
      'title', 'chief_complaint', 'category', 'difficulty',
      'dispatch_location', 'dispatch_notes',
      'patient_name', 'patient_age', 'patient_sex',
      'phases', 'initial_vitals', 'critical_actions',
      'learning_objectives', 'debrief_points',
      'equipment_needed', 'instructor_notes',
      'assessment_x', 'assessment_a', 'assessment_b', 'assessment_c', 'assessment_d', 'assessment_e',
      'sample_history', 'opqrst',
      'medications', 'medical_history', 'allergies',
      'general_impression', 'applicable_programs',
    ];

    const fieldStats: FieldStat[] = criticalFields.map(field => {
      let populated = 0;
      for (const s of scenarios) {
        const val = s[field];
        if (val === null || val === undefined) continue;
        if (typeof val === 'string' && val.trim() === '') continue;
        if (Array.isArray(val) && val.length === 0) continue;
        if (typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0) continue;
        populated++;
      }
      return {
        field,
        populated,
        empty: scenarios.length - populated,
        percent: Math.round((populated / scenarios.length) * 100),
      };
    });

    // --- Phases analysis ---
    const phaseAnalysis: PhaseAnalysis = {
      has_phases: 0,
      no_phases: 0,
      avg_phase_count: 0,
      phases_as_array: 0,
      phases_as_other: 0,
      phases_with_vitals: 0,
      phases_with_expected_actions: 0,
      phases_with_presentation_notes: 0,
      sample_phase_structures: [],
    };

    let totalPhaseCount = 0;
    const samplePhasesCollected = new Set<string>();

    for (const s of scenarios) {
      const phases = s.phases;
      if (!phases || (Array.isArray(phases) && phases.length === 0)) {
        phaseAnalysis.no_phases++;
        continue;
      }

      phaseAnalysis.has_phases++;

      if (Array.isArray(phases)) {
        phaseAnalysis.phases_as_array++;
        totalPhaseCount += phases.length;

        for (const p of phases) {
          if (p && typeof p === 'object') {
            if (p.vitals && typeof p.vitals === 'object' && Object.keys(p.vitals).length > 0) {
              phaseAnalysis.phases_with_vitals++;
              break; // count per scenario, not per phase
            }
          }
        }

        for (const p of phases) {
          if (p && typeof p === 'object' && p.expected_actions) {
            phaseAnalysis.phases_with_expected_actions++;
            break;
          }
        }

        for (const p of phases) {
          if (p && typeof p === 'object' && p.presentation_notes) {
            phaseAnalysis.phases_with_presentation_notes++;
            break;
          }
        }

        // Collect sample structure (first phase of first few unique structures)
        if (phases[0] && samplePhasesCollected.size < 5) {
          const keys = Object.keys(phases[0]).sort().join(',');
          if (!samplePhasesCollected.has(keys)) {
            samplePhasesCollected.add(keys);
            phaseAnalysis.sample_phase_structures.push({
              scenario_title: s.title,
              phase_keys: Object.keys(phases[0]),
              phase_count: phases.length,
              first_phase_preview: truncateObj(phases[0], 200),
            });
          }
        }
      } else {
        phaseAnalysis.phases_as_other++;
        if (phaseAnalysis.sample_phase_structures.length < 2) {
          phaseAnalysis.sample_phase_structures.push({
            scenario_title: s.title,
            type: typeof phases,
            preview: truncateObj(phases, 200),
          });
        }
      }
    }

    phaseAnalysis.avg_phase_count =
      phaseAnalysis.phases_as_array > 0
        ? Math.round((totalPhaseCount / phaseAnalysis.phases_as_array) * 10) / 10
        : 0;

    // --- Critical Actions analysis ---
    const criticalActionsAnalysis: CriticalActionsAnalysis = {
      has_critical_actions: 0,
      as_object_array: 0,
      as_string_array: 0,
      as_other: 0,
      sample_structures: [],
    };

    for (const s of scenarios) {
      const ca = s.critical_actions;
      if (!ca || (Array.isArray(ca) && ca.length === 0)) continue;

      criticalActionsAnalysis.has_critical_actions++;

      if (Array.isArray(ca)) {
        if (ca.length > 0 && typeof ca[0] === 'object' && ca[0] !== null) {
          criticalActionsAnalysis.as_object_array++;
        } else if (ca.length > 0 && typeof ca[0] === 'string') {
          criticalActionsAnalysis.as_string_array++;
        }
      } else {
        criticalActionsAnalysis.as_other++;
      }

      if (criticalActionsAnalysis.sample_structures.length < 3) {
        criticalActionsAnalysis.sample_structures.push({
          scenario_title: s.title,
          type: Array.isArray(ca) ? `array[${ca.length}]` : typeof ca,
          first_item: Array.isArray(ca) ? ca[0] : ca,
        });
      }
    }

    // --- Initial Vitals analysis ---
    const vitalsAnalysis: VitalsAnalysis = {
      has_initial_vitals: 0,
      vitals_as_object: 0,
      vitals_with_bp: 0,
      vitals_with_hr: 0,
      vitals_with_full_xabcde: 0,
      sample_structures: [],
    };

    for (const s of scenarios) {
      const v = s.initial_vitals;
      if (!v) continue;

      vitalsAnalysis.has_initial_vitals++;

      if (typeof v === 'object' && !Array.isArray(v)) {
        vitalsAnalysis.vitals_as_object++;
        if (v.bp) vitalsAnalysis.vitals_with_bp++;
        if (v.hr || v.pulse) vitalsAnalysis.vitals_with_hr++;
        if (v.hemorrhage_control && v.airway_status && v.expose_findings) {
          vitalsAnalysis.vitals_with_full_xabcde++;
        }
      }

      if (vitalsAnalysis.sample_structures.length < 3) {
        vitalsAnalysis.sample_structures.push({
          scenario_title: s.title,
          keys: typeof v === 'object' ? Object.keys(v) : typeof v,
          preview: truncateObj(v, 200),
        });
      }
    }

    // --- Category breakdown ---
    const categoryBreakdown: Record<string, number> = {};
    const difficultyBreakdown: Record<string, number> = {};
    const programBreakdown: Record<string, number> = {};

    for (const s of scenarios) {
      const cat = s.category || 'null';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;

      const diff = s.difficulty || 'null';
      difficultyBreakdown[diff] = (difficultyBreakdown[diff] || 0) + 1;

      const progs = s.applicable_programs;
      if (Array.isArray(progs)) {
        for (const p of progs) {
          programBreakdown[p] = (programBreakdown[p] || 0) + 1;
        }
      }
    }

    // --- Identify problematic scenarios ---
    const issues: ScenarioIssue[] = [];

    for (const s of scenarios) {
      const scenarioIssues: string[] = [];

      // Check critical missing fields
      if (!s.chief_complaint) scenarioIssues.push('Missing chief_complaint');
      if (!s.category) scenarioIssues.push('Missing category');
      if (!s.dispatch_location && !s.dispatch_notes) scenarioIssues.push('Missing dispatch info');
      if (!s.patient_name && !s.patient_age) scenarioIssues.push('Missing patient info');

      // Check phases
      const phases = s.phases;
      const hasPhases = Array.isArray(phases) && phases.length > 0;
      if (!hasPhases) {
        scenarioIssues.push('No phases defined');
      } else {
        // Check phase quality
        const firstPhase = phases[0];
        if (firstPhase && typeof firstPhase === 'object') {
          if (!firstPhase.vitals || Object.keys(firstPhase.vitals || {}).length === 0) {
            scenarioIssues.push('Phase 1 missing vitals');
          }
          if (!firstPhase.expected_actions && !firstPhase.presentation_notes) {
            scenarioIssues.push('Phase 1 missing actions/notes');
          }
          // Check for old-format phases (have phase_number instead of name)
          if (firstPhase.phase_number !== undefined && !firstPhase.name) {
            scenarioIssues.push('Phases use old format (phase_number instead of name)');
          }
          // Check for flat vitals (just bp/pulse/resp vs full XABCDE)
          if (firstPhase.vitals && typeof firstPhase.vitals === 'object') {
            const vk = Object.keys(firstPhase.vitals);
            if (vk.length > 0 && !vk.includes('hemorrhage_control') && !vk.includes('airway_status')) {
              scenarioIssues.push('Phase vitals use simple format (missing XABCDE fields)');
            }
          }
        }
      }

      // Check vitals
      if (!s.initial_vitals) {
        scenarioIssues.push('Missing initial_vitals');
      }

      // Check XABCDE
      if (!s.assessment_x && !s.assessment_a) {
        scenarioIssues.push('Missing XABCDE assessment fields');
      }

      // Check grading
      const ca = s.critical_actions;
      if (!ca || (Array.isArray(ca) && ca.length === 0)) {
        scenarioIssues.push('No critical_actions');
      } else if (Array.isArray(ca) && ca.length > 0 && typeof ca[0] === 'string') {
        scenarioIssues.push('critical_actions are strings (should be {id, description} objects)');
      }

      if (!s.learning_objectives || (Array.isArray(s.learning_objectives) && s.learning_objectives.length === 0)) {
        scenarioIssues.push('No learning_objectives');
      }

      if (!s.debrief_points || (Array.isArray(s.debrief_points) && s.debrief_points.length === 0)) {
        scenarioIssues.push('No debrief_points');
      }

      if (scenarioIssues.length > 0) {
        issues.push({
          id: s.id,
          title: s.title,
          issues: scenarioIssues,
          category: s.category,
          difficulty: s.difficulty,
          has_phases: hasPhases,
          phase_count: hasPhases ? phases.length : 0,
          has_vitals: !!s.initial_vitals,
          has_chief_complaint: !!s.chief_complaint,
          created_at: s.created_at,
        });
      }
    }

    // Sort issues by severity (most issues first)
    issues.sort((a, b) => b.issues.length - a.issues.length);

    // --- Issue frequency ---
    const issueFrequency: Record<string, number> = {};
    for (const iss of issues) {
      for (const i of iss.issues) {
        issueFrequency[i] = (issueFrequency[i] || 0) + 1;
      }
    }

    // Sort by frequency
    const sortedIssueFrequency = Object.entries(issueFrequency)
      .sort((a, b) => b[1] - a[1])
      .map(([issue, count]) => ({ issue, count, percent: Math.round((count / scenarios.length) * 100) }));

    // --- Build 3 raw scenario samples for inspection ---
    const rawSamples = scenarios.slice(0, 3).map(s => ({
      id: s.id,
      title: s.title,
      category: s.category,
      difficulty: s.difficulty,
      chief_complaint: s.chief_complaint,
      applicable_programs: s.applicable_programs,
      patient_name: s.patient_name,
      patient_age: s.patient_age,
      phases_type: s.phases ? (Array.isArray(s.phases) ? `array[${s.phases.length}]` : typeof s.phases) : 'null',
      phases_preview: s.phases ? truncateObj(s.phases, 500) : null,
      initial_vitals: s.initial_vitals ? truncateObj(s.initial_vitals, 300) : null,
      critical_actions_type: s.critical_actions ? (Array.isArray(s.critical_actions) ? `array[${s.critical_actions.length}]` : typeof s.critical_actions) : 'null',
      critical_actions_preview: s.critical_actions ? truncateObj(s.critical_actions, 300) : null,
      sample_history: s.sample_history,
      opqrst: s.opqrst,
      assessment_x: s.assessment_x,
      assessment_a: s.assessment_a,
      created_at: s.created_at,
    }));

    return NextResponse.json({
      success: true,
      audit: {
        total: scenarios.length,
        active: scenarios.filter(s => s.is_active).length,
        inactive: scenarios.filter(s => !s.is_active).length,

        field_stats: fieldStats,
        category_breakdown: categoryBreakdown,
        difficulty_breakdown: difficultyBreakdown,
        program_breakdown: programBreakdown,

        phases: phaseAnalysis,
        critical_actions: criticalActionsAnalysis,
        vitals: vitalsAnalysis,

        issue_frequency: sortedIssueFrequency,
        problematic_scenarios: issues.length,
        clean_scenarios: scenarios.length - issues.length,
        issues: issues.slice(0, 50), // First 50 most problematic

        raw_samples: rawSamples,
      },
    });
  } catch (error) {
    console.error('Error auditing scenarios:', error);
    return NextResponse.json({ error: 'Failed to audit scenarios' }, { status: 500 });
  }
}

// Helper to truncate large objects for preview
function truncateObj(obj: unknown, maxLen: number): unknown {
  const str = JSON.stringify(obj);
  if (str.length <= maxLen) return obj;
  try {
    return JSON.parse(str.substring(0, maxLen) + '..."truncated"}');
  } catch {
    return str.substring(0, maxLen) + '...(truncated)';
  }
}
