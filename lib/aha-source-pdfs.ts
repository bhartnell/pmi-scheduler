export const AHA_SOURCE_PDF_BUCKET = 'aha-source-pdfs';

// Object key for a case/checklist code. Rejects anything that is not a plain code
// so a caller can never address a path outside the bucket root.
export function ahaSourcePdfKey(code: string): string | null {
  const c = code.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(c) || c.includes('..')) return null;
  return `${c}.pdf`;
}

// Official AHA 2025 fillable templates. One fixed slot per form; the code is the
// storage key used by POST /api/aha-source-pdfs, so uploading into a slot is an
// ordinary source-PDF upload with that code.
export const AHA_TEMPLATE_SLOTS = [
  { code: 'ACLS_MEGACODE_TESTING', course: 'ACLS', title: 'ACLS Megacode Testing Checklist' },
  { code: 'ACLS_AIRWAY', course: 'ACLS', title: 'ACLS Airway Management Skills Testing' },
  { code: 'ACLS_ADULT_BLS', course: 'ACLS', title: 'ACLS Adult BLS Skills Testing' },
  { code: 'ACLS_INFANT_CPR', course: 'ACLS', title: 'ACLS Infant CPR Skills Testing' },
  { code: 'PALS_MEGACODE_TESTING', course: 'PALS', title: 'PALS Megacode Testing Checklist' },
  { code: 'PALS_AIRWAY', course: 'PALS', title: 'PALS Airway Management Skills Testing' },
  { code: 'PALS_CHILD_BLS', course: 'PALS', title: 'PALS Child BLS Skills Testing' },
  { code: 'PALS_INFANT_CPR', course: 'PALS', title: 'PALS Infant CPR Skills Testing' },
] as const;

export const AHA_TEMPLATE_SLOT_CODES: ReadonlySet<string> = new Set(AHA_TEMPLATE_SLOTS.map((s) => s.code));
