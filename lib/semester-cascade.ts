/**
 * Semester-cascade calculator.
 *
 * Given the S1 start date for an academic year, compute the
 * canonical four semester windows + their break weeks. The PMI
 * Paramedic Program runs:
 *
 *   - 15-week semesters (weeks 1–15 inclusive, 105 days)
 *   - 1-week review break between consecutive semesters
 *   - Each next semester therefore starts 16 weeks after the
 *     previous one's start (S1 + 16w = S2 start, etc.)
 *
 * Date convention used here:
 *   - start_date  = the FIRST day of week 1
 *   - end_date    = the LAST day of week 15 (inclusive) =
 *                   start_date + 14*7 + 6 days = start_date + 104 days
 *
 * The calculator is pure (no DB, no time-zone trickery — all dates
 * are treated as UTC midnight YYYY-MM-DD strings) so the same code
 * powers both the live preview in the admin UI and the server-side
 * "cascade-create 4 semesters" endpoint.
 */

export interface SemesterWindow {
  number: 1 | 2 | 3 | 4;
  /** "Spring", "Summer", "Fall", "Winter" — operator can override */
  name: string;
  /** YYYY-MM-DD */
  start_date: string;
  /** YYYY-MM-DD (inclusive) */
  end_date: string;
}

export interface BreakWindow {
  /** "after S1" / "after S2" / "after S3" */
  label: string;
  /** YYYY-MM-DD — first day of the break week */
  start_date: string;
  /** YYYY-MM-DD — last day of the break week (inclusive) */
  end_date: string;
}

export interface CascadeResult {
  s1_start_date: string;
  semesters: [SemesterWindow, SemesterWindow, SemesterWindow, SemesterWindow];
  breaks: [BreakWindow, BreakWindow, BreakWindow];
}

const SEMESTER_DAYS = 105;        // 15 weeks × 7
const SEMESTER_LAST_DAY_OFFSET = 104; // inclusive end is start + 104
const BREAK_DAYS = 7;             // 1 review-break week
const NEXT_SEMESTER_OFFSET = SEMESTER_DAYS + BREAK_DAYS; // 112 — 16 weeks

// Default seasonal labels the operator can override per row.
// Year-spanning so they read sensibly regardless of when S1 is.
const DEFAULT_NAMES: Record<1 | 2 | 3 | 4, (year: number) => string> = {
  1: y => `Fall ${y}`,
  2: y => `Spring ${y + 1}`,
  3: y => `Summer ${y + 1}`,
  4: y => `Late Summer ${y + 1}`,
};

/** Add `days` to a YYYY-MM-DD string. */
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  // Use UTC to avoid DST drift around break boundaries.
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Difference (lhs - rhs) in days. */
export function daysBetween(lhs: string, rhs: string): number {
  const [ly, lm, ld] = lhs.split('-').map(Number);
  const [ry, rm, rd] = rhs.split('-').map(Number);
  const a = Date.UTC(ly, lm - 1, ld);
  const b = Date.UTC(ry, rm - 1, rd);
  return Math.round((a - b) / (1000 * 60 * 60 * 24));
}

/**
 * Compute all four semesters + three break weeks from an S1 start
 * date. `year` is the academic-year integer used to pick default
 * seasonal names (e.g. 2026 → "Fall 2026, Spring 2027, ...").
 */
export function cascadeFromS1Start(s1StartDate: string, year: number): CascadeResult {
  const s1Start = s1StartDate;
  const semesters: SemesterWindow[] = [];
  const breaks: BreakWindow[] = [];

  for (let i = 0; i < 4; i++) {
    const start = addDays(s1Start, i * NEXT_SEMESTER_OFFSET);
    const end = addDays(start, SEMESTER_LAST_DAY_OFFSET);
    const num = (i + 1) as 1 | 2 | 3 | 4;
    semesters.push({
      number: num,
      name: DEFAULT_NAMES[num](year),
      start_date: start,
      end_date: end,
    });

    if (i < 3) {
      // Break starts the day AFTER the semester ends.
      const breakStart = addDays(end, 1);
      const breakEnd = addDays(breakStart, BREAK_DAYS - 1);
      breaks.push({
        label: `Break after S${num}`,
        start_date: breakStart,
        end_date: breakEnd,
      });
    }
  }

  return {
    s1_start_date: s1Start,
    semesters: semesters as CascadeResult['semesters'],
    breaks: breaks as CascadeResult['breaks'],
  };
}

/**
 * Given an existing semester's start_date and a NEW desired
 * start_date, compute the day delta. Used by the cascade-shift
 * endpoint to forward-propagate a date change to subsequent
 * semesters within the same academic year.
 */
export function cascadeShiftDelta(oldStart: string, newStart: string): number {
  return daysBetween(newStart, oldStart);
}

/**
 * Apply a positive/negative delta to a YYYY-MM-DD string. Re-export
 * of the internal addDays helper so callers don't reach for `Date`.
 */
export function shiftDate(dateStr: string, deltaDays: number): string {
  return addDays(dateStr, deltaDays);
}
