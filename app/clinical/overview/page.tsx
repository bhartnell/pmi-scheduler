'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  LayoutDashboard,
  Users,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Clock,
  FileCheck,
  BookOpen,
  ClipboardList,
  TrendingUp,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { canAccessClinical, type Role } from '@/lib/permissions';

interface CohortOption {
  id: string;
  cohort_number: number;
  program: { abbreviation: string };
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  complianceCount: number;
  complianceTotal: number;
  compliancePercent: number;
  mceCount: number;
  mceTotal: number;
  mcePercent: number;
  clinicalHours: number;
  internshipStatus: string;
  internshipPhase: string | null;
  internshipId: string | null;
  hasInternship: boolean;
}

interface Alert {
  type: string;
  student: { id: string; first_name: string; last_name: string };
  message: string;
  details: string;
  link: string;
  internship?: any;
}

interface DashboardData {
  stats: {
    totalStudents: number;
    complianceComplete: number;
    compliancePercent: number;
    internshipsActive: number;
    internshipsTotal: number;
    clinicalHoursTotal: number;
    mceComplete: number;
    mcePercent: number;
  };
  alerts: {
    critical: Alert[];
    warning: Alert[];
    info: Alert[];
  };
  students: Student[];
}

const STATUS_COLORS: Record<string, string> = {
  none: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  not_started: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  on_track: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  at_risk: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  extended: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const PHASE_LABELS: Record<string, string> = {
  pre_internship: 'Pre',
  phase_1_mentorship: 'P1',
  phase_2_evaluation: 'P2',
  completed: 'Done',
};

export default function ClinicalOverviewPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [selectedCohort, setSelectedCohort] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchInitialData();
    }
  }, [session]);

  useEffect(() => {
    if (selectedCohort) {
      fetchDashboardData();
    }
  }, [selectedCohort]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const userRes = await fetch('/api/instructor/me');
      const userData = await userRes.json();
      if (userData.success && userData.user) {
        setUserRole(userData.user.role);
        if (!canAccessClinical(userData.user.role)) {
          router.push('/');
          return;
        }
      }

      const cohortsRes = await fetch('/api/lab-management/cohorts?activeOnly=true');
      const cohortsData = await cohortsRes.json();
      if (cohortsData.success) {
        setCohorts(cohortsData.cohorts || []);
        // Default to Group 12 if available, otherwise first cohort
        const group12 = cohortsData.cohorts?.find((c: CohortOption) => c.id === 'b2fc8c02-728a-4743-861d-e3f2ab475fb8');
        if (group12) {
          setSelectedCohort(group12.id);
        } else if (cohortsData.cohorts?.length > 0) {
          setSelectedCohort(cohortsData.cohorts[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const fetchDashboardData = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const res = await fetch(`/api/clinical/overview?cohortId=${selectedCohort}`);
      const result = await res.json();
      if (result.success) {
        setData(result);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
    setRefreshing(false);
  };

  const handleRefresh = () => {
    fetchDashboardData(true);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!session) return null;

  const stats = data?.stats;
  const alerts = data?.alerts;
  const students = data?.students || [];

  const totalAlerts = (alerts?.critical.length || 0) + (alerts?.warning.length || 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/clinical" className="hover:text-teal-600 dark:hover:text-teal-400">Clinical</Link>
            <ChevronRight className="w-4 h-4" />
            <span>Overview</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                <LayoutDashboard className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clinical Overview</h1>
                <p className="text-gray-600 dark:text-gray-400">Dashboard for tracking student clinical progress</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedCohort}
                onChange={(e) => setSelectedCohort(e.target.value)}
                className="px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
              >
                <option value="">Select Cohort</option>
                {cohorts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.program?.abbreviation || 'PMD'} Group {c.cohort_number}
                  </option>
                ))}
              </select>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 text-gray-500 hover:text-teal-600 dark:text-gray-400 dark:hover:text-teal-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Refresh data"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalStudents}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Students</div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <FileCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.compliancePercent}%</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Compliance</div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <ClipboardList className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.internshipsActive}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Active Intern</div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                  <Clock className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.clinicalHoursTotal}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Total Hours</div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                  <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.mcePercent}%</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">mCE Done</div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${totalAlerts > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                  {totalAlerts > 0 ? (
                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  )}
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalAlerts}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Alerts</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Alerts Section */}
        {alerts && (alerts.critical.length > 0 || alerts.warning.length > 0) && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <h2 className="font-semibold text-red-900 dark:text-red-300">Action Required</h2>
                <span className="ml-auto text-sm text-red-700 dark:text-red-400">
                  {alerts.critical.length + alerts.warning.length} items need attention
                </span>
              </div>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-80 overflow-y-auto">
              {/* Critical Alerts */}
              {alerts.critical.map((alert, idx) => (
                <div key={`critical-${idx}`} className="flex items-center justify-between p-3 bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {alert.student.first_name} {alert.student.last_name}
                      </div>
                      <div className="text-sm text-red-600 dark:text-red-400">{alert.message}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{alert.details}</div>
                    </div>
                  </div>
                  <Link
                    href={alert.link}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              ))}

              {/* Warning Alerts */}
              {alerts.warning.map((alert, idx) => (
                <div key={`warning-${idx}`} className="flex items-center justify-between p-3 bg-yellow-50/50 dark:bg-yellow-900/10 hover:bg-yellow-50 dark:hover:bg-yellow-900/20">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {alert.student.first_name} {alert.student.last_name}
                      </div>
                      <div className="text-sm text-yellow-600 dark:text-yellow-400">{alert.message}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{alert.details}</div>
                    </div>
                  </div>
                  <Link
                    href={alert.link}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded"
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/clinical/compliance"
            className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 hover:shadow-lg transition-shadow group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg group-hover:bg-green-200 dark:group-hover:bg-green-900/50">
                <FileCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Compliance Docs</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{stats?.complianceComplete || 0}/{stats?.totalStudents || 0} complete</div>
              </div>
            </div>
          </Link>

          <Link
            href="/clinical/internships"
            className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 hover:shadow-lg transition-shadow group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50">
                <ClipboardList className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Internships</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{stats?.internshipsActive || 0} active</div>
              </div>
            </div>
          </Link>

          <Link
            href="/clinical/hours"
            className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 hover:shadow-lg transition-shadow group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg group-hover:bg-cyan-200 dark:group-hover:bg-cyan-900/50">
                <Clock className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Clinical Hours</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{stats?.clinicalHoursTotal || 0} total hours</div>
              </div>
            </div>
          </Link>

          <Link
            href="/clinical/mce"
            className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 hover:shadow-lg transition-shadow group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/50">
                <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <div className="font-medium text-gray-900 dark:text-white">mCE Modules</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{stats?.mceComplete || 0}/{stats?.totalStudents || 0} complete</div>
              </div>
            </div>
          </Link>
        </div>

        {/* Student Progress Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Student Progress</h2>
              <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
                {students.length} students
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Student</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Compliance</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Internship</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Hours</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">mCE</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {students.map(student => (
                  <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {student.first_name} {student.last_name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${student.compliancePercent === 100 ? 'bg-green-500' : student.compliancePercent >= 75 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${student.compliancePercent}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-8">{student.compliancePercent}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {student.hasInternship ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[student.internshipStatus] || STATUS_COLORS.none}`}>
                          {PHASE_LABELS[student.internshipPhase || ''] || student.internshipStatus}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm ${student.clinicalHours >= 24 ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        {student.clinicalHours}h
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-12 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${student.mcePercent === 100 ? 'bg-purple-500' : student.mcePercent >= 75 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${student.mcePercent}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-8">{student.mcePercent}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/lab-management/students/${student.id}`}
                        className="text-sm text-teal-600 dark:text-teal-400 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info Alerts (collapsible) */}
        {alerts && alerts.info.length > 0 && (
          <details className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
            <summary className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <div className="inline-flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-500" />
                <span className="font-semibold text-gray-900 dark:text-white">Additional Notes</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">({alerts.info.length} items)</span>
              </div>
            </summary>
            <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-60 overflow-y-auto">
              {alerts.info.map((alert, idx) => (
                <div key={`info-${idx}`} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <div className="flex items-center gap-3">
                    <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <div>
                      <span className="text-sm text-gray-900 dark:text-white">
                        {alert.student.first_name} {alert.student.last_name}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">— {alert.message}</span>
                    </div>
                  </div>
                  <Link
                    href={alert.link}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Fix
                  </Link>
                </div>
              ))}
            </div>
          </details>
        )}
      </main>
    </div>
  );
}
