'use client';

import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Breadcrumbs from '@/components/Breadcrumbs';
import { PageLoader } from '@/components/ui';
import { exportToExcel } from '@/lib/export-utils';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Minus,
  Mail,
  Clock,
  Circle,
  Send,
  Download,
  BarChart3,
  Users,
  ClipboardCheck,
  Loader2,
  TrendingUp,
  TrendingDown,
  ChevronDown,
} from 'lucide-react';

/* ─── Interfaces ──────────────────────────────────────────────── */

interface Evaluation {
  id: string;
  skill_name: string;
  skill_id: string;
  result: string;
  evaluation_type: string;
  email_status: string;
  evaluator_name: string;
  attempt_number: number;
  team_role: string | null;
  notes: string | null;
  created_at: string;
  points_earned: number;
  points_possible: number;
  minimum_points: number | null;
  at_risk: boolean;
  critical_fail: boolean;
}

interface StudentResult {
  id: string;
  name: string;
  email: string;
  evaluations: Evaluation[];
}

interface SkillInfo {
  id: string;
  skill_name: string;
}

interface SkillStat {
  skill_name: string;
  pass_count: number;
  total: number;
  pass_rate: number;
  avg_points: number;
  total_possible: number;
  minimum_required: number | null;
}

interface Summary {
  total_evals: number;
  pass_count: number;
  fail_count: number;
  pass_rate: number;
  by_skill: SkillStat[];
}

interface LabDay {
  id: string;
  title: string;
  date: string;
}

interface StudentHistoryEval {
  id: string;
  skill_name: string;
  skill_id: string | null;
  result: string;
  evaluation_type: string;
  email_status: string;
  points_earned: number;
  points_possible: number;
  minimum_points: number | null;
  critical_fail: boolean;
  critical_fail_notes: string | null;
  evaluator_name: string;
  lab_day_title: string;
  lab_day_date: string | null;
  lab_day_id: string | null;
  attempt_number: number;
  team_role: string | null;
  notes: string | null;
  created_at: string;
}

interface StudentHistorySummary {
  total_attempts: number;
  pass_count: number;
  fail_count: number;
  pass_rate: number;
  skills_passed: number;
  skills_attempted: number;
}

type TabKey = 'overview' | 'weakness' | 'individual';

/* ─── Main Page ───────────────────────────────────────────────── */

export default function SkillResultsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const labDayId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentResult[]>([]);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [labDay, setLabDay] = useState<LabDay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingStudent, setSendingStudent] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // Individual student tab state
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentHistory, setStudentHistory] = useState<StudentHistoryEval[] | null>(null);
  const [studentHistorySummary, setStudentHistorySummary] = useState<StudentHistorySummary | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/skill-results`);
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Failed to load results');
        return;
      }
      setStudents(data.students);
      setSkills(data.skills);
      setSummary(data.summary);
    } catch {
      setError('Failed to load results');
    }
  }, [labDayId]);

  const fetchLabDay = useCallback(async () => {
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}`);
      const data = await res.json();
      if (data.id) {
        setLabDay({ id: data.id, title: data.title, date: data.date });
      }
    } catch {
      // Lab day info is supplementary
    }
  }, [labDayId]);

  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (!session) {
      router.push('/');
      return;
    }

    Promise.all([fetchResults(), fetchLabDay()]).finally(() => setLoading(false));
  }, [session, sessionStatus, router, fetchResults, fetchLabDay]);

  // Fetch individual student history when selected
  const fetchStudentHistory = useCallback(async (studentId: string) => {
    if (!studentId) {
      setStudentHistory(null);
      setStudentHistorySummary(null);
      return;
    }
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/lab-management/students/${studentId}/skill-history`);
      const data = await res.json();
      if (data.success) {
        setStudentHistory(data.evaluations);
        setStudentHistorySummary(data.summary);
      } else {
        setStudentHistory([]);
        setStudentHistorySummary(null);
      }
    } catch {
      setStudentHistory([]);
      setStudentHistorySummary(null);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (selectedStudentId) {
      fetchStudentHistory(selectedStudentId);
    }
  }, [selectedStudentId, fetchStudentHistory]);

  const handleResendStudent = async (studentId: string) => {
    setSendingStudent(studentId);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/skill-results/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId }),
      });
      const data = await res.json();
      if (data.success) {
        setToastMessage(`Sent ${data.sent} email(s)${data.errors > 0 ? `, ${data.errors} failed` : ''}`);
        await fetchResults();
      } else {
        setToastMessage(`Error: ${data.error}`);
      }
    } catch {
      setToastMessage('Failed to send emails');
    } finally {
      setSendingStudent(null);
    }
  };

  const handleSendAllQueued = async () => {
    const queuedIds: string[] = [];
    for (const student of students) {
      for (const ev of student.evaluations) {
        if (ev.email_status === 'queued' || ev.email_status === 'pending') {
          queuedIds.push(ev.id);
        }
      }
    }
    if (queuedIds.length === 0) {
      setToastMessage('No queued emails to send');
      return;
    }

    setSendingAll(true);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/skill-results/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluation_ids: queuedIds }),
      });
      const data = await res.json();
      if (data.success) {
        setToastMessage(`Sent ${data.sent} email(s)${data.errors > 0 ? `, ${data.errors} failed` : ''}`);
        await fetchResults();
      } else {
        setToastMessage(`Error: ${data.error}`);
      }
    } catch {
      setToastMessage('Failed to send emails');
    } finally {
      setSendingAll(false);
    }
  };

  const handleExportCSV = () => {
    if (!students.length || !skills.length) return;

    const rows: Record<string, string>[] = [];
    for (const student of students) {
      const row: Record<string, string> = { student_name: student.name, email: student.email };
      for (const skill of skills) {
        const ev = student.evaluations.find(e => e.skill_id === skill.id);
        if (ev) {
          row[skill.skill_name] = ev.points_possible > 0 ? `${ev.points_earned}/${ev.points_possible}` : ev.result;
          row[`${skill.skill_name} Result`] = ev.result;
          row[`${skill.skill_name} Email`] = ev.email_status;
        } else {
          row[skill.skill_name] = 'N/A';
          row[`${skill.skill_name} Result`] = 'N/A';
          row[`${skill.skill_name} Email`] = 'N/A';
        }
      }
      const total = student.evaluations.length;
      const passed = student.evaluations.filter(e => e.result === 'pass').length;
      row['Pass Rate'] = total > 0 ? `${Math.round((passed / total) * 100)}%` : 'N/A';
      rows.push(row);
    }

    const columns = [
      { key: 'student_name', label: 'Student' },
      { key: 'email', label: 'Email' },
      ...skills.flatMap(s => [
        { key: s.skill_name, label: `${s.skill_name} Score` },
        { key: `${s.skill_name} Result`, label: `${s.skill_name} Result` },
        { key: `${s.skill_name} Email`, label: `${s.skill_name} Email Status` },
      ]),
      { key: 'Pass Rate', label: 'Pass Rate' },
    ];

    const dateStr = labDay?.date
      ? new Date(labDay.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';

    exportToExcel({
      title: `Skill Evaluation Results`,
      subtitle: labDay ? `${labDay.title} - ${dateStr}` : undefined,
      filename: `skill-results-${labDayId}`,
      columns,
      data: rows,
    });
  };

  // Toast auto-dismiss
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  if (sessionStatus === 'loading' || loading) {
    return <PageLoader message="Loading skill evaluation results..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto text-center py-20">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Error Loading Results</h2>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  const dateFormatted = labDay?.date
    ? new Date(labDay.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  const queuedCount = students.reduce(
    (sum, s) => sum + s.evaluations.filter(e => e.email_status === 'queued' || e.email_status === 'pending').length,
    0
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Breadcrumbs */}
        <Breadcrumbs
          entityTitle={labDay?.title || 'Lab Day'}
          customSegments={{ results: 'Results' }}
        />

        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Skill Evaluation Results
            </h1>
            {labDay && (
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {labDay.title} &mdash; {dateFormatted}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {queuedCount > 0 && (
              <button
                onClick={handleSendAllQueued}
                disabled={sendingAll}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {sendingAll ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send All Queued ({queuedCount})
              </button>
            )}
            <button
              onClick={handleExportCSV}
              disabled={!students.length}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Export Excel
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <ClipboardCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Evaluations</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.total_evals}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Overall Pass Rate</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{summary.pass_rate}%</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Students Evaluated</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{students.length}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {(['overview', 'weakness', 'individual'] as TabKey[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab === 'overview' ? 'Cohort Overview' : tab === 'weakness' ? 'Skill Weakness' : 'Individual Student'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <CohortOverviewTab
            students={students}
            skills={skills}
            summary={summary}
            labDayId={labDayId}
            sendingStudent={sendingStudent}
            onResendStudent={handleResendStudent}
          />
        )}

        {activeTab === 'weakness' && (
          <SkillWeaknessTab summary={summary} />
        )}

        {activeTab === 'individual' && (
          <IndividualStudentTab
            students={students}
            selectedStudentId={selectedStudentId}
            onSelectStudent={setSelectedStudentId}
            history={studentHistory}
            historySummary={studentHistorySummary}
            loading={loadingHistory}
            labDayId={labDayId}
            onResendDone={fetchResults}
          />
        )}

        {/* Toast notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-5 py-3 rounded-lg shadow-lg text-sm font-medium animate-in slide-in-from-bottom-4">
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Tab 1: Cohort Overview ──────────────────────────────────── */

function CohortOverviewTab({
  students,
  skills,
  summary,
  labDayId,
  sendingStudent,
  onResendStudent,
}: {
  students: StudentResult[];
  skills: SkillInfo[];
  summary: Summary | null;
  labDayId: string;
  sendingStudent: string | null;
  onResendStudent: (id: string) => void;
}) {
  if (!students.length || !skills.length) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
        <ClipboardCheck className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Evaluations Found</h3>
        <p className="text-gray-500 dark:text-gray-400">
          No completed skill evaluations were recorded for this lab day.
        </p>
      </div>
    );
  }

  // Sort students: lowest pass rate first, then by name
  const sortedStudents = [...students].sort((a, b) => {
    const aTotal = a.evaluations.length;
    const bTotal = b.evaluations.length;
    const aRate = aTotal > 0 ? a.evaluations.filter(e => e.result === 'pass').length / aTotal : 1;
    const bRate = bTotal > 0 ? b.evaluations.filter(e => e.result === 'pass').length / bTotal : 1;
    if (aRate !== bRate) return aRate - bRate;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-900/50 z-10">
                Student
              </th>
              {skills.map((skill) => (
                <th
                  key={skill.id}
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  <span className="block max-w-[120px] truncate mx-auto" title={skill.skill_name}>
                    {skill.skill_name}
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Pass Rate
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {sortedStudents.map((student) => {
              const total = student.evaluations.length;
              const passed = student.evaluations.filter(e => e.result === 'pass').length;
              const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
              const hasCriticalFail = student.evaluations.some(e => e.critical_fail);
              const hasUnsent = student.evaluations.some(
                e => e.email_status === 'queued' || e.email_status === 'pending'
              );

              // Row highlight: red for critical fail, amber for below 70%
              let rowBg = '';
              if (hasCriticalFail) {
                rowBg = 'bg-red-50/50 dark:bg-red-900/10';
              } else if (passRate < 70 && total > 0) {
                rowBg = 'bg-amber-50/50 dark:bg-amber-900/10';
              }

              return (
                <tr key={student.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${rowBg}`}>
                  <td className={`px-4 py-3 text-sm font-medium text-gray-900 dark:text-white sticky left-0 z-10 ${rowBg || 'bg-white dark:bg-gray-800'}`}>
                    <div>{student.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{student.email}</div>
                  </td>
                  {skills.map((skill) => {
                    const ev = student.evaluations.find(e => e.skill_id === skill.id);
                    return (
                      <td key={skill.id} className="px-4 py-3 text-center">
                        {ev ? (
                          <ScoreCell evaluation={ev} />
                        ) : (
                          <Minus className="w-4 h-4 text-gray-300 dark:text-gray-600 mx-auto" />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-sm font-semibold ${
                        passRate >= 80
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : passRate >= 60
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {passRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {hasUnsent && (
                      <button
                        onClick={() => onResendStudent(student.id)}
                        disabled={sendingStudent === student.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/50 disabled:opacity-50 transition-colors"
                        title="Resend unsent result emails"
                      >
                        {sendingStudent === student.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Mail className="w-3 h-3" />
                        )}
                        Resend
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}

            {/* Bottom summary row */}
            <tr className="bg-gray-50 dark:bg-gray-900/50 font-medium">
              <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 sticky left-0 bg-gray-50 dark:bg-gray-900/50 z-10">
                Skill Summary
              </td>
              {skills.map((skill) => {
                const stat = summary?.by_skill.find(s => s.skill_name === skill.skill_name);
                return (
                  <td key={skill.id} className="px-4 py-3 text-center">
                    {stat ? (
                      <div className="space-y-0.5">
                        <div className={`text-xs font-semibold ${
                          stat.pass_rate >= 80
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : stat.pass_rate >= 60
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {stat.pass_count}/{stat.total} passed
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Avg: {stat.avg_points} pts
                        </div>
                        {stat.minimum_required !== null && (
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            Min: {stat.minimum_required}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">--</span>
                    )}
                  </td>
                );
              })}
              <td className="px-4 py-3 text-center">
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {summary?.pass_rate ?? 0}%
                </span>
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Score Cell Component ────────────────────────────────────── */

function ScoreCell({ evaluation }: { evaluation: Evaluation }) {
  const { points_earned, points_possible, minimum_points, result, critical_fail, at_risk, email_status } = evaluation;

  // Determine color
  let bgClass = '';
  let textClass = '';
  let label = '';

  if (critical_fail) {
    bgClass = 'bg-red-100 dark:bg-red-900/30';
    textClass = 'text-red-800 dark:text-red-300';
    label = 'CRITICAL FAIL';
  } else if (result === 'fail') {
    bgClass = 'bg-red-100 dark:bg-red-900/30';
    textClass = 'text-red-800 dark:text-red-300';
    label = 'FAIL';
  } else if (at_risk) {
    bgClass = 'bg-amber-100 dark:bg-amber-900/30';
    textClass = 'text-amber-800 dark:text-amber-300';
    label = 'AT RISK';
  } else if (result === 'pass') {
    bgClass = 'bg-emerald-100 dark:bg-emerald-900/30';
    textClass = 'text-emerald-800 dark:text-emerald-300';
    label = 'PASS';
  } else {
    textClass = 'text-gray-600 dark:text-gray-400';
    label = result.toUpperCase();
  }

  const tooltipText = `Points: ${points_earned}/${points_possible}${minimum_points !== null ? ` — Minimum: ${minimum_points}` : ''} — ${label}`;

  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${bgClass} ${textClass}`}
        title={tooltipText}
      >
        {points_possible > 0 ? `${points_earned}/${points_possible}` : result}
      </span>
      <EmailStatusIcon status={email_status} />
    </div>
  );
}

/* ─── Tab 2: Skill Weakness Analysis ──────────────────────────── */

function SkillWeaknessTab({ summary }: { summary: Summary | null }) {
  if (!summary || summary.by_skill.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
        <BarChart3 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Skill Data</h3>
        <p className="text-gray-500 dark:text-gray-400">No skill evaluations to analyze.</p>
      </div>
    );
  }

  // Sort by pass rate ascending (weakest first)
  const sorted = [...summary.by_skill].sort((a, b) => a.pass_rate - b.pass_rate);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Skills sorted by pass rate (weakest first) — use this view for pre-NREMT coaching focus areas.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sorted.map((skill) => (
          <div
            key={skill.skill_name}
            className={`bg-white dark:bg-gray-800 rounded-lg shadow p-5 border-l-4 ${
              skill.pass_rate >= 80
                ? 'border-emerald-500'
                : skill.pass_rate >= 60
                ? 'border-amber-500'
                : 'border-red-500'
            }`}
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              {skill.skill_name}
            </h3>

            {/* Pass rate bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Pass Rate</span>
                <span className={`font-semibold ${
                  skill.pass_rate >= 80
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : skill.pass_rate >= 60
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {skill.pass_count}/{skill.total} ({skill.pass_rate}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all ${
                    skill.pass_rate >= 80
                      ? 'bg-emerald-500'
                      : skill.pass_rate >= 60
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${skill.pass_rate}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Avg Score</span>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {skill.avg_points} / {skill.total_possible} pts
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Min Required</span>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {skill.minimum_required !== null ? `${skill.minimum_required} pts` : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Tab 3: Individual Student ───────────────────────────────── */

function IndividualStudentTab({
  students,
  selectedStudentId,
  onSelectStudent,
  history,
  historySummary,
  loading,
  labDayId,
  onResendDone,
}: {
  students: StudentResult[];
  selectedStudentId: string;
  onSelectStudent: (id: string) => void;
  history: StudentHistoryEval[] | null;
  historySummary: StudentHistorySummary | null;
  loading: boolean;
  labDayId: string;
  onResendDone: () => void;
}) {
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (toastMsg) {
      const t = setTimeout(() => setToastMsg(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toastMsg]);

  const handleResendEval = async (evalId: string) => {
    setResendingId(evalId);
    try {
      // We need the lab_day_id for this evaluation
      const ev = history?.find(h => h.id === evalId);
      const dayId = ev?.lab_day_id || labDayId;
      const res = await fetch(`/api/lab-management/lab-days/${dayId}/skill-results/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluation_ids: [evalId] }),
      });
      const data = await res.json();
      if (data.success) {
        setToastMsg(`Sent ${data.sent} email(s)`);
        onResendDone();
      } else {
        setToastMsg(`Error: ${data.error}`);
      }
    } catch {
      setToastMsg('Failed to send email');
    } finally {
      setResendingId(null);
    }
  };

  // Compute trend indicators: group by skill, see if improving or declining
  function getTrend(evalList: StudentHistoryEval[], currentEval: StudentHistoryEval): 'improving' | 'declining' | null {
    const sameSkill = evalList
      .filter(e => e.skill_name === currentEval.skill_name)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    if (sameSkill.length < 2) return null;
    const idx = sameSkill.findIndex(e => e.id === currentEval.id);
    if (idx <= 0) return null;
    const prev = sameSkill[idx - 1];
    if (currentEval.points_earned > prev.points_earned) return 'improving';
    if (currentEval.points_earned < prev.points_earned) return 'declining';
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Student selector */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Select Student
        </label>
        <div className="relative max-w-md">
          <select
            value={selectedStudentId}
            onChange={(e) => onSelectStudent(e.target.value)}
            className="w-full appearance-none bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 pr-10 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="">-- Choose a student --</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
          <span className="ml-2 text-gray-500 dark:text-gray-400">Loading student history...</span>
        </div>
      )}

      {/* Summary */}
      {!loading && historySummary && selectedStudentId && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Total Attempts</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{historySummary.total_attempts}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Pass Rate</p>
            <p className={`text-xl font-bold ${
              historySummary.pass_rate >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
              historySummary.pass_rate >= 60 ? 'text-amber-600 dark:text-amber-400' :
              'text-red-600 dark:text-red-400'
            }`}>{historySummary.pass_rate}%</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Skills Passed</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{historySummary.skills_passed}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Skills Attempted</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{historySummary.skills_attempted}</p>
          </div>
        </div>
      )}

      {/* History table */}
      {!loading && history && history.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Lab Day</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Skill</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Points</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Result</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Evaluator</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Notes</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {history.map((ev) => {
                  const trend = getTrend(history, ev);
                  const isCritical = ev.critical_fail;
                  const rowBg = isCritical
                    ? 'bg-red-50/50 dark:bg-red-900/10'
                    : ev.result === 'fail'
                    ? 'bg-red-50/30 dark:bg-red-900/5'
                    : '';

                  const dateStr = ev.lab_day_date
                    ? new Date(ev.lab_day_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : new Date(ev.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                  const canResend = ev.email_status === 'queued' || ev.email_status === 'pending';

                  return (
                    <tr key={ev.id} className={`${rowBg} hover:bg-gray-50 dark:hover:bg-gray-800/50`}>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {ev.lab_day_title}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                        {ev.skill_name}
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {ev.points_possible > 0 ? `${ev.points_earned}/${ev.points_possible}` : '--'}
                        </span>
                        {ev.minimum_points !== null && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
                            (min {ev.minimum_points})
                          </span>
                        )}
                        {trend === 'improving' && (
                          <TrendingUp className="w-3 h-3 text-emerald-500 inline ml-1" />
                        )}
                        {trend === 'declining' && (
                          <TrendingDown className="w-3 h-3 text-red-500 inline ml-1" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ResultBadge result={ev.result} critical={isCritical} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {ev.evaluator_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-[200px] truncate" title={ev.notes || ev.critical_fail_notes || ''}>
                        {ev.critical_fail_notes || ev.notes || '--'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {canResend && (
                          <button
                            onClick={() => handleResendEval(ev.id)}
                            disabled={resendingId === ev.id}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/50 disabled:opacity-50 transition-colors"
                          >
                            {resendingId === ev.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Mail className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && selectedStudentId && history && history.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <ClipboardCheck className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Evaluations Found</h3>
          <p className="text-gray-500 dark:text-gray-400">This student has no completed skill evaluations.</p>
        </div>
      )}

      {/* Per-eval toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-5 py-3 rounded-lg shadow-lg text-sm font-medium">
          {toastMsg}
        </div>
      )}
    </div>
  );
}

/* ─── Shared Components ───────────────────────────────────────── */

function ResultBadge({ result, critical }: { result: string; critical?: boolean }) {
  if (critical) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
        <XCircle className="w-3 h-3" />
        Critical
      </span>
    );
  }
  switch (result) {
    case 'pass':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
          <CheckCircle className="w-3 h-3" />
          Pass
        </span>
      );
    case 'fail':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
          <XCircle className="w-3 h-3" />
          Fail
        </span>
      );
    case 'remediation':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
          <AlertTriangle className="w-3 h-3" />
          Remed
        </span>
      );
    default:
      return (
        <span className="text-xs text-gray-400 dark:text-gray-500">{result}</span>
      );
  }
}

function EmailStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'sent':
      return (
        <span title="Email sent" className="text-emerald-500 dark:text-emerald-400">
          <CheckCircle className="w-3 h-3" />
        </span>
      );
    case 'queued':
      return (
        <span title="Email queued" className="text-amber-500 dark:text-amber-400">
          <Clock className="w-3 h-3" />
        </span>
      );
    case 'pending':
      return (
        <span title="Email pending" className="text-gray-400 dark:text-gray-500">
          <Circle className="w-3 h-3" />
        </span>
      );
    case 'do_not_send':
      return null;
    default:
      return null;
  }
}
