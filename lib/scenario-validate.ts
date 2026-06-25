/**
 * Scenario shape validation + normalization for the import / save path.
 *
 * Why this exists: scenarios are regularly round-tripped — exported as JSON
 * (lib/scenario-export.ts), enriched externally (often by an LLM), then
 * re-uploaded. An external edit can change a field's SHAPE: rename/nest/drop
 * a field, or flip an array to a string/object. The save path
 * (PATCH /api/lab-management/scenarios/[id]) previously stored phases as-is,
 * so a reshaped payload persisted and then crashed the client render with
 * "Cannot read properties of undefined (reading 'length')".
 *
 * Two-part defense:
 *   1. normalizeScenarioPhases — map well-known phase-field ALIASES back to the
 *      scenario schema the app renders (e.g. an LLM that renamed
 *      name→title, presentation_notes→presentation_text, expected_actions→
 *      instructor_cues). Non-destructive: original keys are kept.
 *   2. validateScenarioShape — for anything that CAN'T be auto-mapped, return a
 *      readable error ("field X expected an array, got Y") so the importer can
 *      surface it instead of letting malformed data through to crash a render.
 */

// Scenario columns that are arrays (text[] / jsonb[]) — the render path calls
// .length / .map on these, so a non-array here is the classic crash trigger.
const ARRAY_FIELDS = [
  'applicable_programs', 'medical_history', 'medications', 'learning_objectives',
  'critical_actions', 'debrief_points', 'equipment_needed',
  'medications_to_administer', 'expected_interventions',
] as const;

// Scenario columns that are plain objects (jsonb). An array/string here also
// breaks render code that reads sub-keys.
const OBJECT_FIELDS = ['sample_history', 'opqrst', 'secondary_survey', 'initial_vitals'] as const;

export interface ScenarioShapeError {
  path: string;
  message: string;
}

function typeName(v: unknown): string {
  if (Array.isArray(v)) return 'array';
  if (v === null) return 'null';
  return typeof v;
}

/**
 * Validate a scenario-shaped payload. Returns [] when the shape is safe to
 * render, otherwise a list of readable errors. Missing/null fields are allowed
 * (the importer treats them as defaults) — only WRONG types are flagged.
 */
export function validateScenarioShape(s: Record<string, unknown>): ScenarioShapeError[] {
  const errors: ScenarioShapeError[] = [];
  if (!s || typeof s !== 'object' || Array.isArray(s)) {
    return [{ path: '(root)', message: `scenario expected an object, got ${typeName(s)}` }];
  }

  for (const f of ARRAY_FIELDS) {
    const v = s[f];
    if (v === undefined || v === null) continue;
    if (!Array.isArray(v)) errors.push({ path: f, message: `field "${f}" expected an array, got ${typeName(v)}` });
  }

  for (const f of OBJECT_FIELDS) {
    const v = s[f];
    if (v === undefined || v === null) continue;
    if (typeof v !== 'object' || Array.isArray(v)) {
      errors.push({ path: f, message: `field "${f}" expected an object, got ${typeName(v)}` });
    }
  }

  const phases = s.phases;
  if (phases !== undefined && phases !== null) {
    if (!Array.isArray(phases)) {
      errors.push({ path: 'phases', message: `field "phases" expected an array of phase objects, got ${typeName(phases)}` });
    } else {
      phases.forEach((p, i) => {
        if (p === null || typeof p !== 'object' || Array.isArray(p)) {
          errors.push({ path: `phases[${i}]`, message: `phases[${i}] expected an object, got ${typeName(p)}` });
        }
      });
    }
  }

  return errors;
}

/**
 * Map well-known phase-field aliases back to the scenario phase schema the app
 * renders. Non-destructive — keeps the original keys too, only FILLS missing
 * canonical ones. No-op for anything that isn't an array of objects.
 */
export function normalizeScenarioPhases<T>(phases: T): T {
  if (!Array.isArray(phases)) return phases;
  return phases.map((p) => {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return p;
    const phase = p as Record<string, unknown>;
    const out: Record<string, unknown> = { ...phase };

    // name ← title (case-study / LLM-enriched exports rename name→title). Only
    // map the ALIAS; never cross-fill one canonical field from another, or every
    // normal scenario would be needlessly rewritten.
    if (out.name == null && typeof out.title === 'string') {
      out.name = out.title;
      if (out.phase_name == null) out.phase_name = out.title;
    }

    // presentation_notes ← presentation_text / presentation
    if (out.presentation_notes == null) {
      if (typeof out.presentation_text === 'string') out.presentation_notes = out.presentation_text;
      else if (typeof out.presentation === 'string') out.presentation_notes = out.presentation;
    }

    // instructor_cues is now a FIRST-CLASS phase field (distinct from
    // expected_actions) — it passes through unchanged via the spread above; we no
    // longer fold it into expected_actions. Keep them separate.

    return out;
  }) as T;
}

/**
 * Convenience: validate, and if valid, return a copy with phases normalized.
 * `errors` is non-empty when the payload should be rejected.
 */
export function validateAndNormalizeScenario(
  s: Record<string, unknown>,
): { errors: ScenarioShapeError[]; normalized: Record<string, unknown> } {
  const errors = validateScenarioShape(s);
  if (errors.length > 0) return { errors, normalized: s };
  const normalized = { ...s };
  if (Array.isArray(normalized.phases)) normalized.phases = normalizeScenarioPhases(normalized.phases);
  return { errors, normalized };
}
