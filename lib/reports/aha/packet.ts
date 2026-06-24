/**
 * Per-student AHA packet — combines a student's 4 testing checklists (megacode +
 * airway + adult BLS + infant CPR) into ONE self-contained HTML document, ready
 * to be rendered to a single PDF (server-side, headless Chrome) and bundled into
 * the per-student ZIP. Merges the two form modules' CSS into one <head>.
 */
import type { MegacodeReportRow } from '@/lib/reports/aha/megacode';
import { renderMegacodeStudentForm, MEGACODE_CSS, type SignoffInstructor } from '@/lib/reports/aha/megacodeForm';
import { renderSkillsStudentSheet, SKILLS_CSS, AIRWAY_FORM, ADULT_BLS_FORM, INFANT_CPR_FORM } from '@/lib/reports/aha/skillsForms';

/** Drag-ready filename: LastName_FirstName_ACLS_Results.pdf (sanitized). */
export function packetFilename(lastName: string, firstName: string): string {
  const clean = (s: string) => String(s ?? '').replace(/[^A-Za-z0-9]+/g, '').trim() || 'Unknown';
  return `${clean(lastName)}_${clean(firstName)}_ACLS_Results.pdf`;
}

/** Combined HTML doc for one student (megacode + the 3 skills sheets). */
export function composeStudentPacketHTML(row: MegacodeReportRow, instructor: SignoffInstructor | null): string {
  const student = { id: row.student.id, firstName: row.student.firstName, lastName: row.student.lastName };
  const megacode = renderMegacodeStudentForm({ ...row, instructor });
  const airway = renderSkillsStudentSheet(AIRWAY_FORM, student, instructor);
  const adultBls = renderSkillsStudentSheet(ADULT_BLS_FORM, student, instructor);
  const infant = renderSkillsStudentSheet(INFANT_CPR_FORM, student, instructor);
  // Merge both stylesheets; last .form shouldn't force a trailing blank page.
  const css = `${MEGACODE_CSS}\n${SKILLS_CSS}\n.form:last-child{page-break-after:auto;}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${packetFilename(row.student.lastName, row.student.firstName)}</title><style>${css}</style></head>
<body class="doc">${megacode}${airway}${adultBls}${infant}</body></html>`;
}
