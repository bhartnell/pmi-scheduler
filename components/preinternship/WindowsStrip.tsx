'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, Loader2 } from 'lucide-react';
import { SA_STORAGE } from '@/lib/preinternship-storage';

interface CohortWindowRow {
  cohortId: string;
  cohortLabel: string;
  isTest: boolean;
  opensAt: string | null;
  closesAt: string | null;
}

const card = 'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5';
const btn = 'inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg text-sm font-medium disabled:opacity-50 whitespace-nowrap';
const btnPrimary = `${btn} bg-cyan-700 hover:bg-cyan-800 text-white`;
const btnGhost = `${btn} border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700`;
const btnDanger = `${btn} border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20`;
const dateInput = 'min-h-[36px] px-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100';

function isOpen(row: CohortWindowRow): boolean {
  if (!row.opensAt) return false;
  const now = Date.now();
  if (new Date(row.opensAt).getTime() > now) return false;
  if (row.closesAt && new Date(row.closesAt).getTime() <= now) return false;
  return true;
}

function fmt(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** YYYY-MM-DD from an ISO timestamp, for a date input's value. */
function dateInputValue(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
}

/** End of the selected local day, as an ISO timestamp ("closes" means through that day). */
function endOfDayIso(dateStr: string): string | null {
  if (!dateStr) return null;
  return new Date(`${dateStr}T23:59:59`).toISOString();
}

/** "Windows" strip (follow-up to RAE R3/3): one row per active cohort, open/close the
 *  pre-internship self-assessment per cohort. Instructor and up. */
export default function WindowsStrip() {
  const [rows, setRows] = useState<CohortWindowRow[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [draftClose, setDraftClose] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      const data = await SA_STORAGE.listWindows();
      setRows(data as CohortWindowRow[]);
    } catch {
      setError('Could not load windows.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openNow = async (row: CohortWindowRow) => {
    setBusy(row.cohortId);
    setError('');
    try {
      await SA_STORAGE.openWindow(row.cohortId, endOfDayIso(draftClose[row.cohortId] ?? ''));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open window');
    }
    setBusy(null);
  };

  const changeCloseDate = async (row: CohortWindowRow) => {
    setBusy(row.cohortId);
    setError('');
    try {
      await SA_STORAGE.setWindowCloseDate(row.cohortId, endOfDayIso(draftClose[row.cohortId] ?? ''));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change close date');
    }
    setBusy(null);
  };

  const closeNow = async (row: CohortWindowRow) => {
    setBusy(row.cohortId);
    setError('');
    try {
      await SA_STORAGE.setWindowCloseDate(row.cohortId, new Date().toISOString());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not close window');
    }
    setBusy(null);
  };

  if (rows === null) {
    return (
      <div className={`${card} flex items-center justify-center py-8`}>
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className={card}>
      <h2 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white mb-3">
        <CalendarClock className="w-5 h-5" /> Windows
      </h2>
      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}
      <div className="space-y-2">
        {rows.map((row) => {
          const open = isOpen(row);
          const working = busy === row.cohortId;
          return (
            <div
              key={row.cohortId}
              className="flex flex-wrap items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
            >
              <div className="min-w-[160px] font-medium text-gray-900 dark:text-white flex items-center gap-2">
                {row.cohortLabel}
                {row.isTest && (
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">
                    Test
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 min-w-[150px]">
                {!open && !row.opensAt && 'Closed'}
                {!open && row.opensAt && row.closesAt && `Closed since ${fmt(row.closesAt)}`}
                {open && !row.closesAt && `Open since ${fmt(row.opensAt)}`}
                {open && row.closesAt && `Open since ${fmt(row.opensAt)} · Closes ${fmt(row.closesAt)}`}
              </div>
              <div className="flex flex-wrap items-center gap-2 ml-auto">
                {!open ? (
                  <>
                    <input
                      type="date"
                      value={draftClose[row.cohortId] ?? ''}
                      onChange={(e) => setDraftClose((d) => ({ ...d, [row.cohortId]: e.target.value }))}
                      className={dateInput}
                      aria-label={`Optional close date for ${row.cohortLabel}`}
                    />
                    <button onClick={() => openNow(row)} disabled={working} className={btnPrimary}>
                      {working ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Open now'}
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      type="date"
                      value={draftClose[row.cohortId] ?? dateInputValue(row.closesAt)}
                      onChange={(e) => setDraftClose((d) => ({ ...d, [row.cohortId]: e.target.value }))}
                      className={dateInput}
                      aria-label={`Close date for ${row.cohortLabel}`}
                    />
                    <button onClick={() => changeCloseDate(row)} disabled={working} className={btnGhost}>
                      Change close date
                    </button>
                    <button onClick={() => closeNow(row)} disabled={working} className={btnDanger}>
                      {working ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Close now'}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 py-4">No active cohorts.</p>}
      </div>
    </div>
  );
}
