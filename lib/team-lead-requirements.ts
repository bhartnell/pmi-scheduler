// Team-lead requirement measure (DECOUPLE 3/4).
// Replaces the single flat row count with per-course, per-phase counts judged
// against the AHA thresholds. Rows written before course/phase existed are
// reported as `unclassified` — never guessed into a course.

export type TeamLeadCourse = 'ACLS' | 'PALS';
export type TeamLeadPhase = 'practice' | 'testing';

// Practice: ACLS team leader at least 3 times, PALS at least 2.
// Testing is its own requirement: every student is tested as team leader once (passed).
export const TEAM_LEAD_PRACTICE_MIN: Record<TeamLeadCourse, number> = { ACLS: 3, PALS: 2 };
export const TEAM_LEAD_TESTING_MIN = 1;

export interface TeamLeadLogRow {
  course?: string | null;
  phase?: string | null;
  result?: string | null;
}

export interface CourseTeamLeadProgress {
  practice: { count: number; required: number; met: boolean };
  testing: { attempts: number; passed: number; required: number; met: boolean };
}

export interface TeamLeadProgress {
  ACLS: CourseTeamLeadProgress;
  PALS: CourseTeamLeadProgress;
  /** Rows with no course/phase (pre-DECOUPLE). Counted in team_lead_count only. */
  unclassified: number;
}

export function summarizeTeamLeads(rows: TeamLeadLogRow[]): TeamLeadProgress {
  const blank = (course: TeamLeadCourse): CourseTeamLeadProgress => ({
    practice: { count: 0, required: TEAM_LEAD_PRACTICE_MIN[course], met: false },
    testing: { attempts: 0, passed: 0, required: TEAM_LEAD_TESTING_MIN, met: false },
  });
  const out: TeamLeadProgress = { ACLS: blank('ACLS'), PALS: blank('PALS'), unclassified: 0 };

  for (const r of rows) {
    const course = r.course?.toUpperCase();
    const phase = r.phase?.toLowerCase();
    if ((course !== 'ACLS' && course !== 'PALS') || (phase !== 'practice' && phase !== 'testing')) {
      out.unclassified++;
      continue;
    }
    const c = out[course];
    if (phase === 'practice') {
      c.practice.count++;
    } else {
      c.testing.attempts++;
      if (r.result?.toLowerCase() === 'pass') c.testing.passed++;
    }
  }

  for (const course of ['ACLS', 'PALS'] as const) {
    const c = out[course];
    c.practice.met = c.practice.count >= c.practice.required;
    c.testing.met = c.testing.passed >= c.testing.required;
  }
  return out;
}
