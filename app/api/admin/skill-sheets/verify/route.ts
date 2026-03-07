import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SheetQualityIssue {
  id: string;
  skill_name: string;
  program: string;
  source: string;
  issues: string[];
}

interface CanonicalCoverage {
  canonical_name: string;
  canonical_id: string;
  linked_sheets: { id: string; skill_name: string; source: string; program: string }[];
  missing_sources: string[];
}

interface SourceStats {
  source: string;
  total_sheets: number;
  total_steps: number;
  total_with_critical_criteria: number;
  total_with_equipment: number;
  sheets_below_5_steps: number;
  sheets_with_no_steps: number;
  avg_steps_per_sheet: number;
}

// ---------------------------------------------------------------------------
// GET /api/admin/skill-sheets/verify
//
// Comprehensive quality check of imported skill sheets.
// Checks:
//   - Per-sheet: minimum step count, critical criteria, equipment
//   - Canonical coverage: all 41 canonicals have linked sheets
//   - Source stats: totals per source type
//   - Platinum specifics: step count, critical criteria count, EMT competency tagging
//   - AEMT specifics: sheet count and mapping coverage
//
// Requires admin+ role.
// ---------------------------------------------------------------------------
export async function GET() {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  const supabase = getSupabaseAdmin();

  try {
    // ------------------------------------------------------------------
    // 1. Fetch all skill sheets
    // ------------------------------------------------------------------
    const { data: sheets, error: sheetsError } = await supabase
      .from('skill_sheets')
      .select('id, skill_name, program, source, source_priority, equipment, critical_criteria, critical_failures, platinum_skill_type, canonical_skill_id, created_at')
      .order('source', { ascending: true })
      .order('skill_name', { ascending: true });

    if (sheetsError) throw sheetsError;

    // ------------------------------------------------------------------
    // 2. Fetch all skill sheet steps
    // ------------------------------------------------------------------
    const { data: allSteps, error: stepsError } = await supabase
      .from('skill_sheet_steps')
      .select('id, skill_sheet_id, step_number, phase, is_critical');

    if (stepsError) throw stepsError;

    // Build step lookup: sheetId -> steps[]
    const stepsBySheet = new Map<string, typeof allSteps>();
    for (const step of allSteps || []) {
      const existing = stepsBySheet.get(step.skill_sheet_id) || [];
      existing.push(step);
      stepsBySheet.set(step.skill_sheet_id, existing);
    }

    // ------------------------------------------------------------------
    // 3. Fetch all canonical skills
    // ------------------------------------------------------------------
    const { data: canonicalSkills, error: canonError } = await supabase
      .from('canonical_skills')
      .select('id, canonical_name, skill_category, programs, paramedic_only')
      .order('canonical_name', { ascending: true });

    if (canonError) throw canonError;

    // ------------------------------------------------------------------
    // 4. Per-sheet quality checks
    // ------------------------------------------------------------------
    const qualityIssues: SheetQualityIssue[] = [];
    const sourceStatsMap = new Map<string, {
      total_sheets: number;
      total_steps: number;
      total_with_critical_criteria: number;
      total_with_equipment: number;
      sheets_below_5_steps: number;
      sheets_with_no_steps: number;
    }>();

    for (const sheet of sheets || []) {
      const steps = stepsBySheet.get(sheet.id) || [];
      const stepCount = steps.length;
      const issues: string[] = [];

      // Initialize source stats
      if (!sourceStatsMap.has(sheet.source)) {
        sourceStatsMap.set(sheet.source, {
          total_sheets: 0,
          total_steps: 0,
          total_with_critical_criteria: 0,
          total_with_equipment: 0,
          sheets_below_5_steps: 0,
          sheets_with_no_steps: 0,
        });
      }
      const stats = sourceStatsMap.get(sheet.source)!;
      stats.total_sheets++;
      stats.total_steps += stepCount;

      // Check step count
      if (stepCount === 0) {
        issues.push('No steps found');
        stats.sheets_with_no_steps++;
      } else if (stepCount < 5) {
        // Note: Many publisher sheets have fewer than 5 steps intentionally (e.g. simple lifts)
        // We flag but don't treat as critical for publisher source
        if (sheet.source !== 'publisher') {
          issues.push(`Only ${stepCount} steps (expected >= 5)`);
        }
        stats.sheets_below_5_steps++;
      }

      // Check critical criteria (primarily for platinum and nremt sources)
      const hasCriteria = Array.isArray(sheet.critical_criteria) && sheet.critical_criteria.length > 0;
      if (hasCriteria) {
        stats.total_with_critical_criteria++;
      } else if (sheet.source === 'platinum' || sheet.source === 'nremt') {
        issues.push('Missing critical criteria');
      }

      // Check equipment
      const hasEquipment = Array.isArray(sheet.equipment) && sheet.equipment.length > 0;
      if (hasEquipment) {
        stats.total_with_equipment++;
      }

      // Check canonical link
      if (!sheet.canonical_skill_id) {
        issues.push('Not linked to a canonical skill');
      }

      // Platinum-specific: check EMT competency tagging
      if (sheet.source === 'platinum') {
        // Check critical steps exist
        const criticalSteps = steps.filter(s => s.is_critical);
        if (criticalSteps.length === 0 && stepCount > 0) {
          // Not necessarily an issue for all sheets, but flag for review
          // (publisher sheets never have critical steps marked)
        }
      }

      if (issues.length > 0) {
        qualityIssues.push({
          id: sheet.id,
          skill_name: sheet.skill_name,
          program: sheet.program,
          source: sheet.source,
          issues,
        });
      }
    }

    // ------------------------------------------------------------------
    // 5. Build source stats
    // ------------------------------------------------------------------
    const sourceStats: SourceStats[] = [];
    for (const [source, stats] of sourceStatsMap) {
      sourceStats.push({
        source,
        ...stats,
        avg_steps_per_sheet: stats.total_sheets > 0
          ? Math.round((stats.total_steps / stats.total_sheets) * 10) / 10
          : 0,
      });
    }

    // ------------------------------------------------------------------
    // 6. Canonical coverage
    // ------------------------------------------------------------------
    const canonicalCoverage: CanonicalCoverage[] = [];
    const expectedSources = ['nremt', 'platinum', 'publisher'];

    for (const canonical of canonicalSkills || []) {
      const linkedSheets = (sheets || [])
        .filter(s => s.canonical_skill_id === canonical.id)
        .map(s => ({
          id: s.id,
          skill_name: s.skill_name,
          source: s.source,
          program: s.program,
        }));

      const linkedSources = new Set(linkedSheets.map(s => s.source));
      const missingSources = expectedSources.filter(src => !linkedSources.has(src));

      canonicalCoverage.push({
        canonical_name: canonical.canonical_name,
        canonical_id: canonical.id,
        linked_sheets: linkedSheets,
        missing_sources: missingSources,
      });
    }

    const canonicalsWithNoSheets = canonicalCoverage.filter(c => c.linked_sheets.length === 0);
    const canonicalsWithPlatinum = canonicalCoverage.filter(c =>
      c.linked_sheets.some(s => s.source === 'platinum')
    );
    const canonicalsWithPublisher = canonicalCoverage.filter(c =>
      c.linked_sheets.some(s => s.source === 'publisher')
    );
    const canonicalsWithNremt = canonicalCoverage.filter(c =>
      c.linked_sheets.some(s => s.source === 'nremt')
    );

    // ------------------------------------------------------------------
    // 7. Platinum-specific checks
    // ------------------------------------------------------------------
    const platinumSheets = (sheets || []).filter(s => s.source === 'platinum');
    const platinumEmtCompetency = platinumSheets.filter(s => s.platinum_skill_type === 'emt_competency');
    const platinumIndividual = platinumSheets.filter(s => s.platinum_skill_type === 'individual');
    const platinumStepCount = platinumSheets.reduce((sum, s) => sum + (stepsBySheet.get(s.id)?.length || 0), 0);
    const platinumCriteriaCount = platinumSheets.reduce((sum, s) => {
      const criteria = s.critical_criteria as string[] | null;
      const failures = s.critical_failures as string[] | null;
      return sum + (criteria?.length || 0) + (failures?.length || 0);
    }, 0);

    // ------------------------------------------------------------------
    // 8. AEMT-specific checks
    // ------------------------------------------------------------------
    const publisherSheets = (sheets || []).filter(s => s.source === 'publisher');
    const publisherStepCount = publisherSheets.reduce((sum, s) => sum + (stepsBySheet.get(s.id)?.length || 0), 0);

    // ------------------------------------------------------------------
    // 9. Build response
    // ------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      verify: {
        // Summary
        summary: {
          total_skill_sheets: (sheets || []).length,
          total_steps: (allSteps || []).length,
          total_canonical_skills: (canonicalSkills || []).length,
          sheets_with_quality_issues: qualityIssues.length,
          canonical_skills_with_no_sheets: canonicalsWithNoSheets.length,
        },

        // Per-source stats
        source_stats: sourceStats,

        // Canonical coverage
        canonical_coverage: {
          total: (canonicalSkills || []).length,
          with_platinum: canonicalsWithPlatinum.length,
          with_publisher: canonicalsWithPublisher.length,
          with_nremt: canonicalsWithNremt.length,
          with_no_sheets: canonicalsWithNoSheets.length,
          details: canonicalCoverage,
        },

        // Platinum specifics
        platinum: {
          total_sheets: platinumSheets.length,
          expected_sheets: 41,
          total_steps: platinumStepCount,
          expected_steps_approx: 773,
          total_critical_criteria: platinumCriteriaCount,
          expected_criteria_approx: 236,
          emt_competency_count: platinumEmtCompetency.length,
          expected_emt_competency: 25,
          individual_count: platinumIndividual.length,
          emt_competency_titles: platinumEmtCompetency.map(s => s.skill_name),
        },

        // AEMT/Publisher specifics
        publisher: {
          total_sheets: publisherSheets.length,
          expected_sheets: 87,
          total_steps: publisherStepCount,
          linked_to_canonical: publisherSheets.filter(s => s.canonical_skill_id).length,
          unlinked: publisherSheets.filter(s => !s.canonical_skill_id).length,
        },

        // Quality issues
        quality_issues: qualityIssues,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Error verifying skill sheets:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
