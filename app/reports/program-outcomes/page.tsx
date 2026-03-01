'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  TrendingUp,
  Loader2,
  Download,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  X,
  GraduationCap,
  Award,
  Briefcase,
  Star,
  Clock,
  BarChart3,
  FileText,
} from 'lucide-react';

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

interface Cohort {
  id: string;
  cohort_number: number;
  program: { id: string; name: string; abbreviation: string } | null;
}

interface ProgramOutcome {
  id: string;
  cohort_id: string | null;
  year: number;
  graduation_rate: number | null;
  cert_pass_rate: number | null;
  job_placement_rate: number | null;
  employer_satisfaction: number | null;
  avg_completion_months: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  cohort: {
    id: string;
    cohort_number: number;
    program: { id: string; name: string; abbreviation: string } | null;
  } | null;
}

interface FormState {
  id: string;
  cohort_id: string;
  year: string;
  graduation_rate: string;
  cert_pass_rate: string;
  job_placement_rate: string;
  employer_satisfaction: string;
  avg_completion_months: string;
  notes: string;
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function fmtPct(val: number | null): string {
  if (val === null || val === undefined) return '—';
  return `${val.toFixed(1)}%`;
}

function fmtMonths(val: number | null): string {
  if (val === null || val === undefined) return '—';
  return `${val.toFixed(1)} mo`;
}

function rateColor(val: number | null): string {
  if (val === null) return 'text-gray-400 dark:text-gray-500';
  if (val >= 90) return 'text-green-600 dark:text-green-400';
  if (val >= 75) return 'text-yellow-600 dark:text-yellow-400';
  if (val >= 60) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

function barBg(val: number | null): string {
  if (val === null) return 'bg-gray-300 dark:bg-gray-600';
  if (val >= 90) return 'bg-green-500';
  if (val >= 75) return 'bg-yellow-500';
  if (val >= 60) return 'bg-orange-500';
  return 'bg-red-500';
}

const EMPTY_FORM: FormState = {
  id: '',
  cohort_id: '',
  year: new Date().getFullYear().toString(),
  graduation_rate: '',
  cert_pass_rate: '',
  job_placement_rate: '',
  employer_satisfaction: '',
  avg_completion_months: '',
  notes: '',
};

// ─────────────────────────────────────────
// Trend bar chart component
// ─────────────────────────────────────────

function TrendChart({
  outcomes,
  metricKey,
  label,
  color,
}: {
  outcomes: ProgramOutcome[];
  metricKey: keyof Pick<
    ProgramOutcome,
    'graduation_rate' | 'cert_pass_rate' | 'job_placement_rate' | 'employer_satisfaction'
  >;
  label: string;
  color: string;
}) {
  // Group by year and average
  const byYear: Record<number, number[]> = {};
  for (const o of outcomes) {
    const val = o[metricKey];
    if (val !== null && val !== undefined) {
      if (!byYear[o.year]) byYear[o.year] = [];
      byYear[o.year].push(val as number);
    }
  }

  const years = Object.keys(byYear)
    .map(Number)
    .sort((a, b) => a - b);

  if (years.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{label}</h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">No data</p>
      </div>
    );
  }

  const avgByYear = years.map((yr) => {
    const vals = byYear[yr];
    return { year: yr, avg: vals.reduce((s, v) => s + v, 0) / vals.length };
  });

  const maxVal = Math.max(...avgByYear.map((r) => r.avg), 1);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{label} by Year</h3>
      <div className="space-y-2">
        {avgByYear.map(({ year, avg }) => {
          const barPct = Math.round((avg / maxVal) * 100);
          return (
            <div key={year} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 w-12 flex-shrink-0 text-right">
                {year}
              </span>
              <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-5 overflow-hidden">
                <div
                  className={`${color} h-5 rounded-full flex items-center justify-end pr-2 transition-all duration-500`}
                  style={{ width: `${barPct}%` }}
                >
                  {barPct > 25 && (
                    <span className="text-white text-xs font-medium">{avg.toFixed(1)}%</span>
                  )}
                </div>
              </div>
              {barPct <= 25 && (
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-14 text-right flex-shrink-0">
                  {avg.toFixed(1)}%
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Outcome form modal
// ─────────────────────────────────────────

function OutcomeFormModal({
  form,
  cohorts,
  saving,
  formError,
  onChange,
  onSave,
  onClose,
}: {
  form: FormState;
  cohorts: Cohort[];
  saving: boolean;
  formError: string | null;
  onChange: (key: keyof FormState, value: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const isEdit = !!form.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEdit ? 'Edit Outcome Record' : 'Add Outcome Record'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {formError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {formError}
            </div>
          )}

          {/* Year */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Year <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={form.year}
              onChange={(e) => onChange('year', e.target.value)}
              min={2000}
              max={2100}
              placeholder="e.g. 2025"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Cohort */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cohort (optional)
            </label>
            <select
              value={form.cohort_id}
              onChange={(e) => onChange('cohort_id', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Program-wide (no specific cohort)</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.program ? `${c.program.abbreviation} ` : ''}Group {c.cohort_number}
                </option>
              ))}
            </select>
          </div>

          {/* Rates grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Graduation Rate (%)
              </label>
              <input
                type="number"
                value={form.graduation_rate}
                onChange={(e) => onChange('graduation_rate', e.target.value)}
                min={0}
                max={100}
                step={0.1}
                placeholder="e.g. 92.5"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cert Pass Rate (%)
              </label>
              <input
                type="number"
                value={form.cert_pass_rate}
                onChange={(e) => onChange('cert_pass_rate', e.target.value)}
                min={0}
                max={100}
                step={0.1}
                placeholder="e.g. 88.0"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Job Placement Rate (%)
              </label>
              <input
                type="number"
                value={form.job_placement_rate}
                onChange={(e) => onChange('job_placement_rate', e.target.value)}
                min={0}
                max={100}
                step={0.1}
                placeholder="e.g. 95.0"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Employer Satisfaction (%)
              </label>
              <input
                type="number"
                value={form.employer_satisfaction}
                onChange={(e) => onChange('employer_satisfaction', e.target.value)}
                min={0}
                max={100}
                step={0.1}
                placeholder="e.g. 90.0"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Avg completion months */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Avg Completion (months)
            </label>
            <input
              type="number"
              value={form.avg_completion_months}
              onChange={(e) => onChange('avg_completion_months', e.target.value)}
              min={1}
              max={60}
              step={0.1}
              placeholder="e.g. 18.0"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => onChange('notes', e.target.value)}
              rows={3}
              placeholder="Any context or notes for this record..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t dark:border-gray-700">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Record'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Main page
// ─────────────────────────────────────────

export default function ProgramOutcomesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [outcomes, setOutcomes] = useState<ProgramOutcome[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterYear, setFilterYear] = useState('');
  const [filterCohort, setFilterCohort] = useState('');

  // Form / modal
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Role check - detect admin from session
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchData();
      checkAdmin();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const checkAdmin = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      const role = data?.user?.role || data?.role || '';
      setIsAdmin(['superadmin', 'admin'].includes(role));
    } catch {
      // Non-critical
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [outcomesRes, cohortsRes] = await Promise.all([
        fetch('/api/reports/program-outcomes'),
        fetch('/api/lab-management/cohorts?activeOnly=false'),
      ]);

      const [outcomesData, cohortsData] = await Promise.all([
        outcomesRes.json(),
        cohortsRes.json(),
      ]);

      if (!outcomesRes.ok) {
        setError(outcomesData.error || 'Failed to load outcomes');
      } else {
        setOutcomes(outcomesData.outcomes || []);
      }

      if (cohortsData.success) {
        setCohorts(cohortsData.cohorts || []);
      }
    } catch {
      setError('Failed to load data. Please try again.');
    }
    setLoading(false);
  }, []);

  // ── Filtering ──────────────────────────────────────

  const filteredOutcomes = outcomes.filter((o) => {
    if (filterYear && o.year.toString() !== filterYear) return false;
    if (filterCohort && o.cohort_id !== filterCohort) return false;
    return true;
  });

  // Latest year record for summary cards
  const latestYear = outcomes.length > 0 ? Math.max(...outcomes.map((o) => o.year)) : null;
  const latestOutcomes = latestYear ? outcomes.filter((o) => o.year === latestYear) : [];

  function avgMetric(
    rows: ProgramOutcome[],
    key: keyof Pick<
      ProgramOutcome,
      'graduation_rate' | 'cert_pass_rate' | 'job_placement_rate' | 'employer_satisfaction'
    >
  ): number | null {
    const vals = rows.map((r) => r[key]).filter((v): v is number => v !== null && v !== undefined);
    if (vals.length === 0) return null;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  }

  const latestGradRate = avgMetric(latestOutcomes, 'graduation_rate');
  const latestCertRate = avgMetric(latestOutcomes, 'cert_pass_rate');
  const latestJobRate = avgMetric(latestOutcomes, 'job_placement_rate');
  const latestEmployerSat = avgMetric(latestOutcomes, 'employer_satisfaction');

  // ── Available years for filter ──────────────────────

  const availableYears = Array.from(new Set(outcomes.map((o) => o.year))).sort((a, b) => b - a);

  // ── Form handlers ──────────────────────────────────

  const handleOpenAdd = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const handleOpenEdit = (outcome: ProgramOutcome) => {
    setForm({
      id: outcome.id,
      cohort_id: outcome.cohort_id || '',
      year: outcome.year.toString(),
      graduation_rate: outcome.graduation_rate !== null ? outcome.graduation_rate.toString() : '',
      cert_pass_rate: outcome.cert_pass_rate !== null ? outcome.cert_pass_rate.toString() : '',
      job_placement_rate:
        outcome.job_placement_rate !== null ? outcome.job_placement_rate.toString() : '',
      employer_satisfaction:
        outcome.employer_satisfaction !== null ? outcome.employer_satisfaction.toString() : '',
      avg_completion_months:
        outcome.avg_completion_months !== null ? outcome.avg_completion_months.toString() : '',
      notes: outcome.notes || '',
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleFormChange = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const year = parseInt(form.year, 10);
    if (!form.year || isNaN(year) || year < 2000 || year > 2100) {
      setFormError('Please enter a valid year (2000–2100).');
      return;
    }

    const parseOptional = (val: string): number | null => {
      if (val === '' || val === null || val === undefined) return null;
      const n = parseFloat(val);
      return isNaN(n) ? null : n;
    };

    setSaving(true);
    setFormError(null);

    try {
      const body = {
        id: form.id || undefined,
        cohort_id: form.cohort_id || null,
        year,
        graduation_rate: parseOptional(form.graduation_rate),
        cert_pass_rate: parseOptional(form.cert_pass_rate),
        job_placement_rate: parseOptional(form.job_placement_rate),
        employer_satisfaction: parseOptional(form.employer_satisfaction),
        avg_completion_months: parseOptional(form.avg_completion_months),
        notes: form.notes.trim() || null,
      };

      const res = await fetch('/api/reports/program-outcomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.success) {
        setFormError(data.error || 'Failed to save. Please try again.');
      } else {
        setShowForm(false);
        await fetchData();
      }
    } catch {
      setFormError('Failed to save. Please try again.');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this outcome record? This cannot be undone.')) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await fetch(`/api/reports/program-outcomes?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'Failed to delete record.');
      } else {
        await fetchData();
      }
    } catch {
      alert('Failed to delete record.');
    }
    setDeletingId(null);
  };

  // ── CSV export ──────────────────────────────────────

  const handleExportCSV = () => {
    const rows = filteredOutcomes;
    if (rows.length === 0) return;

    const meta = [
      'Program Outcomes Report',
      `Generated,${new Date().toLocaleString()}`,
      filterYear ? `Year Filter,${filterYear}` : '',
      '',
    ].filter((l) => l !== undefined);

    const headers = [
      'Year',
      'Cohort',
      'Graduation Rate (%)',
      'Cert Pass Rate (%)',
      'Job Placement Rate (%)',
      'Employer Satisfaction (%)',
      'Avg Completion (months)',
      'Notes',
    ];

    const dataRows = rows.map((o) => {
      const cohortLabel = o.cohort
        ? `${o.cohort.program ? o.cohort.program.abbreviation + ' ' : ''}Group ${o.cohort.cohort_number}`
        : 'Program-wide';
      return [
        o.year,
        cohortLabel,
        o.graduation_rate ?? '',
        o.cert_pass_rate ?? '',
        o.job_placement_rate ?? '',
        o.employer_satisfaction ?? '',
        o.avg_completion_months ?? '',
        o.notes ?? '',
      ];
    });

    const lines = [
      ...meta,
      headers.map((h) => `"${h}"`).join(','),
      ...dataRows.map((r) => r.map((v) => `"${v}"`).join(',')),
    ];

    const csv = lines.join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `program-outcomes-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render guards ──────────────────────────────────

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  // ── Summary card data ──────────────────────────────

  const summaryCards = [
    {
      label: 'Graduation Rate',
      value: latestGradRate,
      icon: GraduationCap,
      iconColor: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      label: 'Cert Pass Rate',
      value: latestCertRate,
      icon: Award,
      iconColor: 'text-green-600 dark:text-green-400',
      iconBg: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      label: 'Job Placement',
      value: latestJobRate,
      icon: Briefcase,
      iconColor: 'text-purple-600 dark:text-purple-400',
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
    },
    {
      label: 'Employer Satisfaction',
      value: latestEmployerSat,
      icon: Star,
      iconColor: 'text-orange-600 dark:text-orange-400',
      iconBg: 'bg-orange-100 dark:bg-orange-900/30',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2 overflow-x-auto whitespace-nowrap">
            <Link
              href="/"
              className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
            >
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
            <span className="hover:text-blue-600 dark:hover:text-blue-400">Reports</span>
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
            <span className="text-gray-900 dark:text-white">Program Outcomes</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex-shrink-0">
                <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  Program Outcomes
                </h1>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Accreditation metrics: graduation, certification, job placement, and satisfaction
                  trends
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {filteredOutcomes.length > 0 && (
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={handleOpenAdd}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Record
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}

        {!loading && (
          <>
            {/* Summary cards — latest year */}
            {latestYear && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  Latest Data ({latestYear})
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {summaryCards.map(({ label, value, icon: Icon, iconColor, iconBg }) => (
                    <div
                      key={label}
                      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`p-1.5 rounded-lg ${iconBg}`}>
                          <Icon className={`w-4 h-4 ${iconColor}`} />
                        </div>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {label}
                        </span>
                      </div>
                      <p className={`text-2xl font-bold ${rateColor(value)}`}>{fmtPct(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trend charts */}
            {outcomes.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Trends Over Time
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TrendChart
                    outcomes={outcomes}
                    metricKey="graduation_rate"
                    label="Graduation Rate"
                    color="bg-blue-500"
                  />
                  <TrendChart
                    outcomes={outcomes}
                    metricKey="cert_pass_rate"
                    label="Cert Pass Rate"
                    color="bg-green-500"
                  />
                  <TrendChart
                    outcomes={outcomes}
                    metricKey="job_placement_rate"
                    label="Job Placement Rate"
                    color="bg-purple-500"
                  />
                  <TrendChart
                    outcomes={outcomes}
                    metricKey="employer_satisfaction"
                    label="Employer Satisfaction"
                    color="bg-orange-500"
                  />
                </div>
              </div>
            )}

            {/* Filters + Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
              {/* Filters row */}
              <div className="flex flex-wrap items-center gap-3 p-4 border-b dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    Year:
                  </label>
                  <select
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  >
                    <option value="">All years</option>
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr.toString()}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    Cohort:
                  </label>
                  <select
                    value={filterCohort}
                    onChange={(e) => setFilterCohort(e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  >
                    <option value="">All cohorts</option>
                    {cohorts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.program ? `${c.program.abbreviation} ` : ''}Group {c.cohort_number}
                      </option>
                    ))}
                  </select>
                </div>

                <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
                  {filteredOutcomes.length} record{filteredOutcomes.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Table */}
              {filteredOutcomes.length === 0 ? (
                <div className="text-center py-16">
                  <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400 font-medium">
                    No outcome records found
                  </p>
                  <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                    {isAdmin
                      ? 'Click "Add Record" to enter program outcome data for accreditation reporting.'
                      : 'No data has been entered yet. Contact an admin to add records.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Year
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Cohort
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Graduation
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Cert Pass
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Job Placement
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Employer Sat.
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          <Clock className="w-3 h-3 inline mr-1" />
                          Completion
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                          Notes
                        </th>
                        {isAdmin && (
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                      {filteredOutcomes.map((outcome) => {
                        const cohortLabel = outcome.cohort
                          ? `${outcome.cohort.program ? outcome.cohort.program.abbreviation + ' ' : ''}Group ${outcome.cohort.cohort_number}`
                          : 'Program-wide';

                        return (
                          <tr
                            key={outcome.id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                          >
                            <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                              {outcome.year}
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                              {cohortLabel}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className={`font-bold text-sm ${rateColor(outcome.graduation_rate)}`}>
                                  {fmtPct(outcome.graduation_rate)}
                                </span>
                                {outcome.graduation_rate !== null && (
                                  <div className="w-16 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                                    <div
                                      className={`${barBg(outcome.graduation_rate)} h-1.5 rounded-full`}
                                      style={{ width: `${Math.min(outcome.graduation_rate, 100)}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className={`font-bold text-sm ${rateColor(outcome.cert_pass_rate)}`}>
                                  {fmtPct(outcome.cert_pass_rate)}
                                </span>
                                {outcome.cert_pass_rate !== null && (
                                  <div className="w-16 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                                    <div
                                      className={`${barBg(outcome.cert_pass_rate)} h-1.5 rounded-full`}
                                      style={{ width: `${Math.min(outcome.cert_pass_rate, 100)}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className={`font-bold text-sm ${rateColor(outcome.job_placement_rate)}`}>
                                  {fmtPct(outcome.job_placement_rate)}
                                </span>
                                {outcome.job_placement_rate !== null && (
                                  <div className="w-16 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                                    <div
                                      className={`${barBg(outcome.job_placement_rate)} h-1.5 rounded-full`}
                                      style={{ width: `${Math.min(outcome.job_placement_rate, 100)}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className={`font-bold text-sm ${rateColor(outcome.employer_satisfaction)}`}>
                                  {fmtPct(outcome.employer_satisfaction)}
                                </span>
                                {outcome.employer_satisfaction !== null && (
                                  <div className="w-16 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                                    <div
                                      className={`${barBg(outcome.employer_satisfaction)} h-1.5 rounded-full`}
                                      style={{
                                        width: `${Math.min(outcome.employer_satisfaction, 100)}%`,
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400 text-sm">
                              {fmtMonths(outcome.avg_completion_months)}
                            </td>
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs max-w-[200px] truncate hidden md:table-cell">
                              {outcome.notes || '—'}
                            </td>
                            {isAdmin && (
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleOpenEdit(outcome)}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                                    aria-label="Edit"
                                    title="Edit"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(outcome.id)}
                                    disabled={deletingId === outcome.id}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
                                    aria-label="Delete"
                                    title="Delete"
                                  >
                                    {deletingId === outcome.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Color legend */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                Rate Color Legend
              </p>
              <div className="flex flex-wrap gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-gray-600 dark:text-gray-400">90% or above (Excellent)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-gray-600 dark:text-gray-400">75–89% (Good)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span className="text-gray-600 dark:text-gray-400">60–74% (Needs Improvement)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-gray-600 dark:text-gray-400">Below 60% (Critical)</span>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Modal */}
      {showForm && (
        <OutcomeFormModal
          form={form}
          cohorts={cohorts}
          saving={saving}
          formError={formError}
          onChange={handleFormChange}
          onSave={handleSave}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
