/**
 * Megacode export selection rule (Ben, authoritative):
 *   pool = ALL megacode attempts for the student (practice and test)
 *   >= 1 pass  -> export the best passing sheet only
 *   zero pass  -> export ALL attempt sheets (non-issuance / programme-hold evidence)
 * Pure (type-only imports) so it can be tested without the database.
 */
import type { MegacodeReportRow, MegacodeAttempt } from '@/lib/reports/aha/megacode';

function byDate(a: MegacodeAttempt, b: MegacodeAttempt): number {
  return (a.stationDate ?? '').localeCompare(b.stationDate ?? '');
}

/** The sheet rows to print for one student: one row per sheet, `best` set to that sheet's attempt. */
export function exportRowsFor(row: MegacodeReportRow): MegacodeReportRow[] {
  if (!row.best) return [row];
  const hasPass = row.allAttempts.some((a) => a.result === 'pass');
  if (hasPass || row.allAttempts.length <= 1) return [row];
  const attempts = [...row.allAttempts].sort(byDate);
  return attempts.map((a, i) => ({
    ...row,
    best: a,
    flags: [...row.flags.filter((f) => !f.startsWith('No pass')), `No passing attempt — attempt ${i + 1} of ${attempts.length} (all attempts exported)`],
  }));
}
