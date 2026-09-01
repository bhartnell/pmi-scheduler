'use client';

/**
 * /admin/semesters — Year + semester management.
 *
 * Top half:  list of academic years (one card per year). Each card
 *            shows S1–S4 + the 1-week breaks between. Inline buttons:
 *              "Edit semester"        → date editor + cascade dialog
 *              "Recalculate from S1"  → re-derives all 4 from anchor
 *              "Delete year"          → unlinks semesters, removes anchor
 *
 * Bottom of card: "+ New academic year" form. Operator enters S1
 * start date and the cascade preview lights up live; Save commits
 * to pmi_academic_years + pmi_semesters in one trip.
 *
 * Key invariants the API + UI share:
 *   - 15-week semesters (start + 104 days = end inclusive)
 *   - 1-week review break between consecutive semesters
 *   - S(n+1) start = S(n) start + 16 weeks (= +112 days)
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Home,
  ChevronRight,
  Calendar,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  X,
  CalendarClock,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageLoader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { cascadeFromS1Start, type CascadeResult } from '@/lib/semester-cascade';
import type { CurrentUser } from '@/types';

interface SemesterRow {
  id: string;
  academic_year_id: string;
  semester_number: 1 | 2 | 3 | 4 | null;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

interface AcademicYear {
  id: string;
  year: number;
  s1_start_date: string;
  notes: string | null;
  semesters: SemesterRow[];
}

interface CohortRow {
  cohort_id: string;
  cohort_number: number | null;
  program_abbreviation: string | null;
  program_name: string | null;
  has_override: boolean;
  override_start_date: string | null;
  override_end_date: string | null;
}

export default function SemestersAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);

  // New-year form state
  const [newYearForm, setNewYearForm] = useState<{
    year: string;
    s1_start_date: string;
    notes: string;
  }>({ year: String(new Date().getFullYear()), s1_start_date: '', notes: '' });
  const [creating, setCreating] = useState(false);

  // Edit-semester modal state
  const [editingSemester, setEditingSemester] = useState<SemesterRow | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
  }, [status, router]);

  useEffect(() => {
    if (!session?.user?.email) return;
    fetch('/api/instructor/me')
      .then(r => r.json())
      .then(data => {
        const user = (data.user || data) as CurrentUser;
        setCurrentUser(user);
        if (!canAccessAdmin(user.role)) {
          router.push('/');
        }
      })
      .catch(() => {});
  }, [session, router]);

  const loadYears = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/academic-years');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load years');
      setYears(data.years ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load years');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser && canAccessAdmin(currentUser.role)) {
      loadYears();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Live preview of the cascade as the operator types in the form.
  // The same calculator runs server-side on POST so what you see
  // here is exactly what gets written.
  const cascadePreview: CascadeResult | null = useMemo(() => {
    const yr = parseInt(newYearForm.year, 10);
    if (
      !newYearForm.s1_start_date ||
      !/^\d{4}-\d{2}-\d{2}$/.test(newYearForm.s1_start_date) ||
      !Number.isFinite(yr)
    ) {
      return null;
    }
    return cascadeFromS1Start(newYearForm.s1_start_date, yr);
  }, [newYearForm.s1_start_date, newYearForm.year]);

  const handleCreateYear = async () => {
    if (!cascadePreview) return;
    setCreating(true);
    try {
      const res = await fetch('/api/admin/academic-years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: parseInt(newYearForm.year, 10),
          s1_start_date: newYearForm.s1_start_date,
          notes: newYearForm.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Academic year ${newYearForm.year} created with 4 semesters`);
      setNewYearForm({
        year: String(new Date().getFullYear() + 1),
        s1_start_date: '',
        notes: '',
      });
      await loadYears();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create year');
    } finally {
      setCreating(false);
    }
  };

  const handleRecalculate = async (year: AcademicYear) => {
    if (!confirm(`Recalculate all 4 semesters for ${year.year} from S1 start ${year.s1_start_date}? This overwrites the existing dates.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/academic-years/${year.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recalculate: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed');
      }
      toast.success(`Recalculated ${year.year}`);
      await loadYears();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to recalculate');
    }
  };

  const handleDeleteYear = async (year: AcademicYear) => {
    if (!confirm(`Delete academic year ${year.year}? Linked semesters will be unlinked but kept.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/academic-years/${year.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed');
      }
      toast.success(`Deleted year ${year.year}`);
      await loadYears();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  if (status === 'loading' || (currentUser && !canAccessAdmin(currentUser.role))) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400">
              <Home className="w-4 h-4" />
            </Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/admin" className="hover:text-blue-600 dark:hover:text-blue-400">
              Admin
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-900 dark:text-gray-100 font-medium">Semesters</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Semester management
          </h1>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-8">
          Set the S1 start date once per year — the system derives S2/S3/S4 dates
          (15-week semesters with a 1-week review break between). Per-cohort overrides handle off-calendar cohorts.
        </p>

        {/* ── New year card ──────────────────────────────────────── */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            New academic year
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Year
              </label>
              <input
                type="number"
                value={newYearForm.year}
                onChange={e => setNewYearForm(p => ({ ...p, year: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                S1 start date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={newYearForm.s1_start_date}
                onChange={e => setNewYearForm(p => ({ ...p, s1_start_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes (optional)
              </label>
              <input
                type="text"
                value={newYearForm.notes}
                onChange={e => setNewYearForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="e.g. shifted 1 week for July 4"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          {cascadePreview && <CascadePreview cascade={cascadePreview} />}

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleCreateYear}
              disabled={!cascadePreview || creating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-60"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {creating ? 'Saving…' : 'Create year + 4 semesters'}
            </button>
          </div>
        </section>

        {/* ── Existing years ────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : years.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-10 text-center text-gray-500 dark:text-gray-400">
            No academic years yet. Create one above.
          </div>
        ) : (
          <div className="space-y-6">
            {years.map(y => (
              <YearCard
                key={y.id}
                year={y}
                onEditSemester={s => setEditingSemester(s)}
                onRecalculate={() => handleRecalculate(y)}
                onDelete={() => handleDeleteYear(y)}
              />
            ))}
          </div>
        )}
      </main>

      {editingSemester && (
        <EditSemesterModal
          semester={editingSemester}
          onClose={() => setEditingSemester(null)}
          onSaved={async () => {
            setEditingSemester(null);
            await loadYears();
          }}
        />
      )}
    </div>
  );
}

// ─── Cascade preview panel ──────────────────────────────────────────────────

function CascadePreview({ cascade }: { cascade: CascadeResult }) {
  return (
    <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
      <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-2">
        Cascade preview
      </p>
      <div className="space-y-1.5">
        {cascade.semesters.map((s, i) => (
          <div key={s.number}>
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-semibold">
                S{s.number}
              </span>
              <span className="font-medium text-blue-900 dark:text-blue-100">{s.name}</span>
              <span className="text-blue-700 dark:text-blue-300">
                {s.start_date} → {s.end_date}
              </span>
            </div>
            {i < cascade.breaks.length && (
              <div className="ml-8 text-xs text-blue-600/80 dark:text-blue-400/80 italic">
                Break: {cascade.breaks[i].start_date} → {cascade.breaks[i].end_date}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Year card ──────────────────────────────────────────────────────────────

function YearCard({
  year,
  onEditSemester,
  onRecalculate,
  onDelete,
}: {
  year: AcademicYear;
  onEditSemester: (s: SemesterRow) => void;
  onRecalculate: () => void;
  onDelete: () => void;
}) {
  const sortedSems = [...year.semesters].sort(
    (a, b) => (a.semester_number ?? 0) - (b.semester_number ?? 0)
  );

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Academic year {year.year}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            S1 start: <strong>{year.s1_start_date}</strong>
            {year.notes ? ` · ${year.notes}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRecalculate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            title="Re-derive all 4 semester dates from the S1 start"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Recalculate
          </button>
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete year
          </button>
        </div>
      </div>

      {sortedSems.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No linked semesters. Click Recalculate to derive from S1 start.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sortedSems.map(s => (
            <div
              key={s.id}
              className="flex items-start justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-semibold">
                    S{s.semester_number ?? '?'}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {s.name}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 ml-8">
                  {s.start_date} → {s.end_date}
                </p>
              </div>
              <button
                onClick={() => onEditSemester(s)}
                className="flex-shrink-0 p-1.5 rounded text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-gray-700"
                title="Edit semester dates"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Edit semester modal (with cohort cascade) ──────────────────────────────

function EditSemesterModal({
  semester,
  onClose,
  onSaved,
}: {
  semester: SemesterRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(semester.name);
  const [startDate, setStartDate] = useState(semester.start_date);
  const [endDate, setEndDate] = useState(semester.end_date);
  const [cohorts, setCohorts] = useState<CohortRow[] | null>(null);
  const [selectedCohorts, setSelectedCohorts] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Per-cohort manual start/stop window drafts, keyed by cohort_id.
  // A value of 'remove' clears an existing override on save; an
  // object upserts a new/edited window. Cohorts with no entry here
  // are left untouched.
  const [overrideDrafts, setOverrideDrafts] = useState<
    Map<string, { start_date: string; end_date: string } | 'remove'>
  >(new Map());
  const [editingWindowFor, setEditingWindowFor] = useState<string | null>(null);

  // Load cohorts in this semester so the cascade dialog renders.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/scheduling/planner/semesters/${semester.id}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const list: CohortRow[] = data.cohorts ?? [];
        setCohorts(list);
        // Default-select cohorts WITHOUT overrides (per spec).
        setSelectedCohorts(
          new Set(list.filter(c => !c.has_override).map(c => c.cohort_id))
        );
      })
      .catch(() => {
        if (!cancelled) setCohorts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [semester.id]);

  const dateChanged = startDate !== semester.start_date || endDate !== semester.end_date;
  const overriddenCohorts = (cohorts ?? []).filter(c => c.has_override);
  const overriddenSelected = overriddenCohorts.filter(c => selectedCohorts.has(c.cohort_id));

  const toggleCohort = (id: string) => {
    setSelectedCohorts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Only include `delete_cohort_overrides` for cohorts that BOTH
      // have an override AND were selected. Cohorts without
      // overrides automatically pick up the new dates via the
      // resolver's tier-2 fallback. Merge in any explicit removals
      // from the cohort-window editor below (deduped via Set).
      const deleteOverrides = new Set(overriddenSelected.map(c => c.cohort_id));
      const upsertOverrides: { cohort_id: string; start_date: string; end_date: string }[] = [];
      overrideDrafts.forEach((draft, cohortId) => {
        if (draft === 'remove') {
          deleteOverrides.add(cohortId);
        } else {
          upsertOverrides.push({ cohort_id: cohortId, ...draft });
        }
      });

      const res = await fetch(
        `/api/scheduling/planner/semesters/${semester.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            start_date: startDate,
            end_date: endDate,
            delete_cohort_overrides: Array.from(deleteOverrides),
            upsert_cohort_overrides: upsertOverrides,
          }),
        }
      );
      if (!res.ok && res.status !== 207) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      const data = await res.json();
      const parts: string[] = [];
      if (data.overrides_upserted > 0) {
        parts.push(`${data.overrides_upserted} window${data.overrides_upserted === 1 ? '' : 's'} saved`);
      }
      if (data.overrides_deleted > 0) {
        parts.push(`${data.overrides_deleted} override${data.overrides_deleted === 1 ? '' : 's'} removed`);
      }
      if (data.override_upsert_error) {
        toast.error(`Semester saved, but window save failed: ${data.override_upsert_error}`);
      } else {
        toast.success(parts.length > 0 ? `Saved · ${parts.join(', ')}` : 'Saved');
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Edit S{semester.semester_number ?? '?'}: {semester.name}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                End date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Cohort cascade dialog — only visible when a date changed
              AND there are cohorts in this semester. */}
          {dateChanged && cohorts !== null && cohorts.length > 0 && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                    Date change cascade
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-200 mt-0.5">
                    Cohorts WITHOUT an override automatically pick up the new dates. Cohorts WITH an override stay on their current schedule unless you opt them in below.
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                {cohorts.map(c => {
                  const checked = selectedCohorts.has(c.cohort_id);
                  return (
                    <label
                      key={c.cohort_id}
                      className="flex items-center gap-2 text-xs cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCohort(c.cohort_id)}
                        disabled={!c.has_override}
                        className="rounded border-gray-300"
                      />
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {c.program_abbreviation || '?'} G{c.cohort_number ?? '?'}
                      </span>
                      {c.has_override ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-200 text-amber-900 dark:bg-amber-700 dark:text-amber-100">
                          OVERRIDE — opt in to drop
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          auto-cascade
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Per-cohort schedule windows — the manual start/stop
              mechanism for a cohort that runs off the standard
              calendar or bridges two semesters by a week or two.
              Always visible (not gated by dateChanged) since this
              is independent of whether the semester's own dates
              were edited this session. */}
          {cohorts !== null && cohorts.length > 0 && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-start gap-2 mb-3">
                <CalendarClock className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                    Per-cohort schedule windows
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    Set a manual start/stop date for a cohort instead of the semester&apos;s standard dates — for a cohort that starts off-calendar or bridges into the next semester by a week or two.
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                {cohorts.map(c => (
                  <CohortWindowRow
                    key={c.cohort_id}
                    cohort={c}
                    editing={editingWindowFor === c.cohort_id}
                    draft={overrideDrafts.get(c.cohort_id)}
                    onStartEdit={() => setEditingWindowFor(c.cohort_id)}
                    onCancelEdit={() => setEditingWindowFor(null)}
                    onSaveDraft={(start, end) => {
                      setOverrideDrafts(prev => {
                        const next = new Map(prev);
                        next.set(c.cohort_id, { start_date: start, end_date: end });
                        return next;
                      });
                      setEditingWindowFor(null);
                    }}
                    onRemove={() => {
                      setOverrideDrafts(prev => {
                        const next = new Map(prev);
                        next.set(c.cohort_id, 'remove');
                        return next;
                      });
                      setEditingWindowFor(null);
                    }}
                    onUndo={() => {
                      setOverrideDrafts(prev => {
                        const next = new Map(prev);
                        next.delete(c.cohort_id);
                        return next;
                      });
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Per-cohort schedule window row ─────────────────────────────────────────

function CohortWindowRow({
  cohort,
  editing,
  draft,
  onStartEdit,
  onCancelEdit,
  onSaveDraft,
  onRemove,
  onUndo,
}: {
  cohort: CohortRow;
  editing: boolean;
  draft: { start_date: string; end_date: string } | 'remove' | undefined;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveDraft: (start: string, end: string) => void;
  onRemove: () => void;
  onUndo: () => void;
}) {
  const effectiveStart =
    draft && draft !== 'remove' ? draft.start_date : cohort.override_start_date;
  const effectiveEnd =
    draft && draft !== 'remove' ? draft.end_date : cohort.override_end_date;
  const hasEffectiveWindow = draft === 'remove' ? false : !!effectiveStart && !!effectiveEnd;

  const [start, setStart] = useState(effectiveStart ?? '');
  const [end, setEnd] = useState(effectiveEnd ?? '');

  const label = `${cohort.program_abbreviation || '?'} G${cohort.cohort_number ?? '?'}`;

  if (editing) {
    return (
      <div className="flex flex-wrap items-end gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <span className="text-xs font-medium text-gray-900 dark:text-gray-100 mr-1">
          {label}
        </span>
        <div>
          <label className="block text-[10px] text-gray-600 dark:text-gray-400">Start</label>
          <input
            type="date"
            value={start}
            onChange={e => setStart(e.target.value)}
            className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-[10px] text-gray-600 dark:text-gray-400">End</label>
          <input
            type="date"
            value={end}
            onChange={e => setEnd(e.target.value)}
            className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-gray-100"
          />
        </div>
        <button
          onClick={() => start && end && onSaveDraft(start, end)}
          disabled={!start || !end || end < start}
          className="px-2 py-1 text-[11px] font-medium rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
        >
          Set
        </button>
        <button
          onClick={onCancelEdit}
          className="px-2 py-1 text-[11px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 text-xs py-1">
      <div className="flex items-center gap-2">
        <span className="font-medium text-gray-900 dark:text-gray-100">{label}</span>
        {hasEffectiveWindow ? (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
            {effectiveStart} → {effectiveEnd}
          </span>
        ) : (
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            Standard (semester dates)
          </span>
        )}
        {draft && draft !== 'remove' && (
          <span className="text-[10px] text-blue-700 dark:text-blue-300 italic">unsaved</span>
        )}
        {draft === 'remove' && (
          <span className="text-[10px] text-red-600 dark:text-red-400 italic">removing on save</span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {draft !== undefined ? (
          <button
            onClick={onUndo}
            className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-gray-700"
            title="Undo pending change"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <>
            <button
              onClick={onStartEdit}
              className="p-1 rounded text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-gray-700"
              title={hasEffectiveWindow ? 'Edit window' : 'Set custom window'}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {hasEffectiveWindow && (
              <button
                onClick={onRemove}
                className="p-1 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-white dark:hover:bg-gray-700"
                title="Remove window (fall back to semester dates)"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
