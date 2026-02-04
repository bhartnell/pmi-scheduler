'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  UserCheck,
  Download,
  Printer,
  FileSpreadsheet,
  Loader2,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';

interface OnboardingStatusData {
  summary: {
    totalInstructors: number;
    fullyOnboarded: number;
    inProgress: number;
    notStarted: number;
  };
  instructorBreakdown: Array<{
    id: string;
    name: string;
    email: string;
    status: string;
    tasksCompleted: number;
    totalTasks: number;
    completionRate: number;
    pendingTasks: string[];
  }>;
  taskCompletion: Array<{
    taskName: string;
    completedCount: number;
    totalCount: number;
    completionRate: number;
  }>;
  flaggedInstructors: Array<{
    id: string;
    name: string;
    reason: string;
    details: string;
  }>;
}

export default function OnboardingStatusReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const reportRef = useRef<HTMLDivElement>(null);

  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState<OnboardingStatusData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  const generateReport = async () => {
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/reports/onboarding-status');
      const data = await res.json();

      if (data.success) {
        setReportData(data.report);
      } else {
        setError(data.error || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      setError('Failed to generate report');
    }

    setGenerating(false);
  };

  const handlePrint = () => window.print();
  const handleExportPDF = () => window.print();

  const handleExportExcel = async () => {
    if (!reportData) return;

    let csv = 'Onboarding Status Report\n';
    csv += `Generated,${new Date().toLocaleString()}\n\n`;

    csv += 'Summary\n';
    csv += `Total Instructors,${reportData.summary.totalInstructors}\n`;
    csv += `Fully Onboarded,${reportData.summary.fullyOnboarded}\n`;
    csv += `In Progress,${reportData.summary.inProgress}\n`;
    csv += `Not Started,${reportData.summary.notStarted}\n\n`;

    csv += 'Instructor Breakdown\n';
    csv += 'Name,Email,Status,Tasks Completed,Total Tasks,Completion %,Pending Tasks\n';
    reportData.instructorBreakdown.forEach(instructor => {
      csv += `${instructor.name},${instructor.email},${instructor.status},${instructor.tasksCompleted},${instructor.totalTasks},${instructor.completionRate.toFixed(0)}%,"${instructor.pendingTasks.join('; ')}"\n`;
    });
    csv += '\n';

    csv += 'Task Completion Summary\n';
    csv += 'Task,Completed,Total,Completion %\n';
    reportData.taskCompletion.forEach(task => {
      csv += `${task.taskName},${task.completedCount},${task.totalCount},${task.completionRate.toFixed(0)}%\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `onboarding-status-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      case 'in progress':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
      case 'not started':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

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
      <div className="bg-white dark:bg-gray-800 shadow-sm print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management/reports" className="hover:text-blue-600 dark:hover:text-blue-400">Reports</Link>
            <ChevronRight className="w-4 h-4" />
            <span>Onboarding Status</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <UserCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Onboarding Status Report</h1>
              <p className="text-gray-600 dark:text-gray-400">New instructor onboarding task progress and completion</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Generate Button */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 print:hidden">
          <div className="p-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Generate Report</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">View onboarding progress for all instructors</p>
            </div>

            <button
              onClick={generateReport}
              disabled={generating}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  Generate Report
                </>
              )}
            </button>
          </div>
          {error && (
            <div className="px-4 pb-4">
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
                {error}
              </div>
            </div>
          )}
        </div>

        {/* Report Output */}
        {reportData && (
          <>
            <div className="flex justify-end gap-2 mb-4 print:hidden">
              <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors">
                <FileSpreadsheet className="w-4 h-4" />
                Export Excel
              </button>
              <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors">
                <Download className="w-4 h-4" />
                Export PDF
              </button>
              <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors">
                <Printer className="w-4 h-4" />
                Print
              </button>
            </div>

            <div ref={reportRef} className="bg-white dark:bg-gray-800 rounded-lg shadow print:shadow-none">
              {/* Report Header */}
              <div className="p-6 border-b dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Onboarding Status Report</h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Instructor onboarding task progress</p>
                  </div>
                  <div className="text-right text-sm text-gray-500 dark:text-gray-400">
                    <p>Generated: {new Date().toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="p-6 border-b dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
                      <Users className="w-4 h-4" />
                      Total Instructors
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{reportData.summary.totalInstructors}</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      Fully Onboarded
                    </div>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">{reportData.summary.fullyOnboarded}</p>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 text-sm">
                      <Clock className="w-4 h-4" />
                      In Progress
                    </div>
                    <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300 mt-1">{reportData.summary.inProgress}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
                      <XCircle className="w-4 h-4" />
                      Not Started
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{reportData.summary.notStarted}</p>
                  </div>
                </div>
              </div>

              {/* Task Completion Overview */}
              {reportData.taskCompletion.length > 0 && (
                <div className="p-6 border-b dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Task Completion Overview</h3>
                  <div className="space-y-3">
                    {reportData.taskCompletion.map((task, idx) => (
                      <div key={idx} className="flex items-center gap-4">
                        <span className="w-48 text-sm text-gray-700 dark:text-gray-300 truncate">{task.taskName}</span>
                        <div className="flex-1 max-w-md">
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                            <div
                              className={`h-3 rounded-full transition-all ${
                                task.completionRate >= 80 ? 'bg-green-600' :
                                task.completionRate >= 50 ? 'bg-yellow-600' :
                                'bg-gray-400'
                              }`}
                              style={{ width: `${task.completionRate}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-400 w-20 text-right">
                          {task.completedCount}/{task.totalCount} ({task.completionRate.toFixed(0)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Flagged Instructors */}
              {reportData.flaggedInstructors.length > 0 && (
                <div className="p-6 border-b dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    Attention Required ({reportData.flaggedInstructors.length})
                  </h3>
                  <div className="space-y-2">
                    {reportData.flaggedInstructors.map((instructor) => (
                      <div
                        key={instructor.id}
                        className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{instructor.name}</p>
                          <p className="text-sm text-orange-700 dark:text-orange-400">{instructor.reason}</p>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{instructor.details}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Instructor Breakdown Table */}
              <div className="p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Instructor Breakdown</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Instructor</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Status</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Progress</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Pending Tasks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                      {reportData.instructorBreakdown.map((instructor) => (
                        <tr key={instructor.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{instructor.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{instructor.email}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(instructor.status)}`}>
                              {instructor.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    instructor.completionRate === 100 ? 'bg-green-600' :
                                    instructor.completionRate >= 50 ? 'bg-yellow-600' :
                                    'bg-gray-400'
                                  }`}
                                  style={{ width: `${instructor.completionRate}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                {instructor.tasksCompleted}/{instructor.totalTasks}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-sm">
                            {instructor.pendingTasks.length > 0 ? (
                              <span className="truncate block max-w-xs" title={instructor.pendingTasks.join(', ')}>
                                {instructor.pendingTasks.slice(0, 2).join(', ')}
                                {instructor.pendingTasks.length > 2 && ` +${instructor.pendingTasks.length - 2} more`}
                              </span>
                            ) : (
                              <span className="text-green-600 dark:text-green-400">All complete</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Empty State */}
        {!reportData && !generating && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center print:hidden">
            <UserCheck className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Report Generated</h3>
            <p className="text-gray-600 dark:text-gray-400">Click "Generate Report" to view onboarding status for all instructors.</p>
          </div>
        )}
      </main>

      <style jsx global>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
