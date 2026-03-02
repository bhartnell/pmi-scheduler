'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Users,
  Download,
  Printer,
  FileSpreadsheet,
  Loader2,
  Star,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Calendar
} from 'lucide-react';

interface Cohort {
  id: string;
  cohort_number: number;
  program: { abbreviation: string };
}

interface TeamLeadsData {
  cohort: {
    id: string;
    name: string;
  };
  dateRange: {
    start: string;
    end: string;
  };
  summary: {
    totalRotations: number;
    averagePerStudent: number;
    studentsWithZero: number;
    mostRotations: number;
    totalStudents: number;
  };
  studentBreakdown: Array<{
    id: string;
    name: string;
    rotationCount: number;
    lastRotationDate: string | null;
    needsMore: boolean;
  }>;
  recentRotations: Array<{
    date: string;
    studentName: string;
    scenario: string;
  }>;
  studentsNeedingRotations: Array<{
    id: string;
    name: string;
    count: number;
    daysSinceLast: number | null;
  }>;
}

export default function TeamLeadsReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const reportRef = useRef<HTMLDivElement>(null);

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohort, setSelectedCohort] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState<TeamLeadsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchCohorts();
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 3);
      setEndDate(end.toISOString().split('T')[0]);
      setStartDate(start.toISOString().split('T')[0]);
    }
  }, [session]);

  const fetchCohorts = async () => {
    try {
      const res = await fetch('/api/lab-management/cohorts?activeOnly=true');
      const data = await res.json();
      if (data.success) {
        setCohorts(data.cohorts || []);
        if (data.cohorts?.length > 0) {
          setSelectedCohort(data.cohorts[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching cohorts:', error);
    }
  };

  const generateReport = async () => {
    if (!selectedCohort) {
      setError('Please select a cohort');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        cohortId: selectedCohort,
        startDate,
        endDate,
      });

      const res = await fetch(`/api/reports/team-leads?${params}`);
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

    let csv = 'Team Lead Rotations Report\n';
    csv += `Cohort,${reportData.cohort.name}\n`;
    csv += `Date Range,${reportData.dateRange.start} to ${reportData.dateRange.end}\n`;
    csv += `Generated,${new Date().toLocaleString()}\n\n`;

    csv += 'Summary\n';
    csv += `Total Rotations,${reportData.summary.totalRotations}\n`;
    csv += `Average Per Student,${reportData.summary.averagePerStudent.toFixed(1)}\n`;
    csv += `Students with Zero,${reportData.summary.studentsWithZero}\n\n`;

    csv += 'Student Breakdown\n';
    csv += 'Name,Rotations,Last Rotation,Needs More\n';
    reportData.studentBreakdown.forEach(student => {
      csv += `${student.name},${student.rotationCount},${student.lastRotationDate || 'Never'},${student.needsMore ? 'Yes' : 'No'}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `team-leads-${reportData.cohort.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
            <span>Team Lead Rotations</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Users className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Team Lead Rotations Report</h1>
              <p className="text-gray-600 dark:text-gray-400">Who has led, how often, and who needs more opportunities</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Parameters Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 print:hidden">
          <div className="p-4 border-b dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Report Parameters</h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cohort</label>
                <select
                  value={selectedCohort}
                  onChange={(e) => setSelectedCohort(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                >
                  <option value="">Select Cohort</option>
                  {cohorts.map(cohort => (
                    <option key={cohort.id} value={cohort.id}>
                      {cohort.program.abbreviation} Group {cohort.cohort_number}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={generateReport}
                disabled={generating || !selectedCohort}
                className="flex items-center gap-2 px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4" />
                    Generate Report
                  </>
                )}
              </button>
            </div>
          </div>
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
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Team Lead Rotations Report</h2>
                    <p className="text-lg text-gray-600 dark:text-gray-400 mt-1">{reportData.cohort.name}</p>
                  </div>
                  <div className="text-right text-sm text-gray-500 dark:text-gray-400">
                    <p>Date Range: {new Date(reportData.dateRange.start).toLocaleDateString()} - {new Date(reportData.dateRange.end).toLocaleDateString()}</p>
                    <p>Generated: {new Date().toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="p-6 border-b dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
                      <Star className="w-4 h-4" />
                      Total Rotations
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{reportData.summary.totalRotations}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="text-gray-600 dark:text-gray-400 text-sm">Total Students</div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{reportData.summary.totalStudents}</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm">
                      <TrendingUp className="w-4 h-4" />
                      Avg Per Student
                    </div>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">{reportData.summary.averagePerStudent.toFixed(1)}</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                    <div className="text-green-600 dark:text-green-400 text-sm">Most Rotations</div>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">{reportData.summary.mostRotations}</p>
                  </div>
                  <div className={`rounded-lg p-4 ${reportData.summary.studentsWithZero > 0 ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                    <div className={`flex items-center gap-2 text-sm ${reportData.summary.studentsWithZero > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-600 dark:text-gray-400'}`}>
                      <AlertTriangle className="w-4 h-4" />
                      With Zero
                    </div>
                    <p className={`text-2xl font-bold mt-1 ${reportData.summary.studentsWithZero > 0 ? 'text-orange-700 dark:text-orange-300' : 'text-gray-900 dark:text-white'}`}>
                      {reportData.summary.studentsWithZero}
                    </p>
                  </div>
                </div>
              </div>

              {/* Students Needing Rotations */}
              {reportData.studentsNeedingRotations.length > 0 && (
                <div className="p-6 border-b dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    Students Needing More Rotations ({reportData.studentsNeedingRotations.length})
                  </h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {reportData.studentsNeedingRotations.map((student) => (
                      <div
                        key={student.id}
                        className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{student.name}</p>
                          <p className="text-sm text-orange-700 dark:text-orange-400">
                            {student.count === 0 ? 'Never led' : `${student.count} rotation${student.count !== 1 ? 's' : ''}`}
                          </p>
                        </div>
                        {student.daysSinceLast !== null && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {student.daysSinceLast}d ago
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Rotations */}
              {reportData.recentRotations.length > 0 && (
                <div className="p-6 border-b dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-500" />
                    Recent Rotations
                  </h3>
                  <div className="space-y-2">
                    {reportData.recentRotations.slice(0, 10).map((rotation, idx) => (
                      <div key={idx} className="flex items-center gap-4 p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                        <span className="text-sm text-gray-500 dark:text-gray-400 w-24">
                          {new Date(rotation.date + 'T12:00:00').toLocaleDateString()}
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">{rotation.studentName}</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{rotation.scenario}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Student Breakdown Table */}
              <div className="p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Student Breakdown</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Student</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Rotations</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Last Rotation</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                      {reportData.studentBreakdown.map((student) => (
                        <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{student.name}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 ${student.rotationCount === 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-600 dark:text-gray-400'}`}>
                              <Star className="w-3 h-3" />
                              {student.rotationCount}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                            {student.lastRotationDate ? new Date(student.lastRotationDate + 'T12:00:00').toLocaleDateString() : 'Never'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {student.needsMore ? (
                              <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs rounded-full">
                                Needs More
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-full">
                                On Track
                              </span>
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
            <Users className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Report Generated</h3>
            <p className="text-gray-600 dark:text-gray-400">Select a cohort and date range, then click "Generate Report" to view team lead rotation data.</p>
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
