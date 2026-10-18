export const AHA_SOURCE_PDF_BUCKET = 'aha-source-pdfs';

// Object key for a case/checklist code. Rejects anything that is not a plain code
// so a caller can never address a path outside the bucket root.
export function ahaSourcePdfKey(code: string): string | null {
  const c = code.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(c) || c.includes('..')) return null;
  return `${c}.pdf`;
}
