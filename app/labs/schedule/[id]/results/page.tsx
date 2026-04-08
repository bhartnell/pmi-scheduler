'use client';

import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Breadcrumbs from '@/components/Breadcrumbs';
import { PageLoader } from '@/components/ui';
import { exportToExcel } from '@/lib/export-utils';
import { hasMinRole } from '@/lib/permissions';
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
  RefreshCw,
  BarChart3,
  Users,
  ClipboardCheck,
  Loader2,
} from 'lucide-react';

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
    // Collect all evaluation IDs with queued/pending status
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

    const rows: any[] = [];
    for (const student of students) {
      const row: any = { student_name: student.name, email: student.email };
      for (const skill of skills) {
        const ev = student.evaluations.find(e => e.skill_id === skill.id);
        row[skill.skill_name] = ev ? ev.result : 'N/A';
        row[`${skill.skill_name} Email`] = ev ? ev.email_status : 'N/A';
      }
      // Student pass rate
      const total = student.evaluations.length;
      const passed = student.evaluations.filter(e => e.result === 'pass').length;
      row['Pass Rate'] = total > 0 ? `${Math.round((passed / total) * 100)}%` : 'N/A';
      rows.push(row);
    }

    const columns = [
      { key: 'student_name', label: 'Student' },
      { key: 'email', label: 'Email' },
      ...skills.flatMap(s => [
        { key: s.skill_name, label: s.skill_name },
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

        {/* Per-Skill Pass Rate Bars */}
        {summary && summary.by_skill.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Pass Rate by Skill</h2>
            <div className="space-y-3">
              {summary.by_skill.map((skill) => (
                <div key={skill.skill_name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-700 dark:text-gray-300 truncate mr-4">{skill.skill_name}</span>
                    <span className="font-medium text-gray-900 dark:text-white whitespace-nowrap">
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
              ))}
            </div>
          </div>
        )}

        {/* Student x Skill Matrix */}
        {students.length > 0 && skills.length > 0 ? (
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
                  {students.map((student) => {
                    const total = student.evaluations.length;
                    const passed = student.evaluations.filter(e => e.result === 'pass').length;
                    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
                    const hasUnsent = student.evaluations.some(
                      e => e.email_status === 'queued' || e.email_status === 'pending'
                    );

                    return (
                      <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-800 z-10">
                          <div>{student.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{student.email}</div>
                        </td>
                        {skills.map((skill) => {
                          const ev = student.evaluations.find(e => e.skill_id === skill.id);
                          return (
                            <td key={skill.id} className="px-4 py-3 text-center">
                              {ev ? (
                                <div className="flex flex-col items-center gap-1">
                                  <ResultBadge result={ev.result} />
                                  <EmailStatusIcon status={ev.email_status} />
                                </div>
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
                              onClick={() => handleResendStudent(student.id)}
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

                  {/* Bottom row: skill pass rates */}
                  <tr className="bg-gray-50 dark:bg-gray-900/50 font-medium">
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 sticky left-0 bg-gray-50 dark:bg-gray-900/50 z-10">
                      Skill Pass Rate
                    </td>
                    {skills.map((skill) => {
                      const stat = summary?.by_skill.find(s => s.skill_name === skill.skill_name);
                      return (
                        <td key={skill.id} className="px-4 py-3 text-center">
                          <span
                            className={`text-sm font-semibold ${
                              (stat?.pass_rate ?? 0) >= 80
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : (stat?.pass_rate ?? 0) >= 60
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {stat ? `${stat.pass_rate}%` : '--'}
                          </span>
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
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <ClipboardCheck className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Evaluations Found</h3>
            <p className="text-gray-500 dark:text-gray-400">
              No completed skill evaluations were recorded for this lab day.
            </p>
          </div>
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

function ResultBadge({ result }: { result: string }) {
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
