'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  Download,
  AlertTriangle,
  Star,
  Building2,
  Users,
  Filter,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface QuestionAverage {
  question_number: number;
  question_text: string;
  category: string;
  avg_score: number | null;
  response_count: number;
  na_count: number;
}

interface PreceptorAverage {
  preceptor_name: string;
  agency: string;
  avg_score: number | null;
  survey_count: number;
  flagged: boolean;
}

interface SiteAverage {
  agency_name: string;
  avg_score: number | null;
  survey_count: number;
}

interface SurveyRecord {
  id: string;
  internship_id: string;
  survey_type: string;
  preceptor_name: string | null;
  agency_name: string | null;
  responses: Record<string, number | null>;
  submitted_by: string | null;
  submitted_at: string;
}

interface ReportSummary {
  total_surveys: number;
  by_type: { hospital_preceptor: number; field_preceptor: number };
  question_averages: QuestionAverage[];
  preceptor_averages: PreceptorAverage[];
  site_averages: SiteAverage[];
  low_rated: PreceptorAverage[];
}

interface ReportData {
  surveys: SurveyRecord[];
  summary: ReportSummary;
}

function scoreColor(score: number | null): string {
  if (score === null) return 'text-gray-400 dark:text-gray-500';
  if (score >= 4) return 'text-green-700 dark:text-green-400';
  if (score >= 3) return 'text-yellow-700 dark:text-yellow-400';
  return 'text-red-700 dark:text-red-400';
}

function scoreBadge(score: number | null): string {
  if (score === null) return 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400';
  if (score >= 4) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
  if (score >= 3) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
  return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
}

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-gray-400 dark:text-gray-500">N/A</span>;
  const pct = (score / 5) * 100;
  const barColor =
    score >= 4 ? 'bg-green-500' : score >= 3 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-sm font-semibold w-8 text-right ${scoreColor(score)}`}>
        {score.toFixed(1)}
      </span>
    </div>
  );
}

export default function CloseoutSurveyReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [agencyFilter, setAgencyFilter] = useState('');
  const [preceptorFilter, setPreceptorFilter] = useState('');

  // State
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sorting for preceptor table
  const [preceptorSort, setPreceptorSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({
    col: 'avg_score',
    dir: 'desc',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (typeFilter) params.set('type', typeFilter);
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    if (agencyFilter) params.set('agency', agencyFilter);
    if (preceptorFilter) params.set('preceptor', preceptorFilter);

    try {
      const res = await fetch(`/api/reports/closeout-surveys?${params}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error || 'Failed to load report');
      }
    } catch {
      setError('Failed to load report. Please try again.');
    }

    setLoading(false);
  };

  const handleExportCSV = () => {
    if (!data) return;

    const maxQ = 19;
    const qHeaders = Array.from({ length: maxQ }, (_, i) => `Q${i + 1}`);

    const metaLines = [
      'Closeout Survey Report',
      `Generated,${new Date().toLocaleString()}`,
      `Total Surveys,${data.summary.total_surveys}`,
      `Hospital Surveys,${data.summary.by_type.hospital_preceptor}`,
      `Field Surveys,${data.summary.by_type.field_preceptor}`,
      '',
      'Survey Detail',
    ];

    const headers = [
      'Survey ID',
      'Type',
      'Preceptor',
      'Agency',
      'Submitted Date',
      'Submitted By',
      ...qHeaders,
      'Overall Avg',
    ];

    const rows = data.surveys.map((s) => {
      const scores: (string | number)[] = [];
      let total = 0;
      let count = 0;
      for (let i = 1; i <= maxQ; i++) {
        const val = s.responses?.[`q${i}`];
        if (val !== null && val !== undefined) {
          scores.push(val);
          total += Number(val);
          count++;
        } else {
          scores.push('N/A');
        }
      }
      const avg = count > 0 ? (total / count).toFixed(1) : 'N/A';
      return [
        s.id,
        s.survey_type === 'hospital_preceptor' ? 'Hospital' : 'Field',
        s.preceptor_name || '',
        s.agency_name || '',
        s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : '',
        s.submitted_by || '',
        ...scores,
        avg,
      ];
    });

    const tableLines = [
      headers.map((h) => `"${h}"`).join(','),
      ...rows.map((r) => r.map((v) => `"${v}"`).join(',')),
    ];

    const csv = [...metaLines, ...tableLines].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `closeout-surveys-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Overall average score across all surveys
  const overallAvg = (() => {
    if (!data || data.summary.question_averages.length === 0) return null;
    const valid = data.summary.question_averages.filter((q) => q.avg_score !== null);
    if (valid.length === 0) return null;
    const total = valid.reduce((sum, q) => sum + (q.avg_score ?? 0), 0);
    return Math.round((total / valid.length) * 10) / 10;
  })();

  // Sorted preceptors
  const sortedPreceptors = [...(data?.summary.preceptor_averages ?? [])].sort((a, b) => {
    const dir = preceptorSort.dir === 'asc' ? 1 : -1;
    if (preceptorSort.col === 'preceptor_name') {
      return dir * a.preceptor_name.localeCompare(b.preceptor_name);
    }
    if (preceptorSort.col === 'agency') {
      return dir * a.agency.localeCompare(b.agency);
    }
    if (preceptorSort.col === 'survey_count') {
      return dir * (a.survey_count - b.survey_count);
    }
    // avg_score
    if (a.avg_score === null && b.avg_score === null) return 0;
    if (a.avg_score === null) return 1 * dir;
    if (b.avg_score === null) return -1 * dir;
    return dir * (a.avg_score - b.avg_score);
  });

  const toggleSort = (col: string) => {
    setPreceptorSort((prev) =>
      prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' }
    );
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (preceptorSort.col !== col) return <ChevronDown className="w-3 h-3 text-gray-400 inline ml-1" />;
    return preceptorSort.dir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-gray-500 dark:text-gray-400 inline ml-1" />
      : <ChevronDown className="w-3 h-3 text-gray-500 dark:text-gray-400 inline ml-1" />;
  };

  // Group questions by category for display
  const questionsByCategory: Record<string, QuestionAverage[]> = {};
  for (const q of data?.summary.question_averages ?? []) {
    if (!questionsByCategory[q.category]) questionsByCategory[q.category] = [];
    questionsByCategory[q.category].push(q);
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2 overflow-x-auto whitespace-nowrap">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
            <Link href="/lab-management/reports" className="hover:text-blue-600 dark:hover:text-blue-400">
              Reports
            </Link>
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
            <span className="text-gray-900 dark:text-white">Closeout Surveys</span>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                <ClipboardCheck className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Closeout Survey Results</h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Analyze preceptor and site ratings from student closeout surveys
                </p>
              </div>
            </div>
            {data && data.summary.total_surveys > 0 && (
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Filter Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="p-4 border-b dark:border-gray-700 flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Filters</h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Survey Type
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
                >
                  <option value="">All Types</option>
                  <option value="hospital_preceptor">Hospital</option>
                  <option value="field_preceptor">Field</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Agency
                </label>
                <input
                  type="text"
                  value={agencyFilter}
                  onChange={(e) => setAgencyFilter(e.target.value)}
                  placeholder="e.g. AMR"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Preceptor
                </label>
                <input
                  type="text"
                  value={preceptorFilter}
                  onChange={(e) => setPreceptorFilter(e.target.value)}
                  placeholder="Search name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
                />
              </div>
            </div>

            {error && (
              <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={fetchReport}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Filter className="w-4 h-4" />
                    Apply Filters
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600 dark:text-blue-400" />
          </div>
        )}

        {!loading && data && (
          <>
            {/* Empty State */}
            {data.summary.total_surveys === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
                <ClipboardCheck className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Surveys Found</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  No closeout surveys have been submitted yet, or no surveys match your current filters.
                </p>
              </div>
            ) : (
              <>
                {/* Low-Rated Alert Banner */}
                {data.summary.low_rated.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-red-800 dark:text-red-300 mb-1">
                          {data.summary.low_rated.length} Low-Rated Preceptor{data.summary.low_rated.length !== 1 ? 's' : ''} Flagged
                        </h3>
                        <p className="text-sm text-red-700 dark:text-red-400 mb-3">
                          These preceptors have an average score below 3.0 and may need additional training or review.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {data.summary.low_rated.map((p) => (
                            <div
                              key={p.preceptor_name}
                              className="flex items-center gap-2 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 rounded-lg text-sm"
                            >
                              <span className="font-medium text-red-800 dark:text-red-300">
                                {p.preceptor_name}
                              </span>
                              <span className="text-red-600 dark:text-red-400 text-xs">
                                ({p.agency})
                              </span>
                              <span className="px-1.5 py-0.5 bg-red-200 dark:bg-red-800 text-red-700 dark:text-red-300 rounded text-xs font-bold">
                                {p.avg_score?.toFixed(1) ?? 'N/A'}
                              </span>
                              <span className="text-red-500 dark:text-red-400 text-xs">
                                {p.survey_count} survey{p.survey_count !== 1 ? 's' : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 mb-2">
                      <ClipboardCheck className="w-4 h-4" />
                      <span className="text-sm font-medium">Total Surveys</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {data.summary.total_surveys}
                    </p>
                    <div className="flex gap-2 mt-1">
                      {data.summary.by_type.hospital_preceptor > 0 && (
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          {data.summary.by_type.hospital_preceptor} hospital
                        </span>
                      )}
                      {data.summary.by_type.field_preceptor > 0 && (
                        <span className="text-xs text-purple-600 dark:text-purple-400">
                          {data.summary.by_type.field_preceptor} field
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
                      <Star className="w-4 h-4" />
                      <span className="text-sm font-medium">Avg Overall Rating</span>
                    </div>
                    <p className={`text-3xl font-bold ${scoreColor(overallAvg)}`}>
                      {overallAvg !== null ? overallAvg.toFixed(1) : '—'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">out of 5.0</p>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm font-medium">Low-Rated Preceptors</span>
                    </div>
                    <p className={`text-3xl font-bold ${data.summary.low_rated.length > 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                      {data.summary.low_rated.length}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">avg score &lt; 3.0</p>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-2">
                      <Building2 className="w-4 h-4" />
                      <span className="text-sm font-medium">Sites Evaluated</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {data.summary.site_averages.length}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">unique agencies</p>
                  </div>
                </div>

                {/* Question Averages Table */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                  <div className="p-4 border-b dark:border-gray-700">
                    <h2 className="font-semibold text-gray-900 dark:text-white">
                      Question Averages
                      <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                        (1 = Poor, 5 = Excellent)
                      </span>
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400 w-8">#</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Question</th>
                          <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Avg Score</th>
                          <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Responses</th>
                          <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">N/A</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400 min-w-[140px]">Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-gray-700">
                        {Object.entries(questionsByCategory).flatMap(([category, questions]) => [
                          <tr key={`cat-${category}`} className="bg-gray-100 dark:bg-gray-700/70">
                            <td colSpan={6} className="px-4 py-2">
                              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                {category}
                              </span>
                            </td>
                          </tr>,
                          ...questions.map((q, idx) => (
                            <tr
                              key={q.question_number}
                              className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 ${idx % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-700/20'}`}
                            >
                              <td className="px-4 py-3 text-gray-400 dark:text-gray-500 font-mono text-xs">
                                {q.question_number}
                              </td>
                              <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                                {q.question_text}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${scoreBadge(q.avg_score)}`}>
                                  {q.avg_score !== null ? q.avg_score.toFixed(1) : 'N/A'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                                {q.response_count}
                              </td>
                              <td className="px-4 py-3 text-center text-gray-400 dark:text-gray-500">
                                {q.na_count}
                              </td>
                              <td className="px-4 py-3">
                                <ScoreBar score={q.avg_score} />
                              </td>
                            </tr>
                          )),
                        ])}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Preceptor Rankings Table */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                  <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
                    <h2 className="font-semibold text-gray-900 dark:text-white">
                      Preceptor Rankings
                      <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                        ({data.summary.preceptor_averages.length} preceptor{data.summary.preceptor_averages.length !== 1 ? 's' : ''})
                      </span>
                    </h2>
                    {data.summary.low_rated.length > 0 && (
                      <div className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400 font-medium">
                        <AlertTriangle className="w-4 h-4" />
                        {data.summary.low_rated.length} flagged
                      </div>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                          <th
                            className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-white select-none"
                            onClick={() => toggleSort('preceptor_name')}
                          >
                            Preceptor <SortIcon col="preceptor_name" />
                          </th>
                          <th
                            className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-white select-none"
                            onClick={() => toggleSort('agency')}
                          >
                            Agency <SortIcon col="agency" />
                          </th>
                          <th
                            className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-white select-none whitespace-nowrap"
                            onClick={() => toggleSort('avg_score')}
                          >
                            Avg Score <SortIcon col="avg_score" />
                          </th>
                          <th
                            className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-white select-none whitespace-nowrap"
                            onClick={() => toggleSort('survey_count')}
                          >
                            Surveys <SortIcon col="survey_count" />
                          </th>
                          <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400 min-w-[140px]">
                            Score
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-gray-700">
                        {sortedPreceptors.map((p, idx) => (
                          <tr
                            key={p.preceptor_name}
                            className={`transition-colors ${
                              p.flagged
                                ? 'bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20'
                                : idx % 2 === 0
                                ? 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                : 'bg-gray-50/50 dark:bg-gray-700/20 hover:bg-gray-100/50 dark:hover:bg-gray-700/50'
                            }`}
                          >
                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                              {p.preceptor_name}
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                              {p.agency}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${scoreBadge(p.avg_score)}`}>
                                {p.avg_score !== null ? p.avg_score.toFixed(1) : 'N/A'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                              {p.survey_count}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {p.flagged ? (
                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                                  Flagged
                                </span>
                              ) : p.avg_score !== null && p.avg_score >= 4 ? (
                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                  Good
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                                  Satisfactory
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <ScoreBar score={p.avg_score} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Site Rankings Table */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                  <div className="p-4 border-b dark:border-gray-700">
                    <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      Site Rankings
                      <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">
                        ({data.summary.site_averages.length} site{data.summary.site_averages.length !== 1 ? 's' : ''})
                      </span>
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Agency / Site</th>
                          <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Avg Score</th>
                          <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Survey Count</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400 min-w-[140px]">Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-gray-700">
                        {data.summary.site_averages.map((site, idx) => (
                          <tr
                            key={site.agency_name}
                            className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                              idx % 2 !== 0 ? 'bg-gray-50/50 dark:bg-gray-700/20' : ''
                            }`}
                          >
                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                              {site.agency_name}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${scoreBadge(site.avg_score)}`}>
                                {site.avg_score !== null ? site.avg_score.toFixed(1) : 'N/A'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                              {site.survey_count}
                            </td>
                            <td className="px-4 py-3">
                              <ScoreBar score={site.avg_score} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Legend */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Score Legend</h3>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm">
                    {[
                      { label: 'Excellent', range: '4.0 - 5.0', cls: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
                      { label: 'Satisfactory', range: '3.0 - 3.9', cls: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' },
                      { label: 'Needs Improvement', range: 'Below 3.0', cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
                    ].map(({ label, range, cls }) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{range}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* Initial empty state (before first load) */}
        {!loading && !data && !error && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
            <ClipboardCheck className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Loading Survey Data</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Use the filters above and click &quot;Apply Filters&quot; to view results.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
