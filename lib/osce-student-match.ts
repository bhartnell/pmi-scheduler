// Read-only, display-time matching between OSCE's free-text student_name
// (osce_assessments / osce_student_schedule have no FK to `students` — see
// docs/DATABASE_SCHEMA.md) and real student records.
//
// This NEVER writes a match back to the database. Per the Data Integrity
// Operating Rules (CLAUDE.md), an inferred name match is not a verified fact,
// so it is only ever used to decide what to *display* to an instructor who
// can visually confirm it against the student they're already looking at.
// A caller-visible confidence level ('exact' | 'surname_unique' |
// 'surname_ambiguous') lets the UI flag anything short of a full-name match.

export interface MatchableStudent {
  id: string;
  first_name: string;
  last_name: string;
}

export type OsceMatchConfidence = 'exact' | 'surname_unique' | 'surname_ambiguous';

export interface OsceMatchResult {
  student: MatchableStudent;
  confidence: OsceMatchConfidence;
}

function normalize(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Matches a free-text OSCE student_name against a pool of candidate students
 * (pass the relevant cohort's roster to keep the pool small and reduce
 * surname collisions). Returns null if nothing plausible matches; never
 * guesses between multiple equally-plausible candidates without flagging it.
 */
export function matchOsceStudentName(
  osceStudentName: string,
  candidates: MatchableStudent[]
): OsceMatchResult | null {
  const target = normalize(osceStudentName);
  if (!target) return null;

  const fullNameForms = (s: MatchableStudent) => [
    normalize(`${s.first_name} ${s.last_name}`),
    normalize(`${s.last_name} ${s.first_name}`),
    normalize(`${s.last_name}, ${s.first_name}`),
  ];

  // 1. Exact full-name match (either order).
  const exact = candidates.find(s => fullNameForms(s).includes(target));
  if (exact) return { student: exact, confidence: 'exact' };

  // 2. Bare-surname match (e.g. Spring's uppercase-surname-only data).
  const surnameMatches = candidates.filter(s => normalize(s.last_name) === target);
  if (surnameMatches.length === 1) {
    return { student: surnameMatches[0], confidence: 'surname_unique' };
  }
  if (surnameMatches.length > 1) {
    // Genuine collision (e.g. the G14 Kent/Marshall case) — never silently
    // pick one. Surface the first as a flagged, unconfirmed candidate so the
    // instructor can eyeball it rather than the row vanishing entirely.
    return { student: surnameMatches[0], confidence: 'surname_ambiguous' };
  }

  return null;
}
