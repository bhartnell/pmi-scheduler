'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { GraduationCap, Loader2, PlayCircle, ShieldAlert } from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import { useEffectiveRole } from '@/hooks/useEffectiveRole';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageLoader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import Breadcrumbs from '@/components/Breadcrumbs';
import type { CurrentUser } from '@/types';

interface Cohort {
  id: string;
  cohort_number: string | number;
  program?: { name: string; abbreviation: string } | null;
}

interface DayPlan {
  template_id: string;
  day_number: number;
  section_number: number | null;
  section_label: string | null;
  title: string;
  date: string;
  is_adv_cert_testing: boolean;
  action: 'create' | 'skip_existing';
  stations: Array<{ station_number: number; custom_title: string | null; station_type: string }>;
}

interface GenerateResult {
  success: boolean;
  dry_run: boolean;
  created_count: number;
  skipped_count: number;
  plan: DayPlan[];
  errors: string[];
  error?: string;
}

interface TemplateOpt { id: string; name: string; day_number: number; section_number: number | null; section_label: string | null }
interface LabDayOpt { id: string; date: string; section_number: number | null; section_label: string | null; cert_course: string | null; is_adv_cert_testing: boolean; source_template_id: string | null }
interface ConfigureFieldChange { field: string; from: unknown; to: unknown; action: string }
interface ConfigureStationChange { station_number: number; action: string; detail: string }
interface ConfigureResult {
  success: boolean;
  dry_run: boolean;
  field_changes: ConfigureFieldChange[];
  station_changes: ConfigureStationChange[];
  errors: string[];
  error?: string;
}

// ---------------------------------------------------------------------------
// AHA-generic course generator UI (Checkpoint A).
//
// Minimal, UI-editable trigger for "create AHA course for cohort" — the
// full wizard (auto-swap didactic/lab days, instructor holds, per-instructor
// assignment, part-timer self-request) is explicitly DEFERRED per the
// approved design; this is deliberately just cohort + course + dates +
// dry-run, matching the checkpoint's "minimal, not the full wizard" scope.
// ---------------------------------------------------------------------------
export default function AhaCoursesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const effectiveRole = useEffectiveRole(currentUser?.role ?? null);

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [cohortId, setCohortId] = useState('');
  const [certCourse, setCertCourse] = useState<'acls' | 'pals'>('acls');
  const [dayNumbers, setDayNumbers] = useState<number[]>([]);
  const [dayDates, setDayDates] = useState<Record<number, string>>({});
  const [dryRun, setDryRun] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);

  // "Configure existing day" mode (Checkpoint B) — attaches a template onto a
  // lab_days row that already exists, instead of creating a new one.
  const [configCohortId, setConfigCohortId] = useState('');
  const [configCourse, setConfigCourse] = useState<'acls' | 'pals'>('pals');
  const [configTemplates, setConfigTemplates] = useState<TemplateOpt[]>([]);
  const [configLabDays, setConfigLabDays] = useState<LabDayOpt[]>([]);
  const [configTemplateId, setConfigTemplateId] = useState('');
  const [configLabDayId, setConfigLabDayId] = useState('');
  const [configDryRun, setConfigDryRun] = useState(true);
  const [configuring, setConfiguring] = useState(false);
  const [configResult, setConfigResult] = useState<ConfigureResult | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) fetchCurrentUser();
  }, [session]);

  useEffect(() => {
    if (effectiveRole && !canAccessAdmin(effectiveRole)) router.push('/');
  }, [effectiveRole, router]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        if (!canAccessAdmin(data.user.role)) {
          router.push('/');
          return;
        }
        setCurrentUser(data.user);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetch('/api/lab-management/cohorts?activeOnly=true')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setCohorts(d.cohorts || []);
      })
      .catch(() => {});
  }, []);

  const loadDayNumbers = useCallback((course: 'acls' | 'pals') => {
    fetch(`/api/admin/aha-courses/generate?cert_course=${course}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setDayNumbers(d.day_numbers || []);
          setDayDates({});
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadDayNumbers(certCourse);
  }, [certCourse, loadDayNumbers]);

  const handleGenerate = async () => {
    if (!cohortId) {
      toast.error('Select a cohort first');
      return;
    }
    if (dayNumbers.some((d) => !dayDates[d])) {
      toast.error('Enter a date for every day in the course');
      return;
    }
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/aha-courses/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cohort_id: cohortId,
          cert_course: certCourse,
          day_dates: dayDates,
          dry_run: dryRun,
        }),
      });
      const data = await res.json();
      setResult(data);
      if (!res.ok) {
        toast.error(data.error || 'Generation failed');
      } else {
        toast.success(dryRun ? 'Dry-run plan generated' : 'Course generated');
      }
    } catch {
      toast.error('Request failed');
    }
    setGenerating(false);
  };

  useEffect(() => {
    fetch(`/api/admin/aha-courses/configure-day?cert_course=${configCourse}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setConfigTemplates(d.templates || []); })
      .catch(() => {});
    setConfigTemplateId('');
  }, [configCourse]);

  useEffect(() => {
    if (!configCohortId) { setConfigLabDays([]); setConfigLabDayId(''); return; }
    fetch(`/api/admin/aha-courses/configure-day?cohort_id=${configCohortId}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setConfigLabDays(d.lab_days || []); })
      .catch(() => {});
    setConfigLabDayId('');
  }, [configCohortId]);

  const handleConfigureDay = async () => {
    if (!configLabDayId || !configTemplateId) {
      toast.error('Select both a lab day and a template');
      return;
    }
    setConfiguring(true);
    setConfigResult(null);
    try {
      const res = await fetch('/api/admin/aha-courses/configure-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lab_day_id: configLabDayId, template_id: configTemplateId, dry_run: configDryRun }),
      });
      const data = await res.json();
      setConfigResult(data);
      if (!res.ok) toast.error(data.error || 'Configure failed');
      else toast.success(configDryRun ? 'Dry-run plan generated' : 'Day configured');
    } catch {
      toast.error('Request failed');
    }
    setConfiguring(false);
  };

  if (status === 'loading' || loading) return <PageLoader />;
  if (!session || !currentUser) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <Breadcrumbs className="mb-2" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <GraduationCap className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AHA Course Generator</h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Create a cohort&apos;s ACLS or PALS course days from the generic AHA template
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Additive only. If a cohort already has a lab day at the target date/section, it is left
            untouched and reported as skipped — this tool never updates or deletes existing rows.
            Always run a dry run first.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Course
              </label>
              <select
                value={certCourse}
                onChange={(e) => setCertCourse(e.target.value as 'acls' | 'pals')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="acls">ACLS</option>
                <option value="pals">PALS</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cohort
              </label>
              <select
                value={cohortId}
                onChange={(e) => setCohortId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select a cohort…</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.program?.abbreviation || c.program?.name || ''} {c.cohort_number}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {dayNumbers.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No &quot;{certCourse}&quot; certification templates found yet.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {dayNumbers.map((d) => (
                <div key={d}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Day {d} date
                  </label>
                  <input
                    type="date"
                    value={dayDates[d] || ''}
                    onChange={(e) => setDayDates((prev) => ({ ...prev, [d]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              ))}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
            Dry run (show the plan, write nothing)
          </label>

          <button
            onClick={handleGenerate}
            disabled={generating || !cohortId || dayNumbers.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-medium"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
            {dryRun ? 'Preview plan' : 'Generate course'}
          </button>
        </div>

        {result && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 space-y-3">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              {result.dry_run ? 'Dry-run plan' : 'Generation result'}
            </h2>
            {result.error && <p className="text-sm text-red-600 dark:text-red-400">{result.error}</p>}
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {result.created_count} to create · {result.skipped_count} already exist (skipped)
            </p>
            {result.errors?.length > 0 && (
              <ul className="text-sm text-red-600 dark:text-red-400 list-disc pl-5">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="py-1.5 pr-3">Day</th>
                    <th className="py-1.5 pr-3">Section</th>
                    <th className="py-1.5 pr-3">Title</th>
                    <th className="py-1.5 pr-3">Date</th>
                    <th className="py-1.5 pr-3">Stations</th>
                    <th className="py-1.5 pr-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {result.plan?.map((p) => (
                    <tr key={p.template_id} className="border-b border-gray-100 dark:border-gray-700/50">
                      <td className="py-1.5 pr-3">{p.day_number}</td>
                      <td className="py-1.5 pr-3">{p.section_label || p.section_number || '—'}</td>
                      <td className="py-1.5 pr-3">{p.title}</td>
                      <td className="py-1.5 pr-3">{p.date}</td>
                      <td className="py-1.5 pr-3">{p.stations.length}</td>
                      <td className="py-1.5 pr-3">
                        <span
                          className={
                            p.action === 'create'
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-gray-400 dark:text-gray-500'
                          }
                        >
                          {p.action === 'create' ? 'Create' : 'Skip (exists)'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Configure an existing day (Checkpoint B)</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            For a lab day that already exists (created by hand, or a placeholder) — attaches a template&apos;s
            cert_course/testing-flag/stations onto it. Gap-fill only: a field or station that already has a
            real value is never overwritten, and is reported as a conflict instead.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Course</label>
              <select value={configCourse} onChange={(e) => setConfigCourse(e.target.value as 'acls' | 'pals')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="acls">ACLS</option>
                <option value="pals">PALS</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cohort</label>
              <select value={configCohortId} onChange={(e) => setConfigCohortId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="">Select a cohort…</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>{c.program?.abbreviation || c.program?.name || ''} {c.cohort_number}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Existing lab day</label>
              <select value={configLabDayId} onChange={(e) => setConfigLabDayId(e.target.value)} disabled={!configCohortId}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50">
                <option value="">Select a day…</option>
                {configLabDays.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.date}{d.section_label ? ` — ${d.section_label}` : d.section_number ? ` — sec ${d.section_number}` : ''}
                    {d.cert_course ? ` [${d.cert_course}]` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Template to apply</label>
            <select value={configTemplateId} onChange={(e) => setConfigTemplateId(e.target.value)}
              className="w-full md:w-1/2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="">Select a template…</option>
              {configTemplates.map((t) => (
                <option key={t.id} value={t.id}>Day {t.day_number}{t.section_label ? ` — ${t.section_label}` : ''}: {t.name}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={configDryRun} onChange={(e) => setConfigDryRun(e.target.checked)} />
            Dry run (show the plan, write nothing)
          </label>

          <button onClick={handleConfigureDay} disabled={configuring || !configLabDayId || !configTemplateId}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-medium">
            {configuring ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
            {configDryRun ? 'Preview plan' : 'Configure day'}
          </button>
        </div>

        {configResult && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 space-y-3">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              {configResult.dry_run ? 'Dry-run plan' : 'Configure result'}
            </h2>
            {configResult.error && <p className="text-sm text-red-600 dark:text-red-400">{configResult.error}</p>}
            {configResult.errors?.length > 0 && (
              <ul className="text-sm text-red-600 dark:text-red-400 list-disc pl-5">
                {configResult.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Day-level fields</h3>
              <ul className="text-sm space-y-0.5">
                {configResult.field_changes?.length === 0 && <li className="text-gray-400">No changes.</li>}
                {configResult.field_changes?.map((c, i) => (
                  <li key={i} className={c.action === 'conflict_skipped' ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}>
                    {c.field}: {JSON.stringify(c.from)} → {JSON.stringify(c.to)} ({c.action === 'conflict_skipped' ? 'CONFLICT — left alone' : 'fill gap'})
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Stations</h3>
              <ul className="text-sm space-y-0.5">
                {configResult.station_changes?.map((c, i) => (
                  <li key={i} className={c.action === 'conflict_skipped' ? 'text-amber-600 dark:text-amber-400' : c.action === 'no_change_needed' ? 'text-gray-400' : 'text-green-600 dark:text-green-400'}>
                    #{c.station_number}: {c.detail} ({c.action})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
