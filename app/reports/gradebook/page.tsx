'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  BookOpen,
  Download,
  RefreshCw,
  Loader2,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Users,
  CheckCircle2,
  XCircle,
  Filter,
  Printer,
} from 'lucide-react';

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

interface Cohort {
  id: string;
  cohort_number: number;
  program: { abbreviation: string };
}

interface StudentGrade {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  // raw values
  scenarioAvgRaw: number | null;
  scenarioCount: number;
  skillCount: number;
  clinicalHours: number;
  attendancePresent: number;
  attendanceTotal: number;
  peerAvgRaw: number | null;
  // percentages
  scenarioPct: number | null;
  skillPct: number;
  clinicalPct: number;
  attendancePct: number | null;
  peerPct: number | null;
  // composite
  overallPct: number;
  grade: string;
  belowPassing: boolean;
}

interface GradeWeights {
  scenarios: number;
  skills: number;
  clinical: number;
  attendance: number;
  peerEvals: number;
}

interface GradebookSummary {
  totalStudents: number;
  totalLabDays: number;
  passing: number;
  failing: number;
  avgOverall: number;
}

interface GradebookData {
  cohort: { id: string; name: string; programAbbreviation: string; cohortNumber: number };
  weights: GradeWeights;
  summary: GradebookSummary;
  students: StudentGrade[];
}

type SortField =
  | 'name'
  | 'scenarios'
  | 'skills'
  | 'clinical'
  | 'attendance'
  | 'peerEvals'
  | 'overall'
  | 'grade';
type SortDir = 'asc' | 'desc';
type FilterMode = 'all' | 'passing' | 'failing';

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

function gradeColor(grade: string): string {
  if (grade === 'A') return 'text-green-700 dark:text-green-400';
  if (grade === 'B') return 'text-blue-700 dark:text-blue-400';
  if (grade === 'C') return 'text-amber-600 dark:text-amber-400';
  if (grade === 'D') return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

function gradeBg(grade: string): string {
  if (grade === 'A') return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
  if (grade === 'B') return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
  if (grade === 'C') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300';
  if (grade === 'D') return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300';
  return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
}

function pctColor(pct: number | null): string {
  if (pct === null) return 'text-gray-400 dark:text-gray-500';
  if (pct >= 90) return 'text-green-700 dark:text-green-400';
  if (pct >= 80) return 'text-blue-700 dark:text-blue-400';
  if (pct >= 70) return 'text-amber-600 dark:text-amber-400';
  if (pct >= 60) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

function pctCellBg(pct: number | null): string {
  if (pct === null) return '';
  if (pct < 70) return 'bg-red-50 dark:bg-red-900/10';
  return '';
}

function formatPct(pct: number | null): string {
  return pct !== null ? `${pct}%` : '—';
}

// ─────────────────────────────────────────────────
// SortButton
// ─────────────────────────────────────────────────

function SortButton({
  field,
  sortField,
  sortDir,
  onSort,
  children,
}: {
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-xs whitespace-nowrap"
    >
      {children}
      {sortField === field ? (
        sortDir === 'asc' ? (
          <ChevronUp className="w-3 h-3 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-3 h-3 flex-shrink-0" />
        )
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-40 flex-shrink-0" />
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────────

export default function GradebookPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohort, setSelectedCohort] = useState('');
  const [gradebook, setGradebook] = useState<GradebookData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sort and filter state
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [highlightFailing, setHighlightFailing] = useState(true);

  // Redirect if unauthenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // Load cohorts on mount
  useEffect(() => {
    if (!session) return;
    fetch('/api/lab-management/cohorts?activeOnly=false&include_archived=false')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setCohorts(data.cohorts || []);
        }
      })
      .catch(() => {});
  }, [session]);

  const fetchGradebook = async (cohortId: string) => {
    if (!cohortId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/gradebook?cohortId=${encodeURIComponent(cohortId)}`);
      const data = await res.json();
      if (data.success) {
        setGradebook(data);
      } else {
        setError(data.error || 'Failed to load gradebook');
        setGradebook(null);
      }
    } catch {
      setError('Failed to load gradebook. Please try again.');
      setGradebook(null);
    }
    setLoading(false);
  };

  const handleCohortChange = (cohortId: string) => {
    setSelectedCohort(cohortId);
    if (cohortId) fetchGradebook(cohortId);
    else setGradebook(null);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'name' ? 'asc' : 'desc');
    }
  };

  // Sorted + filtered rows
  const displayRows = useMemo(() => {
    if (!gradebook) return [];
    let rows = [...gradebook.students];

    // Filter
    if (filterMode === 'passing') rows = rows.filter((r) => !r.belowPassing);
    if (filterMode === 'failing') rows = rows.filter((r) => r.belowPassing);

    // Sort
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`);
          break;
        case 'scenarios':
          cmp = (a.scenarioPct ?? -1) - (b.scenarioPct ?? -1);
          break;
        case 'skills':
          cmp = a.skillPct - b.skillPct;
          break;
        case 'clinical':
          cmp = a.clinicalPct - b.clinicalPct;
          break;
        case 'attendance':
          cmp = (a.attendancePct ?? -1) - (b.attendancePct ?? -1);
          break;
        case 'peerEvals':
          cmp = (a.peerPct ?? -1) - (b.peerPct ?? -1);
          break;
        case 'overall':
          cmp = a.overallPct - b.overallPct;
          break;
        case 'grade':
          cmp = a.grade.localeCompare(b.grade);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return rows;
  }, [gradebook, sortField, sortDir, filterMode]);

  const handleExportCSV = () => {
    if (!gradebook) return;

    const cohortName = gradebook.cohort.name;
    const w = gradebook.weights;

    const metaLines = [
      `"Grade Book Report"`,
      `"Cohort","${cohortName}"`,
      `"Generated","${new Date().toLocaleString()}"`,
      `"Weights","Scenarios ${w.scenarios}% | Skills ${w.skills}% | Clinical ${w.clinical}% | Attendance ${w.attendance}% | Peer Evals ${w.peerEvals}%"`,
      `"Students","${gradebook.summary.totalStudents} total | ${gradebook.summary.passing} passing | ${gradebook.summary.failing} failing | Avg ${gradebook.summary.avgOverall}%"`,
      '',
    ];

    const headers = [
      'Last Name',
      'First Name',
      `Scenarios (${w.scenarios}%)`,
      'Scenario Count',
      'Scenario Raw Avg',
      `Skills (${w.skills}%)`,
      'Skill Signoffs',
      `Clinical (${w.clinical}%)`,
      'Clinical Hours',
      `Attendance (${w.attendance}%)`,
      'Days Present',
      'Total Lab Days',
      `Peer Evals (${w.peerEvals}%)`,
      'Peer Eval Count',
      'Overall %',
      'Letter Grade',
    ];

    const rows = displayRows.map((s) => [
      s.last_name,
      s.first_name,
      s.scenarioPct !== null ? s.scenarioPct : '',
      s.scenarioCount,
      s.scenarioAvgRaw !== null ? s.scenarioAvgRaw.toFixed(2) : '',
      s.skillPct,
      s.skillCount,
      s.clinicalPct,
      s.clinicalHours,
      s.attendancePct !== null ? s.attendancePct : '',
      s.attendancePresent,
      s.attendanceTotal,
      s.peerPct !== null ? s.peerPct : '',
      s.peerAvgRaw !== null ? s.peerAvgRaw.toFixed(2) : '',
      s.overallPct,
      s.grade,
    ]);

    const csv = [
      ...metaLines,
      headers.map((h) => `"${h}"`).join(','),
      ...rows.map((r) => r.map((v) => `"${v}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gradebook-${cohortName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  const weights = gradebook?.weights || DEFAULT_WEIGHTS_DISPLAY;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 print:bg-white print:min-h-0">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm print:shadow-none">
        <div className="max-w-full mx-auto px-4 py-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2 overflow-x-auto whitespace-nowrap print:hidden">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
            <span className="text-gray-900 dark:text-white">Reports</span>
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
            <span className="text-gray-900 dark:text-white">Grade Book</span>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <BookOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Student Grade Book
                  {gradebook && (
                    <span className="ml-2 text-base font-normal text-gray-500 dark:text-gray-400">
                      — {gradebook.cohort.name}
                    </span>
                  )}
                </h1>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Aggregated scores across scenarios, skills, clinical hours, attendance, and peer evaluations
                </p>
              </div>
            </div>

            {/* Action buttons */}
            {gradebook && (
              <div className="flex items-center gap-2 print:hidden">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-sm"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-full mx-auto px-4 py-6 space-y-4">
        {/* Controls Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 print:hidden">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Cohort selector */}
            <div className="flex-1 min-w-[200px] max-w-xs">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cohort <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedCohort}
                onChange={(e) => handleCohortChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">Select cohort...</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {(c.program as any)?.abbreviation || 'Unknown'} Group {c.cohort_number}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter */}
            <div className="flex-1 min-w-[160px] max-w-xs">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Filter Students
              </label>
              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value as FilterMode)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="all">All Students</option>
                <option value="passing">Passing Only (70%+)</option>
                <option value="failing">Failing Only (&lt;70%)</option>
              </select>
            </div>

            {/* Highlight toggle */}
            <div className="flex items-center gap-2 pb-0.5">
              <input
                type="checkbox"
                id="highlightFailing"
                checked={highlightFailing}
                onChange={(e) => setHighlightFailing(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600"
              />
              <label
                htmlFor="highlightFailing"
                className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none"
              >
                Highlight failing cells
              </label>
            </div>

            {/* Refresh */}
            {selectedCohort && (
              <button
                onClick={() => fetchGradebook(selectedCohort)}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Refresh
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !gradebook && !error && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-16 text-center">
            <BookOpen className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Select a Cohort</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Choose a cohort above to load the grade book.
            </p>
          </div>
        )}

        {/* Gradebook content */}
        {!loading && gradebook && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 print:gap-2">
              <SummaryCard
                label="Students"
                value={gradebook.summary.totalStudents}
                icon={<Users className="w-4 h-4" />}
                color="blue"
              />
              <SummaryCard
                label="Cohort Avg"
                value={`${gradebook.summary.avgOverall}%`}
                icon={<BookOpen className="w-4 h-4" />}
                color={gradebook.summary.avgOverall >= 70 ? 'green' : 'red'}
              />
              <SummaryCard
                label="Passing"
                value={gradebook.summary.passing}
                icon={<CheckCircle2 className="w-4 h-4" />}
                color="green"
              />
              <SummaryCard
                label="Failing"
                value={gradebook.summary.failing}
                icon={<XCircle className="w-4 h-4" />}
                color={gradebook.summary.failing > 0 ? 'red' : 'gray'}
              />
              <SummaryCard
                label="Lab Days"
                value={gradebook.summary.totalLabDays}
                icon={<Filter className="w-4 h-4" />}
                color="gray"
              />
            </div>

            {/* Weight legend */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm px-4 py-3 print:shadow-none">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium text-gray-700 dark:text-gray-300 mr-1">Grade Weights:</span>
                <span>Scenarios {weights.scenarios}%</span>
                <span>Skills {weights.skills}%</span>
                <span>Clinical {weights.clinical}%</span>
                <span>Attendance {weights.attendance}%</span>
                <span>Peer Evals {weights.peerEvals}%</span>
                <span className="ml-auto text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Categories with no cohort data are excluded from the weighted average.
                </span>
              </div>
            </div>

            {/* Grade table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden print:shadow-none print:rounded-none">
              <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between print:hidden">
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  Grade Book
                  <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                    ({displayRows.length} of {gradebook.students.length} student
                    {gradebook.students.length !== 1 ? 's' : ''})
                  </span>
                </h2>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-full bg-green-500"></span>A (90-100%)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-full bg-blue-500"></span>B (80-89%)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-full bg-amber-500"></span>C (70-79%)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-full bg-orange-500"></span>D (60-69%)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-full bg-red-500"></span>F (&lt;60%)
                  </span>
                </div>
              </div>

              {displayRows.length === 0 ? (
                <div className="py-16 text-center">
                  <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No students match the selected filter.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left sticky left-0 bg-gray-50 dark:bg-gray-700/50 z-10">
                          <SortButton field="name" sortField={sortField} sortDir={sortDir} onSort={handleSort}>
                            Student
                          </SortButton>
                        </th>
                        <th className="px-3 py-3 text-center">
                          <SortButton field="scenarios" sortField={sortField} sortDir={sortDir} onSort={handleSort}>
                            Scenarios
                          </SortButton>
                          <div className="text-xs font-normal text-gray-400 dark:text-gray-500">
                            {weights.scenarios}%
                          </div>
                        </th>
                        <th className="px-3 py-3 text-center">
                          <SortButton field="skills" sortField={sortField} sortDir={sortDir} onSort={handleSort}>
                            Skills
                          </SortButton>
                          <div className="text-xs font-normal text-gray-400 dark:text-gray-500">
                            {weights.skills}%
                          </div>
                        </th>
                        <th className="px-3 py-3 text-center">
                          <SortButton field="clinical" sortField={sortField} sortDir={sortDir} onSort={handleSort}>
                            Clinical
                          </SortButton>
                          <div className="text-xs font-normal text-gray-400 dark:text-gray-500">
                            {weights.clinical}%
                          </div>
                        </th>
                        <th className="px-3 py-3 text-center">
                          <SortButton field="attendance" sortField={sortField} sortDir={sortDir} onSort={handleSort}>
                            Attendance
                          </SortButton>
                          <div className="text-xs font-normal text-gray-400 dark:text-gray-500">
                            {weights.attendance}%
                          </div>
                        </th>
                        <th className="px-3 py-3 text-center">
                          <SortButton field="peerEvals" sortField={sortField} sortDir={sortDir} onSort={handleSort}>
                            Peer Evals
                          </SortButton>
                          <div className="text-xs font-normal text-gray-400 dark:text-gray-500">
                            {weights.peerEvals}%
                          </div>
                        </th>
                        <th className="px-3 py-3 text-center bg-gray-100 dark:bg-gray-700">
                          <SortButton field="overall" sortField={sortField} sortDir={sortDir} onSort={handleSort}>
                            Overall
                          </SortButton>
                        </th>
                        <th className="px-3 py-3 text-center bg-gray-100 dark:bg-gray-700">
                          <SortButton field="grade" sortField={sortField} sortDir={sortDir} onSort={handleSort}>
                            Grade
                          </SortButton>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {displayRows.map((student) => {
                        const rowHighlight =
                          highlightFailing && student.belowPassing
                            ? 'bg-red-50/50 dark:bg-red-900/5'
                            : '';

                        return (
                          <tr
                            key={student.id}
                            className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${rowHighlight}`}
                          >
                            {/* Student name */}
                            <td className="px-4 py-3 sticky left-0 bg-white dark:bg-gray-800 z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                              <div className="font-medium text-gray-900 dark:text-white whitespace-nowrap">
                                {student.last_name}, {student.first_name}
                              </div>
                              {student.email && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[180px]">
                                  {student.email}
                                </div>
                              )}
                            </td>

                            {/* Scenarios */}
                            <td className={`px-3 py-3 text-center ${highlightFailing ? pctCellBg(student.scenarioPct) : ''}`}>
                              <div className={`font-semibold ${pctColor(student.scenarioPct)}`}>
                                {formatPct(student.scenarioPct)}
                              </div>
                              {student.scenarioAvgRaw !== null && (
                                <div className="text-xs text-gray-400 dark:text-gray-500">
                                  avg {student.scenarioAvgRaw.toFixed(1)}/5
                                </div>
                              )}
                              <div className="text-xs text-gray-400 dark:text-gray-500">
                                {student.scenarioCount} run{student.scenarioCount !== 1 ? 's' : ''}
                              </div>
                            </td>

                            {/* Skills */}
                            <td className={`px-3 py-3 text-center ${highlightFailing ? pctCellBg(student.skillPct) : ''}`}>
                              <div className={`font-semibold ${pctColor(student.skillPct)}`}>
                                {student.skillPct}%
                              </div>
                              <div className="text-xs text-gray-400 dark:text-gray-500">
                                {student.skillCount} signoff{student.skillCount !== 1 ? 's' : ''}
                              </div>
                            </td>

                            {/* Clinical */}
                            <td className={`px-3 py-3 text-center ${highlightFailing ? pctCellBg(student.clinicalPct) : ''}`}>
                              <div className={`font-semibold ${pctColor(student.clinicalPct)}`}>
                                {student.clinicalPct}%
                              </div>
                              <div className="text-xs text-gray-400 dark:text-gray-500">
                                {student.clinicalHours}h
                              </div>
                            </td>

                            {/* Attendance */}
                            <td className={`px-3 py-3 text-center ${highlightFailing && attendancePctBelow(student) ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                              <div className={`font-semibold ${pctColor(student.attendancePct)}`}>
                                {formatPct(student.attendancePct)}
                              </div>
                              {student.attendanceTotal > 0 && (
                                <div className="text-xs text-gray-400 dark:text-gray-500">
                                  {student.attendancePresent}/{student.attendanceTotal} days
                                </div>
                              )}
                            </td>

                            {/* Peer Evals */}
                            <td className={`px-3 py-3 text-center ${highlightFailing ? pctCellBg(student.peerPct) : ''}`}>
                              <div className={`font-semibold ${pctColor(student.peerPct)}`}>
                                {formatPct(student.peerPct)}
                              </div>
                              {student.peerAvgRaw !== null && (
                                <div className="text-xs text-gray-400 dark:text-gray-500">
                                  avg {student.peerAvgRaw.toFixed(1)}/5
                                </div>
                              )}
                            </td>

                            {/* Overall */}
                            <td className="px-3 py-3 text-center bg-gray-50 dark:bg-gray-800/50">
                              <div className={`text-lg font-bold ${gradeColor(student.grade)}`}>
                                {student.overallPct}%
                              </div>
                            </td>

                            {/* Letter Grade */}
                            <td className="px-3 py-3 text-center bg-gray-50 dark:bg-gray-800/50">
                              <span
                                className={`inline-block px-2 py-1 rounded-md text-sm font-bold ${gradeBg(student.grade)}`}
                              >
                                {student.grade}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Print header (only visible when printing) */}
            <div className="hidden print:block text-xs text-gray-500 mt-2">
              Printed {new Date().toLocaleDateString()} | {gradebook.cohort.name} | PMI EMS Scheduler
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Summary Card helper component
// ─────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'red' | 'gray' | 'amber';
}) {
  const colorMap = {
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    red: 'text-red-600 dark:text-red-400',
    gray: 'text-gray-600 dark:text-gray-400',
    amber: 'text-amber-600 dark:text-amber-400',
  };
  const bgMap = {
    blue: 'bg-blue-100 dark:bg-blue-900/30',
    green: 'bg-green-100 dark:bg-green-900/30',
    red: 'bg-red-100 dark:bg-red-900/30',
    gray: 'bg-gray-100 dark:bg-gray-700/50',
    amber: 'bg-amber-100 dark:bg-amber-900/30',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 print:shadow-none print:border print:border-gray-200">
      <div className={`flex items-center gap-2 mb-2 ${colorMap[color]}`}>
        <span className={`p-1 rounded ${bgMap[color]}`}>{icon}</span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${colorMap[color]}`}>{value}</p>
    </div>
  );
}

// helper used inline in JSX
function attendancePctBelow(student: StudentGrade): boolean {
  return student.attendancePct !== null && student.attendancePct < 70;
}

// Fallback weights for display before data loads
const DEFAULT_WEIGHTS_DISPLAY: GradeWeights = {
  scenarios: 30,
  skills: 25,
  clinical: 20,
  attendance: 15,
  peerEvals: 10,
};
