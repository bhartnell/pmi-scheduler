/**
 * Format a cohort number for display.
 *
 * After the column type changed from INTEGER to NUMERIC(5,1),
 * PostgREST may return values as strings (e.g. "14.0") or numbers
 * with unnecessary decimal places. This helper ensures clean display:
 *   14   → "14"
 *   14.0 → "14"
 *   15.5 → "15.5"
 *   "14.0" → "14"
 *   "15.5" → "15.5"
 */
export function formatCohortNumber(value: number | string | null | undefined): string {
  if (value == null) return '';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return String(value);
  // Use Number() to strip trailing zeros: 14.0 → "14", 15.5 → "15.5"
  return String(Number(num));
}
