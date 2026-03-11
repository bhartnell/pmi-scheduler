'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  Upload,
  Plus,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Award,
  BookOpen,
  Calendar,
  Search,
} from 'lucide-react';
import { canEditLVFR, isAgencyRole } from '@/lib/permissions';
import Breadcrumbs from '@/components/Breadcrumbs';
import { PageLoader } from '@/components/ui';

// ── Types ──────────────────────────────────────────────────────────────

interface Assessment {
  title: string;
  category: string;
  day_number: number | null;
  date: string | null;
  pass_score: number;
  question_count: number | null;
}

interface Grade {
  id: string;
  student_id: string;
  assessment_id: string;
  date_taken: string | null;
  score_percent: number;
  passed: boolean;
  questions_correct: number | null;
  questions_total: number | null;
  source: string;
  assessment: Assessment | null;
  student?: {
    first_name: string;
    last_name: string;
  } | null;
}

interface StudentSummary {
  student_id: string;
  student_name: string;
  overall_average: number;
  quiz_average: number;
  exam_average: number;
  total_graded: number;
  passed_count: number;
  failed_count: number;
  at_risk: boolean;
  missing_assessments: string[];
}

interface CohortSummary {
  class_average: number;
  total_students: number;
  at_risk_count: number;
  graded_students: number;
  assessment_averages: {
    assessment_id: string;
    title: string;
    category: string;
    class_average: number;
    pass_rate: number;
    graded_count: number;
  }[];
}

interface CurrentUser {
  role: string;
  agency_affiliation?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  daily_quiz: 'Daily Quizzes',
  module_exam: 'Module Exams',
  final_exam: 'Final Exam',
  pharm_checkpoint: 'Pharm Checkpoints',
};

const CATEGORY_ICONS: Record<string, typeof BookOpen> = {
  daily_quiz: BookOpen,
  module_exam: Award,
  final_exam: Award,
  pharm_checkpoint: TrendingUp,
};

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 70) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-green-100 dark:bg-green-900/30';
  if (score >= 70) return 'bg-yellow-100 dark:bg-yellow-900/30';
  return 'bg-red-100 dark:bg-red-900/30';
}

// ── Main Component ─────────────────────────────────────────────────────

export default function LVFRGradesPage() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [summaries, setSummaries] = useState<StudentSummary[]>([]);
  const [cohortSummary, setCohortSummary] = useState<CohortSummary | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'by-student' | 'by-assessment'>('overview');
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Fetch user
  useEffect(() => {
    fetch('/api/instructor/me')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.user) {
          setCurrentUser({ role: data.user.role, agency_affiliation: data.user.agency_affiliation });
        }
      })
      .catch(() => {});
  }, []);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    try {
      const [gradesRes, summaryRes] = await Promise.all([
        fetch('/api/lvfr-aemt/grades'),
        fetch('/api/lvfr-aemt/grades/summary'),
      ]);
      const gradesData = await gradesRes.json();
      const summaryData = await summaryRes.json();

      setGrades(gradesData.grades || []);
      setSummaries(summaryData.students || []);
      setCohortSummary(summaryData.cohort_summary || null);
    } catch (err) {
      console.error('Error fetching grades:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) fetchData();
  }, [currentUser, fetchData]);

  if (loading || !currentUser) return <PageLoader />;

  const isStudent = currentUser.role === 'student';
  const isInstructor = canEditLVFR(currentUser.role);
  const isObserver = currentUser.role === 'agency_observer';
  const isLiaison = currentUser.role === 'agency_liaison';

  // Group grades by category for student view
  const gradesByCategory = grades.reduce((acc, g) => {
    const cat = g.assessment?.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(g);
    return acc;
  }, {} as Record<string, Grade[]>);

  const ownSummary = summaries.length === 1 && isStudent ? summaries[0] : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <Breadcrumbs />
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link href="/lvfr-aemt" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-6 h-6 text-purple-600" />
                  {isStudent ? 'My Grades' : 'Gradebook'}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                  {isStudent ? 'Your quiz and exam scores' : 'LVFR AEMT course grades and assessments'}
                </p>
              </div>
            </div>
            {isInstructor && (
              <div className="flex items-center gap-2">
                <Link
                  href="/lvfr-aemt/grades/import"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  <Upload className="w-4 h-4" />
                  Import CSV
                </Link>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Grade
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ── STUDENT VIEW ── */}
        {isStudent && (
          <>
            {/* Summary Card */}
            {ownSummary && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                {ownSummary.at_risk && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
                    <AlertTriangle className="w-4 h-4" />
                    Your overall average is below 80%. Please speak with your instructor about a study plan.
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Overall</p>
                    <p className={`text-3xl font-bold ${scoreColor(ownSummary.overall_average)}`}>
                      {ownSummary.overall_average > 0 ? `${ownSummary.overall_average}%` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Quizzes</p>
                    <p className={`text-3xl font-bold ${scoreColor(ownSummary.quiz_average)}`}>
                      {ownSummary.quiz_average > 0 ? `${ownSummary.quiz_average}%` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Exams</p>
                    <p className={`text-3xl font-bold ${scoreColor(ownSummary.exam_average)}`}>
                      {ownSummary.exam_average > 0 ? `${ownSummary.exam_average}%` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Graded</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {ownSummary.total_graded}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Grades by Category */}
            {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
              const catGrades = gradesByCategory[cat] || [];
              const CatIcon = CATEGORY_ICONS[cat] || BookOpen;
              return (
                <div key={cat} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
                    <CatIcon className="w-4 h-4 text-purple-600" />
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{label}</h2>
                    <span className="text-xs text-gray-500">({catGrades.length})</span>
                  </div>
                  {catGrades.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500 dark:text-gray-400">No grades yet</div>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {catGrades.map(g => (
                        <div key={g.id} className="px-4 py-3 flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {g.assessment?.title || g.assessment_id}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {g.date_taken ? new Date(g.date_taken).toLocaleDateString() : '—'}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-lg font-bold ${scoreColor(g.score_percent)}`}>
                              {g.score_percent}%
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              g.passed
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                            }`}>
                              {g.passed ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                              {g.passed ? 'Pass' : 'Fail'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* ── OBSERVER VIEW ── */}
        {isObserver && cohortSummary && (
          <CohortAggregateView cohortSummary={cohortSummary} />
        )}

        {/* ── INSTRUCTOR / LIAISON VIEW ── */}
        {(isInstructor || isLiaison) && (
          <>
            {/* Stats Bar */}
            {cohortSummary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Class Average" value={`${cohortSummary.class_average}%`} color={scoreColor(cohortSummary.class_average)} icon={BarChart3} />
                <StatCard label="At Risk" value={String(cohortSummary.at_risk_count)} color="text-red-600 dark:text-red-400" icon={AlertTriangle} />
                <StatCard label="Students Graded" value={`${cohortSummary.graded_students}/${cohortSummary.total_students}`} color="text-blue-600 dark:text-blue-400" icon={Users} />
                <StatCard label="Total Students" value={String(cohortSummary.total_students)} color="text-gray-600 dark:text-gray-400" icon={Users} />
              </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              {['overview', 'by-student', 'by-assessment'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as typeof activeTab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                  }`}
                >
                  {tab === 'overview' ? 'Overview' : tab === 'by-student' ? 'By Student' : 'By Assessment'}
                </button>
              ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* At-Risk Students */}
                {summaries.filter(s => s.at_risk).length > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 flex items-center gap-1.5 mb-3">
                      <AlertTriangle className="w-4 h-4" />
                      At-Risk Students (Below 80%)
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-red-600 dark:text-red-400">
                            <th className="pb-2 font-medium">Student</th>
                            <th className="pb-2 font-medium">Quiz Avg</th>
                            <th className="pb-2 font-medium">Exam Avg</th>
                            <th className="pb-2 font-medium">Overall</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-red-100 dark:divide-red-900/20">
                          {summaries.filter(s => s.at_risk).map(s => (
                            <tr key={s.student_id}>
                              <td className="py-2 font-medium text-gray-900 dark:text-white">{s.student_name}</td>
                              <td className={`py-2 ${scoreColor(s.quiz_average)}`}>{s.quiz_average > 0 ? `${s.quiz_average}%` : '—'}</td>
                              <td className={`py-2 ${scoreColor(s.exam_average)}`}>{s.exam_average > 0 ? `${s.exam_average}%` : '—'}</td>
                              <td className={`py-2 font-bold ${scoreColor(s.overall_average)}`}>{s.overall_average}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* All Students Summary Table */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">All Students</h3>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-2.5 top-2 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search..."
                        className="pl-8 pr-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-40"
                      />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Student</th>
                          <th className="px-4 py-2 text-center font-medium text-gray-600 dark:text-gray-300">Quiz Avg</th>
                          <th className="px-4 py-2 text-center font-medium text-gray-600 dark:text-gray-300">Exam Avg</th>
                          <th className="px-4 py-2 text-center font-medium text-gray-600 dark:text-gray-300">Overall</th>
                          <th className="px-4 py-2 text-center font-medium text-gray-600 dark:text-gray-300">Graded</th>
                          <th className="px-4 py-2 text-center font-medium text-gray-600 dark:text-gray-300">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {summaries
                          .filter(s => !searchQuery || s.student_name.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map(s => (
                          <tr
                            key={s.student_id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                            onClick={() => { setSelectedStudent(s.student_id); setActiveTab('by-student'); }}
                          >
                            <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{s.student_name}</td>
                            <td className={`px-4 py-2 text-center ${scoreColor(s.quiz_average)}`}>{s.quiz_average > 0 ? `${s.quiz_average}%` : '—'}</td>
                            <td className={`px-4 py-2 text-center ${scoreColor(s.exam_average)}`}>{s.exam_average > 0 ? `${s.exam_average}%` : '—'}</td>
                            <td className={`px-4 py-2 text-center font-bold ${scoreColor(s.overall_average)}`}>{s.overall_average > 0 ? `${s.overall_average}%` : '—'}</td>
                            <td className="px-4 py-2 text-center text-gray-600 dark:text-gray-400">{s.total_graded}</td>
                            <td className="px-4 py-2 text-center">
                              {s.at_risk ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                                  <AlertTriangle className="w-3 h-3" /> At Risk
                                </span>
                              ) : s.total_graded > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                  <CheckCircle2 className="w-3 h-3" /> On Track
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">No grades</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* By Student Tab */}
            {activeTab === 'by-student' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <select
                    value={selectedStudent || ''}
                    onChange={e => setSelectedStudent(e.target.value || null)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="">Select a student...</option>
                    {summaries.map(s => (
                      <option key={s.student_id} value={s.student_id}>
                        {s.student_name} — {s.overall_average > 0 ? `${s.overall_average}%` : 'No grades'}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedStudent && (() => {
                  const studentGrades = grades.filter(g => g.student_id === selectedStudent);
                  const summary = summaries.find(s => s.student_id === selectedStudent);
                  const byCategory = studentGrades.reduce((acc, g) => {
                    const cat = g.assessment?.category || 'other';
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(g);
                    return acc;
                  }, {} as Record<string, Grade[]>);

                  return (
                    <>
                      {summary && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                            <div><p className="text-xs text-gray-500 uppercase">Overall</p><p className={`text-2xl font-bold ${scoreColor(summary.overall_average)}`}>{summary.overall_average > 0 ? `${summary.overall_average}%` : '—'}</p></div>
                            <div><p className="text-xs text-gray-500 uppercase">Quizzes</p><p className={`text-2xl font-bold ${scoreColor(summary.quiz_average)}`}>{summary.quiz_average > 0 ? `${summary.quiz_average}%` : '—'}</p></div>
                            <div><p className="text-xs text-gray-500 uppercase">Exams</p><p className={`text-2xl font-bold ${scoreColor(summary.exam_average)}`}>{summary.exam_average > 0 ? `${summary.exam_average}%` : '—'}</p></div>
                            <div><p className="text-xs text-gray-500 uppercase">Passed</p><p className="text-2xl font-bold text-green-600">{summary.passed_count}</p></div>
                            <div><p className="text-xs text-gray-500 uppercase">Failed</p><p className="text-2xl font-bold text-red-600">{summary.failed_count}</p></div>
                          </div>
                        </div>
                      )}

                      {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
                        const catGrades = byCategory[cat] || [];
                        if (catGrades.length === 0) return null;
                        return (
                          <div key={cat} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{label}</h3>
                            </div>
                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                              {catGrades.map(g => (
                                <div key={g.id} className="px-4 py-3 flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{g.assessment?.title || g.assessment_id}</p>
                                    <p className="text-xs text-gray-500">{g.date_taken ? new Date(g.date_taken).toLocaleDateString() : '—'}</p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className={`text-lg font-bold ${scoreColor(g.score_percent)}`}>{g.score_percent}%</span>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${g.passed ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                                      {g.passed ? 'Pass' : 'Fail'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
            )}

            {/* By Assessment Tab */}
            {activeTab === 'by-assessment' && cohortSummary && (
              <div className="space-y-3">
                {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
                  const catAssessments = cohortSummary.assessment_averages.filter(a => a.category === cat);
                  if (catAssessments.length === 0) return null;
                  return (
                    <div key={cat} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{label}</h3>
                      </div>
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {catAssessments.map(a => (
                          <div key={a.assessment_id} className="px-4 py-3 flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{a.title}</p>
                              <p className="text-xs text-gray-500">{a.graded_count} students graded</p>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className={`text-sm font-bold ${scoreColor(a.class_average)}`}>
                                  {a.class_average > 0 ? `${a.class_average}%` : '—'}
                                </p>
                                <p className="text-xs text-gray-500">avg</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{a.pass_rate}%</p>
                                <p className="text-xs text-gray-500">pass rate</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {grades.length === 0 && summaries.length === 0 && !isObserver && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No Grades Yet</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {isInstructor
                ? 'Import grades from EMSTesting or add them manually.'
                : 'Grades will appear here once your instructor enters them.'}
            </p>
            {isInstructor && (
              <Link
                href="/lvfr-aemt/grades/import"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
              >
                <Upload className="w-4 h-4" />
                Import from EMSTesting
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Add Grade Modal */}
      {showAddModal && (
        <AddGradeModal
          onClose={() => setShowAddModal(false)}
          onSave={() => { setShowAddModal(false); fetchData(); setToast({ message: 'Grade saved', type: 'success' }); }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ── Sub-Components ─────────────────────────────────────────────────────

function StatCard({ label, value, color, icon: Icon }: { label: string; value: string; color: string; icon: typeof BarChart3 }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function CohortAggregateView({ cohortSummary }: { cohortSummary: CohortSummary }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Class Average" value={`${cohortSummary.class_average}%`} color={scoreColor(cohortSummary.class_average)} icon={BarChart3} />
        <StatCard label="At Risk" value={String(cohortSummary.at_risk_count)} color="text-red-600 dark:text-red-400" icon={AlertTriangle} />
        <StatCard label="Students Graded" value={`${cohortSummary.graded_students}/${cohortSummary.total_students}`} color="text-blue-600 dark:text-blue-400" icon={Users} />
        <StatCard label="Total Students" value={String(cohortSummary.total_students)} color="text-gray-600 dark:text-gray-400" icon={Users} />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Assessment Averages</h3>
          <p className="text-xs text-gray-500 mt-0.5">Cohort-level aggregates (individual student data not shown)</p>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {cohortSummary.assessment_averages.filter(a => a.graded_count > 0).map(a => (
            <div key={a.assessment_id} className="px-4 py-3 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{a.title}</p>
                <p className="text-xs text-gray-500">{CATEGORY_LABELS[a.category] || a.category} — {a.graded_count} students</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className={`text-sm font-bold ${scoreColor(a.class_average)}`}>{a.class_average}%</p>
                  <p className="text-xs text-gray-500">avg</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{a.pass_rate}%</p>
                  <p className="text-xs text-gray-500">pass</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AddGradeModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [assessments, setAssessments] = useState<{ id: string; title: string; category: string }[]>([]);
  const [form, setForm] = useState({ student_id: '', assessment_id: '', score_percent: '', questions_correct: '', questions_total: '', date_taken: new Date().toISOString().split('T')[0] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch students and assessments for dropdowns
    Promise.all([
      fetch('/api/lvfr-aemt/grades/summary').then(r => r.json()),
      fetch('/api/lvfr-aemt/grades?assessment_id=__list__').then(r => r.json()),
    ]).then(([summaryData]) => {
      if (summaryData.students) {
        setStudents(summaryData.students.map((s: StudentSummary) => ({ id: s.student_id, name: s.student_name })));
      }
    });

    // Fetch assessments directly
    fetch('/api/lvfr-aemt/dashboard')
      .then(r => r.json())
      .then(data => {
        if (data.upcomingAssessments) {
          setAssessments(data.upcomingAssessments);
        }
      })
      .catch(() => {});

    // Fallback: fetch from grades summary cohort data
    fetch('/api/lvfr-aemt/grades/summary')
      .then(r => r.json())
      .then(data => {
        if (data.cohort_summary?.assessment_averages) {
          setAssessments(data.cohort_summary.assessment_averages.map((a: { assessment_id: string; title: string; category: string }) => ({
            id: a.assessment_id,
            title: a.title,
            category: a.category,
          })));
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!form.student_id || !form.assessment_id || !form.score_percent) {
      setError('Student, assessment, and score are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/lvfr-aemt/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: form.student_id,
          assessment_id: form.assessment_id,
          score_percent: parseFloat(form.score_percent),
          questions_correct: form.questions_correct ? parseInt(form.questions_correct) : null,
          questions_total: form.questions_total ? parseInt(form.questions_total) : null,
          date_taken: form.date_taken,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onSave();
      } else {
        setError(data.error || 'Failed to save grade');
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add Grade</h3>
        </div>
        <div className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Student</label>
            <select value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="">Select student...</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assessment</label>
            <select value={form.assessment_id} onChange={e => setForm(f => ({ ...f, assessment_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="">Select assessment...</option>
              {assessments.map(a => <option key={a.id} value={a.id}>{a.title} ({CATEGORY_LABELS[a.category] || a.category})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Score %</label>
              <input type="number" min="0" max="100" value={form.score_percent} onChange={e => setForm(f => ({ ...f, score_percent: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" placeholder="85" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
              <input type="date" value={form.date_taken} onChange={e => setForm(f => ({ ...f, date_taken: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Questions Correct</label>
              <input type="number" min="0" value={form.questions_correct} onChange={e => setForm(f => ({ ...f, questions_correct: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" placeholder="34" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Questions Total</label>
              <input type="number" min="0" value={form.questions_total} onChange={e => setForm(f => ({ ...f, questions_total: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" placeholder="40" />
            </div>
          </div>
        </div>
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Grade'}
          </button>
        </div>
      </div>
    </div>
  );
}
