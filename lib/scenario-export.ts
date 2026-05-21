// ----------------------------------------------------------------
// Scenario → bulk-import JSON shape converter.
//
// The exported JSON mirrors what /api/admin/scenarios/bulk-import
// accepts (`ImportedScenario` in app/api/admin/scenarios/bulk-import/route.ts).
// Goal: a scenario you export here can be:
//   1. Edited inline or pasted into an LLM chat for revision.
//   2. Dropped back into the bulk-import UI as-is.
//
// What round-trips losslessly via bulk-import:
//   title, category, subcategory, difficulty, estimated_duration,
//   applicable_programs, dispatch_*, chief_complaint, patient_*,
//   medical_history, medications, allergies, sample_history,
//   instructor_notes, learning_objectives, phases (with vitals),
//   critical_actions, debrief_points.
//
// What's included in the export but IGNORED by the current bulk-import:
//   preferred_manikin, assessment_x/a/e, general_impression (top-level),
//   opqrst, evaluation_criteria.
//
//   These are columns on the scenarios table that the lab-management
//   edit page writes but the bulk-importer never learned. Keeping
//   them in the export means:
//     - An LLM editing the JSON has the full context.
//     - If we extend the importer later, the existing exports
//       become losslessly re-importable retroactively.
//     - Round-trip via PATCH /api/lab-management/scenarios/[id]
//       preserves them today.
//
// All helpers are server- and client-safe (pure functions, no DOM).
// ----------------------------------------------------------------

export interface ExportableScenarioInput {
  // Identity. When present and a UUID, the bulk-import commit
  // endpoint uses this to UPDATE-in-place rather than create a
  // duplicate. Always preserved by round-trips through this lib.
  id?: string | null;

  // Core
  title?: string | null;
  category?: string | null;
  subcategory?: string | null;
  difficulty?: string | null;
  estimated_duration?: number | null;
  applicable_programs?: string[] | null;
  preferred_manikin?: string | null;

  // Dispatch
  dispatch_time?: string | null;
  dispatch_location?: string | null;
  chief_complaint?: string | null;
  dispatch_notes?: string | null;

  // Patient demographics
  patient_name?: string | null;
  patient_age?: string | number | null;
  patient_sex?: string | null;
  patient_weight?: string | number | null;

  // History / SAMPLE
  medical_history?: string[] | null;
  medications?: string[] | null;
  allergies?: string | null;
  sample_history?: {
    signs_symptoms?: string | null;
    last_oral_intake?: string | null;
    events_leading?: string | null;
  } | null;

  // Scenario-level XABCDE + general impression
  assessment_x?: string | null;
  assessment_a?: string | null;
  assessment_e?: string | null;
  general_impression?: string | null;

  // OPQRST scenario-level
  opqrst?: {
    onset?: string | null;
    provocation?: string | null;
    quality?: string | null;
    radiation?: string | null;
    severity?: string | null;
    time_onset?: string | null;
  } | null;

  // Notes / objectives — accept both the DB-column name and the
  // edit-page's UI alias, so callers can hand us either shape
  // without remapping.
  instructor_notes?: string | null;
  instructor_summary?: string | null;
  learning_objectives?: string[] | null;
  key_decision_points?: string[] | null;

  // Phases — opaque to the converter; vitals etc. are passed
  // through unchanged so the export shape mirrors storage shape.
  phases?: unknown[] | null;

  // Critical actions: accept either strings or { description }
  // objects (the edit page uses {id, description}; storage is
  // string[]). Output is always string[] for import compatibility.
  critical_actions?: Array<string | { description?: string | null }> | null;

  // Evaluation criteria are an edit-page concept; pass through as-is.
  evaluation_criteria?: Array<{ name?: string | null; description?: string | null }> | null;

  debrief_points?: string[] | null;
}

// Defensive unwrapper for critical_actions that have been stored as
// stringified JSON like '{"id":"...","description":"text"}'. Mirrors
// the same safety loop used in the edit page's load path. Returns the
// inner description if present, otherwise the input unchanged.
function unwrapCriticalAction(a: unknown): string {
  if (a == null) return '';
  if (typeof a === 'string') {
    let s: unknown = a;
    for (let i = 0; i < 5; i++) {
      if (typeof s !== 'string') break;
      const trimmed = s.trim();
      if (!trimmed.startsWith('{') || !trimmed.includes('"description"')) break;
      try {
        const inner = JSON.parse(trimmed);
        if (inner && typeof inner === 'object' && typeof (inner as { description?: unknown }).description === 'string') {
          s = (inner as { description: string }).description;
          continue;
        }
      } catch {
        /* not parseable — bail */
      }
      break;
    }
    return typeof s === 'string' ? s : '';
  }
  if (typeof a === 'object' && a !== null && 'description' in a) {
    const d = (a as { description?: unknown }).description;
    return typeof d === 'string' ? d : '';
  }
  return '';
}

// Normalize a phase's expected_actions. Importer accepts both
// strings (newline-separated) and arrays — pick whichever is
// closer to natural shape:
//   • multi-line string → string[] (one per line, trimmed)
//   • single-line string → string
//   • already an array → array
// This keeps LLM-edited JSON readable instead of forcing escaped
// newlines back through a single string.
function normalizePhase(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const p = raw as Record<string, unknown>;
  const out: Record<string, unknown> = { ...p };

  const expected = p.expected_actions;
  if (typeof expected === 'string') {
    const lines = expected.split('\n').map(s => s.trim()).filter(Boolean);
    if (lines.length === 0) {
      delete out.expected_actions;
    } else if (lines.length === 1) {
      out.expected_actions = lines[0];
    } else {
      out.expected_actions = lines;
    }
  } else if (Array.isArray(expected) && expected.length === 0) {
    delete out.expected_actions;
  }

  // Drop the synthetic `id` and `display_order` the editor adds —
  // they aren't part of the import shape and re-imports regenerate
  // them. Keeping them would make the JSON noisier without value.
  delete out.id;
  delete out.display_order;

  // Vitals: drop empty string values so the JSON is readable when
  // editing in chat. Empty vitals fields are normalized to '' by
  // the editor but the importer ignores undefined the same way.
  const vitals = out.vitals;
  if (vitals && typeof vitals === 'object' && !Array.isArray(vitals)) {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(vitals as Record<string, unknown>)) {
      if (v === null || v === undefined) continue;
      if (typeof v === 'string' && v.trim() === '') continue;
      if (Array.isArray(v) && v.length === 0) continue;
      cleaned[k] = v;
    }
    if (Object.keys(cleaned).length === 0) {
      delete out.vitals;
    } else {
      out.vitals = cleaned;
    }
  }

  return out;
}

// Convert a single scenario (in either DB-shape or editor-shape) to
// the bulk-import JSON shape. Empty/null fields are dropped — the
// importer treats missing fields as defaults, so emitting nothing
// produces equivalent re-import behavior and keeps the output tidy
// for hand-editing.
export function scenarioToImportShape(s: ExportableScenarioInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const put = (k: string, v: unknown): void => {
    if (v === undefined || v === null) return;
    if (typeof v === 'string' && v.trim() === '') return;
    if (Array.isArray(v) && v.length === 0) return;
    if (typeof v === 'object' && !Array.isArray(v)) {
      // Drop objects whose own enumerable properties are all empty —
      // this catches `sample_history: { signs_symptoms: '', … }` so
      // the export doesn't include a header for nothing.
      const own = Object.entries(v as Record<string, unknown>).filter(
        ([, val]) => val !== undefined && val !== null && !(typeof val === 'string' && val.trim() === ''),
      );
      if (own.length === 0) return;
    }
    out[k] = v;
  };

  // Emit id first so it lands at the top of the JSON for hand-editing
  // visibility. Only emit if it parses as a UUID — anything else
  // would just confuse the bulk-import dedup logic.
  if (typeof s.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.id)) {
    out.id = s.id;
  }

  put('title', (s.title ?? '').trim());
  put('category', s.category);
  put('subcategory', s.subcategory);
  put('difficulty', s.difficulty);
  put('estimated_duration', s.estimated_duration);
  put('applicable_programs', s.applicable_programs);
  put('preferred_manikin', s.preferred_manikin);

  put('dispatch_time', s.dispatch_time);
  put('dispatch_location', s.dispatch_location);
  put('chief_complaint', s.chief_complaint);
  put('dispatch_notes', s.dispatch_notes);

  put('patient_name', s.patient_name);
  put('patient_age', s.patient_age != null && s.patient_age !== '' ? String(s.patient_age) : null);
  put('patient_sex', s.patient_sex);
  put('patient_weight', s.patient_weight != null && s.patient_weight !== '' ? String(s.patient_weight) : null);

  put('medical_history', s.medical_history);
  put('medications', s.medications);
  put('allergies', s.allergies);
  put('sample_history', s.sample_history);

  // Scenario-level XABCDE / general impression / OPQRST. These are
  // currently lossy on bulk-import re-import, but included so an LLM
  // editing the JSON sees the full picture and so PATCH-based
  // round-trips preserve them.
  put('assessment_x', s.assessment_x);
  put('assessment_a', s.assessment_a);
  put('assessment_e', s.assessment_e);
  put('general_impression', s.general_impression);
  put('opqrst', s.opqrst);

  put('instructor_notes', s.instructor_notes ?? s.instructor_summary);
  put('learning_objectives', s.learning_objectives ?? s.key_decision_points);

  const phases = (s.phases ?? []).map(normalizePhase);
  put('phases', phases);

  const criticalActions = (s.critical_actions ?? [])
    .map(unwrapCriticalAction)
    .filter(Boolean);
  put('critical_actions', criticalActions);

  // Evaluation criteria pass through if populated. Lossy on bulk-import.
  if (Array.isArray(s.evaluation_criteria)) {
    const ecCleaned = s.evaluation_criteria
      .map(ec => {
        const name = ec?.name?.trim?.() ?? '';
        const description = ec?.description?.trim?.() ?? '';
        if (!name && !description) return null;
        return { name, description };
      })
      .filter((v): v is { name: string; description: string } => v !== null);
    if (ecCleaned.length > 0) {
      out.evaluation_criteria = ecCleaned;
    }
  }

  put('debrief_points', s.debrief_points);

  return out;
}

/**
 * Wrap a single scenario in the bulk-import top-level shape:
 *   { scenarios: [ {...} ] }
 *
 * This is what /api/admin/scenarios/bulk-import accepts directly,
 * so a single-scenario export drops back in as a 1-scenario import.
 */
export function buildSingleExport(s: ExportableScenarioInput): { scenarios: Record<string, unknown>[] } {
  return { scenarios: [scenarioToImportShape(s)] };
}

/**
 * Multi-scenario export. Same wrapper, multiple entries.
 */
export function buildBulkExport(list: ExportableScenarioInput[]): { scenarios: Record<string, unknown>[] } {
  return { scenarios: list.map(scenarioToImportShape) };
}

/**
 * kebab-case a title for use in filenames. Strips non-alphanumerics,
 * collapses runs of dashes, trims leading/trailing dashes. Falls back
 * to `fallback` (default 'scenario') if the result is empty.
 */
export function sanitizeFilename(title: string | null | undefined, fallback = 'scenario'): string {
  const cleaned = (title || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
  // Cap length so OSes don't choke on absurdly long titles.
  return (cleaned || fallback).slice(0, 80);
}

/**
 * Browser-only — triggers a download of the given object as a
 * pretty-printed JSON file. Lives in this module so both the edit
 * page and list page share one definition.
 *
 * No-op on the server (where `document` is undefined) — callers
 * should only invoke from event handlers.
 */
export function downloadJson(filename: string, data: unknown): void {
  if (typeof document === 'undefined') return;
  const text = JSON.stringify(data, null, 2);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
