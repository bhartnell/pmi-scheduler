/**
 * Default debrief-marker lead time (seconds before the end of a rotation)
 * when no per-station debrief preset is configured.
 *
 * Rotation splits (Ben, 2026-10-05): 15-min stations are 10 case + 5 debrief;
 * the 10-min peri-arrest rotation is 6 case + 4 debrief. Other lengths keep
 * the historical 5-min default. A per-station `debrief_minutes` preset always
 * wins over this default.
 */
export function defaultDebriefSecondsFor(rotationMinutes?: number | null): number {
  if (rotationMinutes === 10) return 240;
  return 300;
}
