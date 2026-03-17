/**
 * Parse an active_weeks specification string into an array of week numbers.
 *
 * Examples:
 *   parseActiveWeeks('all', 15)        → [1,2,3,...,15]
 *   parseActiveWeeks('1-9')            → [1,2,3,4,5,6,7,8,9]
 *   parseActiveWeeks('10-15')          → [10,11,12,13,14,15]
 *   parseActiveWeeks('1-8,10,12-15')   → [1,2,3,4,5,6,7,8,10,12,13,14,15]
 */
export function parseActiveWeeks(spec: string, totalWeeks: number = 15): number[] {
  if (!spec || spec.trim().toLowerCase() === 'all') {
    return Array.from({ length: totalWeeks }, (_, i) => i + 1);
  }

  const weeks = new Set<number>();
  const parts = spec.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      for (let i = start; i <= end; i++) {
        weeks.add(i);
      }
    } else {
      const num = parseInt(trimmed, 10);
      if (!isNaN(num)) {
        weeks.add(num);
      }
    }
  }

  return Array.from(weeks).sort((a, b) => a - b);
}

/**
 * Format an array of week numbers back into a compact string.
 * e.g., [1,2,3,4,5,6,7,8,9] → '1-9'
 *       [1,2,3,8,10,11,12] → '1-3,8,10-12'
 */
export function formatActiveWeeks(weeks: number[], totalWeeks: number = 15): string {
  if (!weeks || weeks.length === 0) return 'all';

  // Check if it covers all weeks
  const allWeeks = Array.from({ length: totalWeeks }, (_, i) => i + 1);
  if (weeks.length === totalWeeks && weeks.every((w, i) => w === allWeeks[i])) {
    return 'all';
  }

  const sorted = [...weeks].sort((a, b) => a - b);
  const ranges: string[] = [];
  let rangeStart = sorted[0];
  let rangeEnd = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === rangeEnd + 1) {
      rangeEnd = sorted[i];
    } else {
      ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);
      rangeStart = sorted[i];
      rangeEnd = sorted[i];
    }
  }
  ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);

  return ranges.join(',');
}

/**
 * Human-readable label for active_weeks.
 * e.g., 'all' → 'All weeks', '1-9' → 'Weeks 1-9', '1-8,10,12-15' → 'Weeks 1-8, 10, 12-15'
 */
export function activeWeeksLabel(spec: string, totalWeeks: number = 15): string {
  if (!spec || spec.trim().toLowerCase() === 'all') {
    return `1-${totalWeeks} (all)`;
  }
  return spec.replace(/,/g, ', ');
}
