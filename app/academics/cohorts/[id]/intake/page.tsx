'use client';

/**
 * /academics/cohorts/[id]/intake — Day 1 student intake table.
 *
 * One row per active student in the cohort. Coordinator captures
 * EMS level, agency, and intro notes as students introduce
 * themselves in random order. Each field auto-saves on change
 * with a per-row "Saved" indicator. Touch-friendly for tablet
 * use during the intro session.
 *
 * Data goes to:
 *   - students.prior_cert_level (text, no enum constraint)
 *   - students.agency           (text — agency NAME, not FK; the
 *                                agencies table is used only as
 *                                a typeahead source, and "Other"
 *                                free-text is accepted)
 *   - students.notes            (text — single line OK, multi-line
 *                                rendered as <textarea>)
 *
 * Wired to the existing PATCH /api/lab-management/students/[id]
 * which now accepts prior_cert_level + agency (see the route
 * file's allowedFields whitelist).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Home,
  ChevronRight,
  ArrowLeft,
  Users,
  Check,
  Loader2,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageLoader } from '@/components/ui';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  prior_cert_level: string | null;
  agency: string | null;
  notes: string | null;
}

interface Agency {
  id: string;
  name: string;
}

const EMS_LEVELS = [
  '',
  'EMT-Basic',
  'AEMT',
  'Paramedic',
  'None / Student only',
];

const AUTOSAVE_DEBOUNCE_MS = 600;

type RowState = 'idle' | 'saving' | 'saved' | 'error';

export default function Day1IntakePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const cohortId = params.id as string;

  const [students, setStudents] = useState<Student[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cohortLabel, setCohortLabel] = useState('');

  // Per-row save state, keyed by student id.
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  // Debounce timers per (student, field), keyed by `${id}.${field}`.
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
  }, [status, router]);

  useEffect(() => {
    if (!session?.user?.email) return;
    let cancelled = false;
    (async () => {
      try {
        const [sRes, aRes, cRes] = await Promise.all([
          fetch(`/api/lab-management/students?cohortId=${cohortId}&status=active`),
          fetch('/api/clinical/agencies?activeOnly=true'),
          fetch(`/api/lab-management/cohorts/${cohortId}`),
        ]);
        const sData = await sRes.json();
        const aData = await aRes.json();
        const cData = cRes.ok ? await cRes.json() : null;

        if (cancelled) return;

        if (sData.success) {
          // Sort alphabetically by last name initially. Operator
          // can scroll/tap any row to focus during intros.
          const list: Student[] = (sData.students ?? []).map((s: Student) => ({
            id: s.id,
            first_name: s.first_name || '',
            last_name: s.last_name || '',
            email: s.email,
            prior_cert_level: s.prior_cert_level,
            agency: s.agency,
            notes: s.notes,
          }));
          list.sort((a, b) =>
            (a.last_name || '').localeCompare(b.last_name || '') ||
            (a.first_name || '').localeCompare(b.first_name || '')
          );
          setStudents(list);
        } else {
          setError(sData.error || 'Failed to load students');
        }
        if (aData.success) setAgencies(aData.agencies ?? []);
        if (cData?.cohort) {
          const c = cData.cohort;
          const abbr = c.program?.abbreviation || c.program?.name || '';
          setCohortLabel(`${abbr} Cohort ${c.cohort_number}`);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, cohortId]);

  const saveField = (studentId: string, field: keyof Student, value: string | null) => {
    const key = `${studentId}.${field}`;
    const existing = timersRef.current.get(key);
    if (existing) clearTimeout(existing);

    const t = setTimeout(async () => {
      timersRef.current.delete(key);
      setRowState(prev => ({ ...prev, [studentId]: 'saving' }));
      try {
        const res = await fetch(`/api/lab-management/students/${studentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: value }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        setRowState(prev => ({ ...prev, [studentId]: 'saved' }));
        // Fade the "Saved" indicator after 2 seconds.
        setTimeout(() => {
          setRowState(prev => {
            if (prev[studentId] !== 'saved') return prev;
            const next = { ...prev };
            delete next[studentId];
            return next;
          });
        }, 2000);
      } catch (err) {
        console.error('Intake save failed', err);
        setRowState(prev => ({ ...prev, [studentId]: 'error' }));
      }
    }, AUTOSAVE_DEBOUNCE_MS);

    timersRef.current.set(key, t);
  };

  const updateField = <K extends keyof Student>(studentId: string, field: K, value: Student[K]) => {
    setStudents(prev =>
      prev.map(s => (s.id === studentId ? { ...s, [field]: value } : s))
    );
    saveField(studentId, field, value as string | null);
  };

  const agencyOptions = useMemo(
    () =>
      agencies
        .map(a => a.name)
        .filter((n): n is string => !!n)
        .sort((a, b) => a.localeCompare(b)),
    [agencies]
  );

  if (status === 'loading') return <PageLoader />;
  if (!session) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400">
              <Home className="w-4 h-4" />
            </Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/academics/cohorts" className="hover:text-blue-600 dark:hover:text-blue-400">
              Cohorts
            </Link>
            <ChevronRight className="w-3 h-3" />
            <Link href={`/academics/cohorts/${cohortId}`} className="hover:text-blue-600 dark:hover:text-blue-400 truncate max-w-[200px]">
              {cohortLabel || 'Cohort'}
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-900 dark:text-gray-100 font-medium">Day 1 Intake</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/academics/cohorts/${cohortId}`}
              className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
              Day 1 Intake
              {cohortLabel ? <span className="text-gray-500 dark:text-gray-400 font-normal text-base sm:text-lg"> · {cohortLabel}</span> : null}
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {students.length} student{students.length === 1 ? '' : 's'} · auto-saves on change
          </p>
        </div>

        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-8 text-center text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-800 dark:text-red-200">
            {error}
          </div>
        ) : students.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-8 text-center text-gray-500">
            No active students in this cohort.
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
            {/* Desktop table header */}
            <div className="hidden sm:grid grid-cols-12 gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-900/40 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
              <div className="col-span-3">Student</div>
              <div className="col-span-2">EMS Level</div>
              <div className="col-span-3">Agency</div>
              <div className="col-span-3">Notes</div>
              <div className="col-span-1 text-right">Saved</div>
            </div>

            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {students.map(s => {
                const state = rowState[s.id];
                return (
                  <li
                    key={s.id}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-3 px-4 py-3 sm:items-center"
                  >
                    {/* Student name */}
                    <div className="sm:col-span-3">
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {s.last_name}, {s.first_name}
                      </p>
                      {s.email && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{s.email}</p>
                      )}
                    </div>

                    {/* EMS Level */}
                    <div className="sm:col-span-2">
                      <label className="sm:hidden block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">EMS Level</label>
                      <select
                        value={s.prior_cert_level ?? ''}
                        onChange={e =>
                          updateField(s.id, 'prior_cert_level', e.target.value === '' ? null : e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                      >
                        {EMS_LEVELS.map(l => (
                          <option key={l} value={l}>
                            {l === '' ? '— Not set —' : l}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Agency */}
                    <div className="sm:col-span-3">
                      <label className="sm:hidden block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Agency</label>
                      <input
                        list={`agencies-${s.id}`}
                        value={s.agency ?? ''}
                        onChange={e =>
                          updateField(s.id, 'agency', e.target.value === '' ? null : e.target.value)
                        }
                        placeholder="Type or pick…"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                      />
                      <datalist id={`agencies-${s.id}`}>
                        {agencyOptions.map(name => (
                          <option key={name} value={name} />
                        ))}
                      </datalist>
                    </div>

                    {/* Notes */}
                    <div className="sm:col-span-3">
                      <label className="sm:hidden block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notes</label>
                      <input
                        type="text"
                        value={s.notes ?? ''}
                        onChange={e =>
                          updateField(s.id, 'notes', e.target.value === '' ? null : e.target.value)
                        }
                        placeholder="Hometown, fun fact, etc."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                      />
                    </div>

                    {/* Save state */}
                    <div className="sm:col-span-1 text-right">
                      {state === 'saving' && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving
                        </span>
                      )}
                      {state === 'saved' && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                          <Check className="w-3.5 h-3.5" /> Saved
                        </span>
                      )}
                      {state === 'error' && (
                        <span className="text-xs text-red-600 dark:text-red-400">Failed</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
