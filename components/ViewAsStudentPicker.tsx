'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Search, GraduationCap, Loader2 } from 'lucide-react';

interface Cohort {
  id: string;
  label: string;
  isTest: boolean;
}

interface StudentRow {
  id: string;
  name: string;
  isTest: boolean;
}

/**
 * "View as a student" picker (card STUDENT VIEW 3/4): cohort first, then
 * that cohort's students with type-to-filter. Never a flat list of every
 * student. Test students are listed first under a "Test" label.
 */
export default function ViewAsStudentPicker({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [cohortsLoading, setCohortsLoading] = useState(true);
  const [cohortId, setCohortId] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [settingId, setSettingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/view-as/cohorts')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => setCohorts(j.cohorts ?? []))
      .catch(() => setError('Could not load cohorts'))
      .finally(() => setCohortsLoading(false));
  }, []);

  useEffect(() => {
    if (!cohortId) return;
    setStudentsLoading(true);
    setError(null);
    fetch(`/api/admin/view-as/students?cohort_id=${cohortId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => setStudents(j.students ?? []))
      .catch(() => setError('Could not load students'))
      .finally(() => setStudentsLoading(false));
  }, [cohortId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const rows = q ? students.filter((s) => s.name.toLowerCase().includes(q)) : students;
    return rows;
  }, [students, filter]);
  const testRows = filtered.filter((s) => s.isTest);
  const realRows = filtered.filter((s) => !s.isTest);

  const pick = async (studentId: string) => {
    setSettingId(studentId);
    setError(null);
    try {
      const res = await fetch('/api/admin/view-as/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || 'Could not view as this student');
        setSettingId(null);
        return;
      }
      router.push('/student');
    } catch {
      setError('Could not view as this student');
      setSettingId(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="View as a student"
      className="fixed inset-0 z-[110] flex items-start justify-center bg-black/40 px-4 pt-20 print:hidden"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white dark:bg-gray-800 shadow-xl max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
            <GraduationCap className="w-5 h-5" /> View as a student
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Cohort</label>
            <select
              value={cohortId ?? ''}
              onChange={(e) => setCohortId(e.target.value || null)}
              disabled={cohortsLoading}
              className="w-full min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 text-sm"
            >
              <option value="">{cohortsLoading ? 'Loading…' : 'Choose a cohort…'}</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                  {c.isTest ? ' (Test)' : ''}
                </option>
              ))}
            </select>
          </div>

          {cohortId && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Student</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Type to filter…"
                  className="w-full min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 pl-8 pr-3 text-sm"
                />
              </div>

              <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                {studentsLoading ? (
                  <div className="flex items-center justify-center py-6 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">No students match</p>
                ) : (
                  <>
                    {testRows.length > 0 && (
                      <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20">
                        Test
                      </div>
                    )}
                    {testRows.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => pick(s.id)}
                        disabled={settingId !== null}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50"
                      >
                        <span className="text-gray-900 dark:text-white">{s.name}</span>
                        {settingId === s.id && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                      </button>
                    ))}
                    {realRows.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => pick(s.id)}
                        disabled={settingId !== null}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50"
                      >
                        <span className="text-gray-900 dark:text-white">{s.name}</span>
                        {settingId === s.id && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}
