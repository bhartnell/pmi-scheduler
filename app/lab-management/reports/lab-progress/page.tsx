'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  ClipboardList,
  Download,
  Printer,
  FileSpreadsheet,
  Loader2,
  Users,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Star,
  CheckCircle
} from 'lucide-react';

interface Cohort {
  id: string;
  cohort_number: number;
  program: { abbreviation: string };
}

interface LabProgressData {
  cohort: {
    id: string;
    name: string;
    programAbbreviation: string;
    cohortNumber: number;
  };
  dateRange: {
    start: string;
    end: string;
  };
  summary: {
    totalLabDays: number;
    totalStations: number;
    scenarioStations: number;
    skillStations: number;
    totalStudents: number;
  };
  scenarioScores: {
    averageAssessment: number;
    averageTreatment: number;
    averageCommunication: number;
    averageOverall: number;
  };
  skillsProgress: {
    completed: number;
    total: number;
    completionRate: number;
  };
  teamLeadStats: {
    totalRotations: number;
    averagePerStudent: number;
    studentsWithZero: number;
  };
  flaggedStudents: Array<{
    id: string;
    name: string;
    reason: string;
    details: string;
  }>;
  studentBreakdown: Array<{
    id: string;
    name: string;
    scenarioCount: number;
    averageScore: number;
    skillsCompleted: number;
    teamLeadCount: number;
    attendance: number;
  }>;
}

export default function LabProgressReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const reportRef = useRef<HTMLDivElement>(null);

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohort, setSelectedCohort] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [includeScenarios, setIncludeScenarios] = useState(true);
  const [includeSkills, setIncludeSkills] = useState(true);
  const [includeAttendance, setIncludeAttendance] = useState(true);

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState<LabProgressData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchCohorts();
      // Set default date range (current semester - last 3 months)
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
        includeScenarios: String(includeScenarios),
        includeSkills: String(includeSkills),
        includeAttendance: String(includeAttendance),
      });

      const res = await fetch(`/api/reports/lab-progress?${params}`);
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
    // For now, use browser print as PDF
    window.print();
  };

  const handleExportExcel = async () => {
    if (!reportData) return;

    // Create CSV content
    let csv = 'Lab Progress Report\n';
    csv += `Cohort,${reportData.cohort.name}\n`;
    csv += `Date Range,${reportData.dateRange.start} to ${reportData.dateRange.end}\n`;
    csv += `Generated,${new Date().toLocaleString()}\n\n`;

    csv += 'Summary\n';
    csv += `Total Lab Days,${reportData.summary.totalLabDays}\n`;
    csv += `Total Stations,${reportData.summary.totalStations}\n`;
    csv += `Scenario Stations,${reportData.summary.scenarioStations}\n`;
    csv += `Skill Stations,${reportData.summary.skillStations}\n\n`;

    csv += 'Scenario Scores\n';
    csv += `Avg Assessment,${reportData.scenarioScores.averageAssessment.toFixed(1)}\n`;
    csv += `Avg Treatment,${reportData.scenarioScores.averageTreatment.toFixed(1)}\n`;
    csv += `Avg Communication,${reportData.scenarioScores.averageCommunication.toFixed(1)}\n`;
    csv += `Avg Overall,${reportData.scenarioScores.averageOverall.toFixed(1)}\n\n`;

    csv += 'Student Breakdown\n';
    csv += 'Name,Scenarios,Avg Score,Skills Completed,Team Lead Count,Attendance\n';
    reportData.studentBreakdown.forEach(student => {
      csv += `${student.name},${student.scenarioCount},${student.averageScore.toFixed(1)},${student.skillsCompleted},${student.teamLeadCount},${student.attendance}%\n`;
    });

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lab-progress-${reportData.cohort.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const selectedCohortData = cohorts.find(c => c.id === selectedCohort);

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
            <span>Lab Progress</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <ClipboardList className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lab Progress Report</h1>
              <p className="text-gray-600 dark:text-gray-400">Cohort progress: scenarios, skills, and attendance</p>
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

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={includeScenarios}
                  onChange={(e) => setIncludeScenarios(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                Include scenario grades
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={includeSkills}
                  onChange={(e) => setIncludeSkills(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                Include skill grades
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={includeAttendance}
                  onChange={(e) => setIncludeAttendance(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                Include attendance
              </label>
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
                className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <ClipboardList className="w-4 h-4" />
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
                      Lab Progress Report
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
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
                      <Calendar className="w-4 h-4" />
                      Lab Days
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                      {reportData.summary.totalLabDays}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
                      <ClipboardList className="w-4 h-4" />
                      Total Stations
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                      {reportData.summary.totalStations}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="text-gray-600 dark:text-gray-400 text-sm">Scenarios</div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                      {reportData.summary.scenarioStations}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="text-gray-600 dark:text-gray-400 text-sm">Skills</div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                      {reportData.summary.skillStations}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
                      <Users className="w-4 h-4" />
                      Students
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                      {reportData.summary.totalStudents}
                    </p>
                  </div>
                </div>
              </div>

              {/* Scenario Scores */}
              {includeScenarios && (
                <div className="p-6 border-b dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Average Scenario Scores</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                      <div className="text-blue-600 dark:text-blue-400 text-sm">Assessment</div>
                      <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
                        {reportData.scenarioScores.averageAssessment.toFixed(1)}
                      </p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                      <div className="text-green-600 dark:text-green-400 text-sm">Treatment</div>
                      <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">
                        {reportData.scenarioScores.averageTreatment.toFixed(1)}
                      </p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                      <div className="text-purple-600 dark:text-purple-400 text-sm">Communication</div>
                      <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1">
                        {reportData.scenarioScores.averageCommunication.toFixed(1)}
                      </p>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                      <div className="text-orange-600 dark:text-orange-400 text-sm">Overall Average</div>
                      <p className="text-2xl font-bold text-orange-700 dark:text-orange-300 mt-1">
                        {reportData.scenarioScores.averageOverall.toFixed(1)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Skills Progress */}
              {includeSkills && (
                <div className="p-6 border-b dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Skills Progress</h3>
                  <div className="flex items-center gap-8">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Completed Skills</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {reportData.skillsProgress.completed} / {reportData.skillsProgress.total}
                      </p>
                    </div>
                    <div className="flex-1 max-w-md">
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                        <div
                          className="bg-green-600 h-4 rounded-full transition-all"
                          style={{ width: `${reportData.skillsProgress.completionRate}%` }}
                        />
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {reportData.skillsProgress.completionRate.toFixed(1)}% completion rate
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Team Lead Stats */}
              <div className="p-6 border-b dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Team Lead Rotations</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
                      <Star className="w-4 h-4" />
                      Total Rotations
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                      {reportData.teamLeadStats.totalRotations}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="text-gray-600 dark:text-gray-400 text-sm">Avg per Student</div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                      {reportData.teamLeadStats.averagePerStudent.toFixed(1)}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="text-gray-600 dark:text-gray-400 text-sm">Students with 0</div>
                    <p className={`text-2xl font-bold mt-1 ${reportData.teamLeadStats.studentsWithZero > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                      {reportData.teamLeadStats.studentsWithZero}
                    </p>
                  </div>
                </div>
              </div>

              {/* Flagged Students */}
              {reportData.flaggedStudents.length > 0 && (
                <div className="p-6 border-b dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    Students Flagged for Review ({reportData.flaggedStudents.length})
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
                        {includeScenarios && (
                          <>
                            <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Scenarios</th>
                            <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Avg Score</th>
                          </>
                        )}
                        {includeSkills && (
                          <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Skills</th>
                        )}
                        <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Team Lead</th>
                        {includeAttendance && (
                          <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Attendance</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                      {reportData.studentBreakdown.map((student) => (
                        <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                            {student.name}
                          </td>
                          {includeScenarios && (
                            <>
                              <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                                {student.scenarioCount}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  student.averageScore >= 80 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                                  student.averageScore >= 70 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                                  'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                }`}>
                                  {student.averageScore.toFixed(1)}
                                </span>
                              </td>
                            </>
                          )}
                          {includeSkills && (
                            <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                              {student.skillsCompleted}
                            </td>
                          )}
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 ${
                              student.teamLeadCount === 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-600 dark:text-gray-400'
                            }`}>
                              <Star className="w-3 h-3" />
                              {student.teamLeadCount}
                            </span>
                          </td>
                          {includeAttendance && (
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                student.attendance >= 90 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                                student.attendance >= 80 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                                'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                              }`}>
                                {student.attendance}%
                              </span>
                            </td>
                          )}
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
            <ClipboardList className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Report Generated</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Select a cohort and date range, then click "Generate Report" to view lab progress data.
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
