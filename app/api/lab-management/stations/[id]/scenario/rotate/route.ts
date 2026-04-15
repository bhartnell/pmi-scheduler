import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

/**
 * POST /api/lab-management/stations/:id/scenario/rotate
 *
 * Swaps the station's currently-selected NREMT scenario to a different
 * one from the same skill code. Used when a student retakes an E201 or
 * E202 assessment and we don't want them to see the same scenario again.
 *
 * Strategy (deterministic, no randomness):
 *   1. Load active scenarios for the station's NREMT code (E201 | E202)
 *   2. Exclude the currently-selected one so the student gets something new
 *   3. Also de-prioritize scenarios already in use by sibling stations on
 *      the same lab day so we don't collide across stations
 *   4. Pick the first remaining candidate; if none, fall back to the first
 *      non-current scenario; if still none (only one scenario exists),
 *      leave the station unchanged and return success=false with a message
 *
 * Returns: { success, scenario, previous_scenario_id }
 *
 * Added 2026-04-15 for the NREMT-day retake bug — the station scenario
 * was not refreshing on retake so failed students got the same scenario
 * twice in a row at stations 2 (E202) and 3 (E201).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: stationId } = await params;
    const supabase = getSupabaseAdmin();

    // 1. Load station + its skill sheet's NREMT code
    const { data: station, error: stationError } = await supabase
      .from('lab_stations')
      .select('id, lab_day_id, metadata, skill_sheet:skill_sheets!lab_stations_skill_sheet_id_fkey(id, nremt_code)')
      .eq('id', stationId)
      .single();

    if (stationError || !station) {
      return NextResponse.json(
        { success: false, error: 'Station not found' },
        { status: 404 }
      );
    }

    const skillSheet = (station.skill_sheet as unknown as { nremt_code?: string } | null);
    const nremtCode = skillSheet?.nremt_code;
    if (!nremtCode || (nremtCode !== 'E201' && nremtCode !== 'E202')) {
      return NextResponse.json(
        { success: false, error: 'Station is not an E201/E202 assessment station' },
        { status: 400 }
      );
    }

    const currentMetadata =
      (station.metadata && typeof station.metadata === 'object'
        ? (station.metadata as Record<string, unknown>)
        : {}) || {};
    const previousScenarioId =
      typeof currentMetadata.selected_scenario_id === 'string'
        ? (currentMetadata.selected_scenario_id as string)
        : null;

    // 2. Load all active scenarios for this skill code
    const { data: scenarios, error: scenariosError } = await supabase
      .from('nremt_scenarios')
      .select('id, skill_code, title, scenario_data, is_active, created_at')
      .eq('is_active', true)
      .eq('skill_code', nremtCode)
      .order('title', { ascending: true });

    if (scenariosError) {
      return NextResponse.json(
        { success: false, error: 'Failed to load scenarios' },
        { status: 500 }
      );
    }

    const list = scenarios || [];
    if (list.length === 0) {
      return NextResponse.json(
        { success: false, error: `No active ${nremtCode} scenarios available` },
        { status: 404 }
      );
    }
    if (list.length === 1) {
      // Nothing to rotate to — only one scenario in the bank.
      return NextResponse.json({
        success: false,
        error: `Only one ${nremtCode} scenario exists; cannot rotate.`,
        scenario: list[0],
        previous_scenario_id: previousScenarioId,
      });
    }

    // 3. Find sibling stations on the same lab day with the same nremt_code
    //    that already have a scenario assigned, so we prefer not to collide.
    const { data: siblings } = await supabase
      .from('lab_stations')
      .select('id, metadata, skill_sheet:skill_sheets!lab_stations_skill_sheet_id_fkey(nremt_code)')
      .eq('lab_day_id', station.lab_day_id)
      .neq('id', stationId);

    const siblingScenarioIds = new Set<string>();
    for (const s of siblings || []) {
      const sib = s as unknown as {
        metadata?: Record<string, unknown> | null;
        skill_sheet?: { nremt_code?: string } | null;
      };
      if (sib.skill_sheet?.nremt_code !== nremtCode) continue;
      const sid = sib.metadata?.selected_scenario_id;
      if (typeof sid === 'string') siblingScenarioIds.add(sid);
    }

    // 4. Pick next scenario: exclude current, de-prioritize sibling collisions.
    const eligible = list.filter((s) => s.id !== previousScenarioId);
    const preferred = eligible.find((s) => !siblingScenarioIds.has(s.id));
    const chosen = preferred || eligible[0]; // eligible guaranteed non-empty (list.length >= 2)

    // 5. Persist new selection on the station
    const mergedMetadata: Record<string, unknown> = {
      ...currentMetadata,
      selected_scenario_id: chosen.id,
    };
    const { error: updateError } = await supabase
      .from('lab_stations')
      .update({ metadata: mergedMetadata })
      .eq('id', stationId);

    if (updateError) {
      console.error('Error rotating station scenario:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to save rotated scenario' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      scenario: chosen,
      previous_scenario_id: previousScenarioId,
    });
  } catch (error) {
    console.error('Error in POST /api/lab-management/stations/[id]/scenario/rotate:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
