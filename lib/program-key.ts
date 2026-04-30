/**
 * Single source of truth for mapping a cohort's program abbreviation
 * → template-table program key.
 *
 * Cohort programs are stored as 'PM' / 'PMD' / 'EMT' / 'AEMT'
 * (uppercase abbreviation on the `programs.abbreviation` column).
 * Template tables (lab_day_templates, pmi_course_templates) store
 * the resolved key 'paramedic' / 'emt' / 'aemt' — full lowercase
 * names. Any place that takes a value from one side and queries
 * the other MUST go through this helper, or you get the
 * "WHERE program='pm'" silent-zero-results bug class.
 *
 * Already burned us in:
 *   - /api/admin/lab-templates/update-existing (commit d768eb5d)
 *   - /api/scheduling/planner/lab-templates    (this commit)
 * — both fixed by routing through this util.
 */

const ABBREVIATION_MAP: Record<string, string> = {
  PM: 'paramedic',
  PMD: 'paramedic',
  EMT: 'emt',
  AEMT: 'aemt',
};

/**
 * Map a program abbreviation (or already-resolved key) to the
 * template-table key. Pass-through for values that are already
 * 'paramedic' / 'emt' / 'aemt' so callers can hand off either
 * shape without branching client-side.
 *
 *   mapProgramKey('PM')         → 'paramedic'
 *   mapProgramKey('pm')         → 'paramedic'
 *   mapProgramKey('paramedic')  → 'paramedic'
 *   mapProgramKey('emt')        → 'emt'
 *   mapProgramKey('Foo')        → 'foo'   (unknown — lowercased)
 *   mapProgramKey(null)         → ''
 */
export function mapProgramKey(input: string | null | undefined): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (!trimmed) return '';
  const upper = trimmed.toUpperCase();
  if (ABBREVIATION_MAP[upper]) return ABBREVIATION_MAP[upper];
  // Already in template-key form, or unknown → lowercase fallthrough.
  return trimmed.toLowerCase();
}
