'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef, Suspense } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  User,
  Download,
  Printer,
  FileSpreadsheet,
  Loader2,
  Calendar,
  TrendingUp,
  TrendingDown,
  Star,
  CheckCircle,
  XCircle,
  Clock,
  Award,
  AlertTriangle
} from 'lucide-react';

interface Cohort {
  id: string;
  cohort_number: number;
  program: { abbreviation: string };
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

interface StudentProgressData {
  student: {
    id: string;
    name: string;
    cohort: string;
    status: string;
  };
  dateRange: {
    start: string;
    end: string;
  };
  scenarioPerformance: {
    totalScenarios: number;
    averageScore: number;
    recentTrend: 'up' | 'down' | 'stable';
    byCategory: Array<{
      category: string;
      average: number;
      count: number;
    }>;
    recentScenarios: Array<{
      date: string;
      scenarioTitle: string;
      score: number;
      wasTeamLead: boolean;
    }>;
  };
  skillsProgress: {
    passed: number;
    attempted: number;
    total: number;
    passRate: number;
    skills: Array<{
      name: string;
      attempts: number;
      passed: boolean;
      lastAttemptDate: string;
    }>;
  };
  teamLeadHistory: {
    totalRotations: number;
    cohortAverage: number;
    rotations: Array<{
      date: string;
      scenario: string;
    }>;
  };
  attendance: {
    labsAttended: number;
    totalLabs: number;
    rate: number;
  };
  flaggedItems: Array<{
    type: string;
    message: string;
    date?: string;
  }>;
}

function StudentProgressReportContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportRef = useRef<HTMLDivElement>(null);

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedCohort, setSelectedCohort] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState<StudentProgressData | null>(null);
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

      // Check for studentId in URL params
      const studentId = searchParams.get('studentId');
      if (studentId) {
        setSelectedStudent(studentId);
      }
    }
  }, [session, searchParams]);

  useEffect(() => {
    if (selectedCohort) {
      fetchStudents(selectedCohort);
    } else {
      setStudents([]);
      setSelectedStudent('');
    }
  }, [selectedCohort]);

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

  const fetchStudents = async (cohortId: string) => {
    try {
      const res = await fetch(`/api/lab-management/students?cohortId=${cohortId}&status=active`);
      const data = await res.json();
      if (data.success) {
        setStudents(data.students || []);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const generateReport = async () => {
    if (!selectedStudent) {
      setError('Please select a student');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        studentId: selectedStudent,
        startDate,
        endDate,
      });

      const res = await fetch(`/api/reports/student-progress?${params}`);
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
    let csv = 'Student Progress Report\n';
    csv += `Student,${reportData.student.name}\n`;
    csv += `Cohort,${reportData.student.cohort}\n`;
    csv += `Date Range,${reportData.dateRange.start} to ${reportData.dateRange.end}\n`;
    csv += `Generated,${new Date().toLocaleString()}\n\n`;

    csv += 'Scenario Performance\n';
    csv += `Total Scenarios,${reportData.scenarioPerformance.totalScenarios}\n`;
    csv += `Average Score,${reportData.scenarioPerformance.averageScore.toFixed(1)}\n`;
    csv += `Trend,${reportData.scenarioPerformance.recentTrend}\n\n`;

    csv += 'Recent Scenarios\n';
    csv += 'Date,Scenario,Score,Team Lead\n';
    reportData.scenarioPerformance.recentScenarios.forEach(s => {
      csv += `${s.date},${s.scenarioTitle},${s.score},${s.wasTeamLead ? 'Yes' : 'No'}\n`;
    });
    csv += '\n';

    csv += 'Skills Progress\n';
    csv += 'Skill,Attempts,Passed,Last Attempt\n';
    reportData.skillsProgress.skills.forEach(skill => {
      csv += `${skill.name},${skill.attempts},${skill.passed ? 'Yes' : 'No'},${skill.lastAttemptDate}\n`;
    });
    csv += '\n';

    csv += 'Team Lead History\n';
    csv += `Total Rotations,${reportData.teamLeadHistory.totalRotations}\n`;
    csv += `Cohort Average,${reportData.teamLeadHistory.cohortAverage.toFixed(1)}\n`;

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `student-progress-${reportData.student.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
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
            <span>Student Progress</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Student Progress Report</h1>
              <p className="text-gray-600 dark:text-gray-400">Individual student performance: grades, skills, team lead history</p>
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
            <div className="grid md:grid-cols-4 gap-4">
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
                  Student
                </label>
                <select
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  disabled={!selectedCohort}
                >
                  <option value="">Select Student</option>
                  {students.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.last_name}, {student.first_name}
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
                disabled={generating || !selectedStudent}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <User className="w-4 h-4" />
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
                      Student Progress Report
                    </h2>
                    <p className="text-xl text-gray-700 dark:text-gray-300 mt-1">
                      {reportData.student.name}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400">
                      {reportData.student.cohort}
                    </p>
                  </div>
                  <div className="text-right text-sm text-gray-500 dark:text-gray-400">
                    <p>Date Range: {new Date(reportData.dateRange.start).toLocaleDateString()} - {new Date(reportData.dateRange.end).toLocaleDateString()}</p>
                    <p>Generated: {new Date().toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Scenario Performance */}
              <div className="p-6 border-b dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-blue-500" />
                  Scenario Performance
                </h3>
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                    <div className="text-blue-600 dark:text-blue-400 text-sm">Total Scenarios</div>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
                      {reportData.scenarioPerformance.totalScenarios}
                    </p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                    <div className="text-green-600 dark:text-green-400 text-sm">Average Score</div>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">
                      {reportData.scenarioPerformance.averageScore.toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="text-gray-600 dark:text-gray-400 text-sm">Recent Trend</div>
                    <div className="flex items-center gap-2 mt-1">
                      {reportData.scenarioPerformance.recentTrend === 'up' && (
                        <>
                          <TrendingUp className="w-6 h-6 text-green-600" />
                          <span className="text-xl font-bold text-green-600">Improving</span>
                        </>
                      )}
                      {reportData.scenarioPerformance.recentTrend === 'down' && (
                        <>
                          <TrendingDown className="w-6 h-6 text-red-600" />
                          <span className="text-xl font-bold text-red-600">Declining</span>
                        </>
                      )}
                      {reportData.scenarioPerformance.recentTrend === 'stable' && (
                        <span className="text-xl font-bold text-gray-600 dark:text-gray-400">Stable</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Recent Scenarios Table */}
                {reportData.scenarioPerformance.recentScenarios.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recent Scenarios</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Date</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Scenario</th>
                            <th className="px-4 py-2 text-center font-medium text-gray-600 dark:text-gray-400">Score</th>
                            <th className="px-4 py-2 text-center font-medium text-gray-600 dark:text-gray-400">Team Lead</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-gray-700">
                          {reportData.scenarioPerformance.recentScenarios.map((scenario, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                {new Date(scenario.date).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-2 text-gray-900 dark:text-white">
                                {scenario.scenarioTitle}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  scenario.score >= 80 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                                  scenario.score >= 70 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                                  'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                }`}>
                                  {scenario.score}%
                                </span>
                              </td>
                              <td className="px-4 py-2 text-center">
                                {scenario.wasTeamLead ? (
                                  <Star className="w-4 h-4 text-yellow-500 mx-auto" />
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Skills Progress */}
              <div className="p-6 border-b dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Skills Progress
                </h3>
                <div className="grid md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="text-gray-600 dark:text-gray-400 text-sm">Passed</div>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                      {reportData.skillsProgress.passed}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="text-gray-600 dark:text-gray-400 text-sm">Attempted</div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                      {reportData.skillsProgress.attempted}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="text-gray-600 dark:text-gray-400 text-sm">Pass Rate</div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                      {reportData.skillsProgress.passRate.toFixed(0)}%
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="text-gray-600 dark:text-gray-400 text-sm">Total Required</div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                      {reportData.skillsProgress.total}
                    </p>
                  </div>
                </div>

                {/* Skills List */}
                {reportData.skillsProgress.skills.length > 0 && (
                  <div className="grid md:grid-cols-2 gap-2">
                    {reportData.skillsProgress.skills.map((skill, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          skill.passed
                            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                            : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {skill.passed ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-gray-400" />
                          )}
                          <span className="text-gray-900 dark:text-white">{skill.name}</span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {skill.attempts} attempt{skill.attempts !== 1 ? 's' : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Team Lead History */}
              <div className="p-6 border-b dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  Team Lead History
                </h3>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                    <div className="text-yellow-600 dark:text-yellow-400 text-sm">Total Rotations</div>
                    <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300 mt-1">
                      {reportData.teamLeadHistory.totalRotations}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="text-gray-600 dark:text-gray-400 text-sm">Cohort Average</div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                      {reportData.teamLeadHistory.cohortAverage.toFixed(1)}
                    </p>
                  </div>
                </div>

                {reportData.teamLeadHistory.rotations.length > 0 && (
                  <div className="space-y-2">
                    {reportData.teamLeadHistory.rotations.map((rotation, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(rotation.date).toLocaleDateString()}
                        </span>
                        <span className="text-sm text-gray-900 dark:text-white">
                          {rotation.scenario}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Attendance */}
              <div className="p-6 border-b dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-purple-500" />
                  Attendance
                </h3>
                <div className="flex items-center gap-8">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Labs Attended</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {reportData.attendance.labsAttended} / {reportData.attendance.totalLabs}
                    </p>
                  </div>
                  <div className="flex-1 max-w-md">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                      <div
                        className={`h-4 rounded-full transition-all ${
                          reportData.attendance.rate >= 90 ? 'bg-green-600' :
                          reportData.attendance.rate >= 80 ? 'bg-yellow-600' :
                          'bg-red-600'
                        }`}
                        style={{ width: `${reportData.attendance.rate}%` }}
                      />
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {reportData.attendance.rate.toFixed(0)}% attendance rate
                    </p>
                  </div>
                </div>
              </div>

              {/* Flagged Items */}
              {reportData.flaggedItems.length > 0 && (
                <div className="p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    Items Requiring Attention ({reportData.flaggedItems.length})
                  </h3>
                  <div className="space-y-2">
                    {reportData.flaggedItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-orange-800 dark:text-orange-300">{item.type}</p>
                          <p className="text-sm text-orange-700 dark:text-orange-400">{item.message}</p>
                        </div>
                        {item.date && (
                          <p className="text-sm text-orange-600 dark:text-orange-400">
                            {new Date(item.date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Empty State */}
        {!reportData && !generating && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center print:hidden">
            <User className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Report Generated</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Select a cohort and student, then click "Generate Report" to view progress data.
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

export default function StudentProgressReportPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <StudentProgressReportContent />
    </Suspense>
  );
}
