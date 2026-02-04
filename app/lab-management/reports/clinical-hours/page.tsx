'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Clock,
  Download,
  Printer,
  FileSpreadsheet,
  Loader2,
  Building2,
  Users,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

interface Cohort {
  id: string;
  cohort_number: number;
  program: { abbreviation: string };
}

interface ClinicalHoursData {
  cohort: {
    id: string;
    name: string;
  };
  dateRange: {
    start: string;
    end: string;
  };
  requirements: {
    erHours: number;
    icrHours: number;
    cclHours: number;
    emsHours: number;
  };
  summary: {
    totalStudents: number;
    studentsOnTrack: number;
    studentsBehind: number;
  };
  departmentTotals: {
    er: { totalHours: number; totalShifts: number; average: number };
    icr: { totalHours: number; totalShifts: number; average: number };
    ccl: { totalHours: number; totalShifts: number; average: number };
    ems: { totalHours: number; totalShifts: number; average: number };
  };
  studentBreakdown: Array<{
    id: string;
    name: string;
    erHours: number;
    icrHours: number;
    cclHours: number;
    emsHours: number;
    totalHours: number;
    onTrack: boolean;
  }>;
  flaggedStudents: Array<{
    id: string;
    name: string;
    reason: string;
    details: string;
  }>;
}

export default function ClinicalHoursReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const reportRef = useRef<HTMLDivElement>(null);

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohort, setSelectedCohort] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState<ClinicalHoursData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchCohorts();
      // Set default date range (current semester - last 6 months)
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 6);
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

      const res = await fetch(`/api/reports/clinical-hours?${params}`);
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

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handleExportExcel = async () => {
    if (!reportData) return;

    // Create CSV content
    let csv = 'Clinical Hours Report\n';
    csv += `Cohort,${reportData.cohort.name}\n`;
    csv += `Date Range,${reportData.dateRange.start} to ${reportData.dateRange.end}\n`;
    csv += `Generated,${new Date().toLocaleString()}\n\n`;

    csv += 'Summary\n';
    csv += `Total Students,${reportData.summary.totalStudents}\n`;
    csv += `On Track,${reportData.summary.studentsOnTrack}\n`;
    csv += `Behind,${reportData.summary.studentsBehind}\n\n`;

    csv += 'Student Breakdown\n';
    csv += 'Name,ER Hours,ICR Hours,CCL Hours,EMS Hours,Total Hours,Status\n';
    reportData.studentBreakdown.forEach(student => {
      csv += `${student.name},${student.erHours},${student.icrHours},${student.cclHours},${student.emsHours},${student.totalHours},${student.onTrack ? 'On Track' : 'Behind'}\n`;
    });

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clinical-hours-${reportData.cohort.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
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
      {/* Header - Hidden when printing */}
      <div className="bg-white dark:bg-gray-800 shadow-sm print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">
              Lab Management
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management/reports" className="hover:text-blue-600 dark:hover:text-blue-400">
              Reports
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span>Clinical Hours</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
              <Clock className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clinical Hours Report</h1>
              <p className="text-gray-600 dark:text-gray-400">Hours by department and site. Track progress toward requirements.</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Parameters Form - Hidden when printing */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 print:hidden">
          <div className="p-4 border-b dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Report Parameters</h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cohort
                </label>
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End Date
                </label>
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
                className="flex items-center gap-2 px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4" />
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
            {/* Export Buttons - Hidden when printing */}
            <div className="flex justify-end gap-2 mb-4 print:hidden">
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export Excel
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                Export PDF
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
            </div>

            {/* Report Content */}
            <div ref={reportRef} className="bg-white dark:bg-gray-800 rounded-lg shadow print:shadow-none print:rounded-none">
              {/* Report Header */}
              <div className="p-6 border-b dark:border-gray-700 print:border-black">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      Clinical Hours Report
                    </h2>
                    <p className="text-lg text-gray-600 dark:text-gray-400 mt-1">
                      {reportData.cohort.name}
                    </p>
                  </div>
                  <div className="text-right text-sm text-gray-500 dark:text-gray-400">
                    <p>Date Range: {new Date(reportData.dateRange.start).toLocaleDateString()} - {new Date(reportData.dateRange.end).toLocaleDateString()}</p>
                    <p>Generated: {new Date().toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="p-6 border-b dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Summary</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
                      <Users className="w-4 h-4" />
                      Total Students
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                      {reportData.summary.totalStudents}
                    </p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      On Track
                    </div>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">
                      {reportData.summary.studentsOnTrack}
                    </p>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 text-sm">
                      <AlertTriangle className="w-4 h-4" />
                      Behind
                    </div>
                    <p className="text-2xl font-bold text-orange-700 dark:text-orange-300 mt-1">
                      {reportData.summary.studentsBehind}
                    </p>
                  </div>
                </div>
              </div>

              {/* Department Totals */}
              <div className="p-6 border-b dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-teal-500" />
                  Hours by Department
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                    <div className="text-red-600 dark:text-red-400 text-sm font-medium">ER</div>
                    <p className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1">
                      {reportData.departmentTotals.er.totalHours}h
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {reportData.departmentTotals.er.totalShifts} shifts ({reportData.departmentTotals.er.average.toFixed(1)} avg)
                    </p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                    <div className="text-blue-600 dark:text-blue-400 text-sm font-medium">ICR</div>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
                      {reportData.departmentTotals.icr.totalHours}h
                    </p>
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      {reportData.departmentTotals.icr.totalShifts} shifts ({reportData.departmentTotals.icr.average.toFixed(1)} avg)
                    </p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                    <div className="text-purple-600 dark:text-purple-400 text-sm font-medium">CCL</div>
                    <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1">
                      {reportData.departmentTotals.ccl.totalHours}h
                    </p>
                    <p className="text-sm text-purple-600 dark:text-purple-400">
                      {reportData.departmentTotals.ccl.totalShifts} shifts ({reportData.departmentTotals.ccl.average.toFixed(1)} avg)
                    </p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                    <div className="text-green-600 dark:text-green-400 text-sm font-medium">EMS</div>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">
                      {reportData.departmentTotals.ems.totalHours}h
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      {reportData.departmentTotals.ems.totalShifts} shifts ({reportData.departmentTotals.ems.average.toFixed(1)} avg)
                    </p>
                  </div>
                </div>
              </div>

              {/* Flagged Students */}
              {reportData.flaggedStudents.length > 0 && (
                <div className="p-6 border-b dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    Students Behind Schedule ({reportData.flaggedStudents.length})
                  </h3>
                  <div className="space-y-2">
                    {reportData.flaggedStudents.map((student) => (
                      <div
                        key={student.id}
                        className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{student.name}</p>
                          <p className="text-sm text-orange-700 dark:text-orange-400">{student.reason}</p>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{student.details}</p>
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
                        <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">ER</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">ICR</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">CCL</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">EMS</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Total</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                      {reportData.studentBreakdown.map((student) => (
                        <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                            {student.name}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                            {student.erHours}h
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                            {student.icrHours}h
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                            {student.cclHours}h
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                            {student.emsHours}h
                          </td>
                          <td className="px-4 py-3 text-center font-medium text-gray-900 dark:text-white">
                            {student.totalHours}h
                          </td>
                          <td className="px-4 py-3 text-center">
                            {student.onTrack ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-full">
                                <CheckCircle className="w-3 h-3" />
                                On Track
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs rounded-full">
                                <AlertTriangle className="w-3 h-3" />
                                Behind
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
            <Clock className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Report Generated</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Select a cohort and date range, then click "Generate Report" to view clinical hours data.
            </p>
          </div>
        )}
      </main>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
