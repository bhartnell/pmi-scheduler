// FERPA Data Filtering — Agency-Specific Data Minimization
//
// Filters student data for agency_liaison and agency_observer roles,
// enforcing FERPA release checks and field-level data minimization.
//
// Integration points for Tasks 104-107 (LVFR AEMT endpoints):
//   - GET /api/lvfr-aemt/grades → filterStudentForAgency() before returning grade data
//   - GET /api/lvfr-aemt/skills → filterStudentForAgency() before returning skill data
//   - GET /api/lvfr-aemt/students → apply to each student record in the list

import { checkFerpaRelease, type StudentFerpaInfo } from '@/lib/ferpa';

export interface FilteredStudent {
  id: string;
  first_name: string;
  last_name: string;
  status?: string;
  ferpa_blocked?: boolean;
  [key: string]: unknown;
}

// Fields that are ALWAYS stripped from agency views
const AGENCY_STRIP_FIELDS = new Set([
  'phone',
  'personal_phone',
  'personal_email',
  'home_address',
  'emergency_contact',
  'ssn',
  'date_of_birth',
]);

// Fields only visible to agency_liaison (NOT agency_observer)
const LIAISON_EXTRA_FIELDS = new Set([
  'agency',
  'photo_url',
  'learning_style',
  'cohort',
  'cohort_id',
]);

// Fields for grade data — observer gets summary only, liaison gets details
const GRADE_SUMMARY_FIELDS = new Set([
  'score_percent',
  'passed',
]);

/**
 * Filter a student record for agency views with FERPA release enforcement.
 *
 * If the student has NOT signed a FERPA release for the user's agency:
 *   → returns { id, first_name, last_name, status, ferpa_blocked: true }
 *
 * If the student HAS signed a release:
 *   → agency_observer: directory info + basic status (no notes, no email, no grade details)
 *   → agency_liaison: instructor-like view minus internal notes and PII
 */
export function filterStudentForAgency(
  student: Record<string, unknown>,
  userRole: string,
  userAgency: string | null
): FilteredStudent {
  const ferpaInfo: StudentFerpaInfo = {
    ferpa_agency_release: student.ferpa_agency_release as boolean | undefined,
    ferpa_release_agency: student.ferpa_release_agency as string | null | undefined,
  };

  // Check FERPA release
  if (!checkFerpaRelease(ferpaInfo, userAgency)) {
    // No release — return minimal directory information only
    return {
      id: student.id as string,
      first_name: student.first_name as string,
      last_name: student.last_name as string,
      status: student.status as string | undefined,
      ferpa_blocked: true,
    };
  }

  // Has FERPA release — filter based on role
  const filtered: FilteredStudent = {
    id: student.id as string,
    first_name: student.first_name as string,
    last_name: student.last_name as string,
    status: student.status as string | undefined,
  };

  if (userRole === 'agency_observer') {
    // Observer: directory info + basic status only
    // No email, no notes, no detailed grades, no internal data
    return filtered;
  }

  if (userRole === 'agency_liaison') {
    // Liaison: instructor-like view minus stripped fields
    for (const [key, value] of Object.entries(student)) {
      // Skip already-set fields
      if (key === 'id' || key === 'first_name' || key === 'last_name' || key === 'status') continue;

      // Always strip PII/internal fields
      if (AGENCY_STRIP_FIELDS.has(key)) continue;

      // Strip email from overview dashboards (liaison sees it only in detail view)
      if (key === 'email') continue;

      // Strip internal notes (only for agency views)
      if (key === 'notes' || key === 'internal_notes') continue;

      // Include liaison-visible fields
      if (LIAISON_EXTRA_FIELDS.has(key)) {
        filtered[key] = value;
        continue;
      }

      // Include general non-PII fields
      filtered[key] = value;
    }

    return filtered;
  }

  // For non-agency roles, return as-is (shouldn't reach here but safe fallback)
  return filtered;
}

/**
 * Filter grade/assessment data for agency views.
 * agency_observer: score_percent + passed only
 * agency_liaison: score_percent + passed + date_taken (no question-level data)
 */
export function filterGradeForAgency(
  grade: Record<string, unknown>,
  userRole: string
): Record<string, unknown> {
  if (userRole === 'agency_observer') {
    const filtered: Record<string, unknown> = {};
    for (const field of GRADE_SUMMARY_FIELDS) {
      if (grade[field] !== undefined) {
        filtered[field] = grade[field];
      }
    }
    if (grade.assessment_id) filtered.assessment_id = grade.assessment_id;
    return filtered;
  }

  if (userRole === 'agency_liaison') {
    // Liaison gets summary + date, no question-level data
    const { questions_correct, questions_total, ...rest } = grade;
    void questions_correct;
    void questions_total;
    return rest;
  }

  return grade;
}
