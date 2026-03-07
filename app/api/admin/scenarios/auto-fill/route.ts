import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FieldChange {
  field: string;
  old_value: unknown;
  new_value: unknown;
}

interface ScenarioChangeLog {
  scenario_id: string;
  title: string;
  category: string | null;
  is_pediatric: boolean;
  changes: FieldChange[];
}

interface AutoFillResult {
  total_checked: number;
  total_with_changes: number;
  total_unchanged: number;
  total_applied: number;
  total_errors: number;
  pediatric_scenarios: number;
  changelog: ScenarioChangeLog[];
  errors: Array<{ scenario_id: string; title: string; error: string }>;
}

// ---------------------------------------------------------------------------
// Equipment defaults by category
// ---------------------------------------------------------------------------

const EQUIPMENT_BY_CATEGORY: Record<string, string[]> = {
  Cardiac: ['Cardiac monitor', '12-lead ECG', 'IV start kit', 'Medication kit', 'Defibrillator/AED'],
  Trauma: ['C-collar', 'Backboard/scoop stretcher', 'Tourniquets (x2)', 'Hemostatic gauze', 'IV start kit'],
  Respiratory: ['BVM with reservoir', 'Non-rebreather mask', 'Nasal cannula', 'Suction unit', 'Nebulizer', 'Pulse oximeter'],
  Pediatric: ['Broselow tape', 'Pediatric BVM', 'IO kit', 'Pediatric drug doses reference', 'Pediatric-sized BP cuff'],
  OB: ['OB kit', 'Bulb syringe', 'Cord clamps (x2)', 'Towels/blankets', 'Thermal blanket'],
};

const DEFAULT_EQUIPMENT = ['Cardiac monitor', 'IV start kit', 'Medication kit', 'Gloves', 'Stethoscope'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isEmpty(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === 'string' && val.trim() === '') return true;
  if (Array.isArray(val) && val.length === 0) return true;
  if (typeof val === 'object' && !Array.isArray(val) && Object.keys(val as Record<string, unknown>).length === 0) return true;
  return false;
}

function isPediatric(scenario: Record<string, unknown>): boolean {
  const category = (scenario.category as string) || '';
  const subcategory = (scenario.subcategory as string) || '';
  return (
    category.toLowerCase() === 'pediatric' ||
    subcategory.toLowerCase().includes('ped')
  );
}

/**
 * Given initial_vitals and a phase index, generate progressed vitals.
 * Direction is based on category:
 *   - Cardiac/Respiratory/Medical: deteriorating then improving (if 3+ phases)
 *   - Trauma: initial stable then possible deterioration
 * Each subsequent phase shifts vitals slightly.
 */
function generatePhaseVitals(
  initialVitals: Record<string, unknown>,
  phaseIndex: number,
  totalPhases: number,
  category: string | null
): Record<string, unknown> {
  // Clone initial vitals as base
  const vitals: Record<string, unknown> = { ...initialVitals };

  if (phaseIndex === 0) return vitals;

  // Parse numeric values where possible for progression
  const parseVital = (key: string): number | null => {
    const val = initialVitals[key];
    if (typeof val === 'string') {
      const num = parseInt(val, 10);
      return isNaN(num) ? null : num;
    }
    if (typeof val === 'number') return val;
    return null;
  };

  // Determine progression direction
  // For simplicity: phases in first half deteriorate, second half improve
  const midpoint = Math.max(1, Math.floor(totalPhases / 2));
  const isDeteriorating = phaseIndex <= midpoint;

  // Progression factor: how far from initial (-1 = max deterioration, +1 = max improvement)
  let factor: number;
  if (totalPhases <= 2) {
    // 2 phases: second phase shows treatment effect (improvement)
    factor = 0.15;
  } else if (isDeteriorating) {
    factor = -0.1 * phaseIndex;
  } else {
    factor = 0.1 * (phaseIndex - midpoint);
  }

  const isTraumaOrMedical = category && ['Trauma', 'Medical'].includes(category);

  // HR: increase with deterioration, decrease with improvement
  const hr = parseVital('hr');
  if (hr !== null) {
    const delta = Math.round(hr * factor * (isTraumaOrMedical ? 1.5 : 1));
    vitals.hr = String(Math.max(40, Math.min(180, hr - delta)));
  }

  // BP: systolic decreases with deterioration
  const bp = initialVitals.bp;
  if (typeof bp === 'string' && bp.includes('/')) {
    const parts = bp.split('/');
    const sys = parseInt(parts[0], 10);
    const dia = parseInt(parts[1], 10);
    if (!isNaN(sys) && !isNaN(dia)) {
      const sysDelta = Math.round(sys * factor * 0.5);
      const diaDelta = Math.round(dia * factor * 0.3);
      vitals.bp = `${Math.max(60, Math.min(220, sys + sysDelta))}/${Math.max(30, Math.min(130, dia + diaDelta))}`;
    }
  }

  // RR: increase with deterioration
  const rr = parseVital('rr');
  if (rr !== null) {
    const delta = Math.round(rr * factor * -0.8);
    vitals.rr = String(Math.max(6, Math.min(40, rr + delta)));
  }

  // SpO2: decrease with deterioration, increase with improvement
  const spo2 = parseVital('spo2');
  if (spo2 !== null) {
    const delta = Math.round(Math.abs(factor) * 5 * (isDeteriorating ? -1 : 1));
    vitals.spo2 = String(Math.max(70, Math.min(100, spo2 + delta)));
  }

  return vitals;
}

// ---------------------------------------------------------------------------
// POST /api/admin/scenarios/auto-fill
//
// Auto-fills missing fields on scenarios based on category and initial data.
// Body: { preview: boolean }
//   preview=true  -> return what WOULD change without saving
//   preview=false -> apply changes and return changelog
// Requires admin+ role.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const body: { preview?: boolean } = await request.json();
    const preview = body.preview !== false; // Default to preview mode for safety

    const supabase = getSupabaseAdmin();

    // Fetch all scenarios
    const { data: scenarios, error } = await supabase
      .from('scenarios')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!scenarios || scenarios.length === 0) {
      return NextResponse.json({
        success: true,
        preview,
        results: {
          total_checked: 0,
          total_with_changes: 0,
          total_unchanged: 0,
          total_applied: 0,
          total_errors: 0,
          pediatric_scenarios: 0,
          changelog: [],
          errors: [],
        } satisfies AutoFillResult,
      });
    }

    const results: AutoFillResult = {
      total_checked: scenarios.length,
      total_with_changes: 0,
      total_unchanged: 0,
      total_applied: 0,
      total_errors: 0,
      pediatric_scenarios: 0,
      changelog: [],
      errors: [],
    };

    for (const scenario of scenarios) {
      const record = scenario as Record<string, unknown>;
      const changes: FieldChange[] = [];
      const isPed = isPediatric(record);

      if (isPed) results.pediatric_scenarios++;

      // ------------------------------------------------------------------
      // 1. Equipment auto-fill
      // ------------------------------------------------------------------
      const existingEquipment = record.equipment_needed;
      if (isEmpty(existingEquipment)) {
        const cat = (record.category as string) || '';
        let defaultEquipment = EQUIPMENT_BY_CATEGORY[cat] || DEFAULT_EQUIPMENT;

        // For pediatric scenarios, always include pediatric equipment
        if (isPed && cat !== 'Pediatric') {
          const pedEquip = EQUIPMENT_BY_CATEGORY['Pediatric'];
          // Merge: use category defaults + pediatric additions
          const merged = [...defaultEquipment];
          for (const item of pedEquip) {
            if (!merged.includes(item)) merged.push(item);
          }
          defaultEquipment = merged;
        }

        changes.push({
          field: 'equipment_needed',
          old_value: existingEquipment ?? null,
          new_value: defaultEquipment,
        });
      }

      // ------------------------------------------------------------------
      // 2. Phase vitals auto-fill
      // ------------------------------------------------------------------
      const phases = record.phases;
      const initialVitals = record.initial_vitals as Record<string, unknown> | null;

      if (
        Array.isArray(phases) &&
        phases.length > 0 &&
        initialVitals &&
        typeof initialVitals === 'object' &&
        Object.keys(initialVitals).length > 0
      ) {
        let phasesModified = false;
        const updatedPhases = phases.map((phase: Record<string, unknown>, idx: number) => {
          if (!phase || typeof phase !== 'object') return phase;

          const phaseVitals = phase.vitals;
          // Only fill if phase is missing vitals entirely
          if (isEmpty(phaseVitals)) {
            phasesModified = true;
            return {
              ...phase,
              vitals: generatePhaseVitals(
                initialVitals,
                idx,
                phases.length,
                record.category as string | null
              ),
            };
          }
          return phase;
        });

        if (phasesModified) {
          // Build a summary of which phases were filled
          const filledIndices: number[] = [];
          for (let i = 0; i < phases.length; i++) {
            const p = phases[i] as Record<string, unknown>;
            if (p && isEmpty(p.vitals)) filledIndices.push(i + 1);
          }

          changes.push({
            field: 'phases',
            old_value: `${filledIndices.length} phase(s) missing vitals (phases: ${filledIndices.join(', ')})`,
            new_value: `Populated vitals for ${filledIndices.length} phase(s) from initial_vitals with progression`,
          });

          // Store the actual updated phases for apply
          (record as Record<string, unknown>)._updatedPhases = updatedPhases;
        }
      }

      // ------------------------------------------------------------------
      // 3. Pediatric-specific field check (informational)
      // ------------------------------------------------------------------
      if (isPed) {
        const pedMissingFields: string[] = [];
        if (isEmpty(record.patient_age)) pedMissingFields.push('patient_age');
        if (isEmpty(record.patient_name)) pedMissingFields.push('patient_name');
        if (isEmpty(record.patient_sex)) pedMissingFields.push('patient_sex');
        if (isEmpty(record.chief_complaint)) pedMissingFields.push('chief_complaint');
        if (isEmpty(record.initial_vitals)) pedMissingFields.push('initial_vitals');
        if (isEmpty(record.allergies)) pedMissingFields.push('allergies');
        if (isEmpty(record.medications)) pedMissingFields.push('medications');
        if (isEmpty(record.medical_history)) pedMissingFields.push('medical_history');
        if (isEmpty(record.learning_objectives)) pedMissingFields.push('learning_objectives');
        if (isEmpty(record.equipment_needed) && !changes.some(c => c.field === 'equipment_needed')) {
          pedMissingFields.push('equipment_needed');
        }

        // If we have pediatric-specific missing fields, note them in changes
        if (pedMissingFields.length > 0) {
          changes.push({
            field: '_pediatric_missing_fields',
            old_value: pedMissingFields,
            new_value: `${pedMissingFields.length} field(s) still need manual attention for this pediatric scenario`,
          });
        }
      }

      // ------------------------------------------------------------------
      // Record changes or mark as unchanged
      // ------------------------------------------------------------------
      if (changes.length === 0 || (changes.length === 1 && changes[0].field === '_pediatric_missing_fields')) {
        results.total_unchanged++;
        // Still include pediatric info-only entries in changelog
        if (changes.length > 0) {
          results.changelog.push({
            scenario_id: record.id as string,
            title: (record.title as string) || '(untitled)',
            category: (record.category as string) || null,
            is_pediatric: isPed,
            changes,
          });
        }
        continue;
      }

      results.total_with_changes++;

      // ------------------------------------------------------------------
      // Apply changes if not in preview mode
      // ------------------------------------------------------------------
      if (!preview) {
        try {
          const updatePayload: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
          };

          for (const change of changes) {
            if (change.field === '_pediatric_missing_fields') continue; // info-only

            if (change.field === 'phases') {
              // Use the pre-computed updated phases
              updatePayload.phases = (record as Record<string, unknown>)._updatedPhases;
            } else {
              updatePayload[change.field] = change.new_value;
            }
          }

          const { error: updateError } = await supabase
            .from('scenarios')
            .update(updatePayload)
            .eq('id', record.id as string);

          if (updateError) throw updateError;

          results.total_applied++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          results.total_errors++;
          results.errors.push({
            scenario_id: record.id as string,
            title: (record.title as string) || '(untitled)',
            error: msg,
          });
        }
      }

      // Clean up temp field
      delete (record as Record<string, unknown>)._updatedPhases;

      results.changelog.push({
        scenario_id: record.id as string,
        title: (record.title as string) || '(untitled)',
        category: (record.category as string) || null,
        is_pediatric: isPed,
        changes,
      });
    }

    return NextResponse.json({
      success: true,
      preview,
      results,
    });
  } catch (error) {
    console.error('Error in auto-fill:', error);
    return NextResponse.json(
      { error: 'Failed to auto-fill scenarios' },
      { status: 500 }
    );
  }
}
