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
  RefreshCw,
  Search,
  Filter
} from 'lucide-react';
import { canAccessClinical, type Role } from '@/lib/permissions';

interface CohortOption {
  id: string;
  cohort_number: number;
  program: { abbreviation: string };
}

interface StudentOverview {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  cohort_id: string | null;
  program: string;
  cohort_number: number | null;
  // Derived status
  clinicalStatus: 'active_internship' | 'active_clinicals' | 'preparing' | 'completed' | 'not_started';
  // Internship data (PM only)
  internshipId: string | null;
  internshipStatus: string | null;
  internshipPhase: string | null;
  internshipStartDate: string | null;
  clearedForNremt: boolean;
  nextDueDate: string | null;
  nextDueType: string | null;
  // EMT/AEMT tracking
  emtTrackingComplete: boolean;
  aemtTrackingComplete: boolean;
}

interface Alert {
  type: string;
  student: { id: string; first_name: string; last_name: string };
  message: string;
  details: string;
  link: string;
}

const STATUS_LABELS: Record<string, string> = {
  active_internship: 'Active Internship',
  active_clinicals: 'Active Clinicals',
  preparing: 'Preparing',
  completed: 'Completed',
  not_started: 'Not Started',
};

const STATUS_COLORS: Record<string, string> = {
  active_internship: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  active_clinicals: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  preparing: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  not_started: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
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
  const [students, setStudents] = useState<StudentOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userRole, setUserRole] = useState<Role | null>(null);

  // Filters
  const [filterProgram, setFilterProgram] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCohort, setFilterCohort] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Alerts
  const [alerts, setAlerts] = useState<{ critical: Alert[]; warning: Alert[]; info: Alert[] }>({
    critical: [],
    warning: [],
    info: [],
  });

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

      // Fetch cohorts
      const cohortsRes = await fetch('/api/lab-management/cohorts?activeOnly=true');
      const cohortsData = await cohortsRes.json();
      if (cohortsData.success) {
        setCohorts(cohortsData.cohorts || []);
      }

      // Fetch all students overview data
      await fetchOverviewData();
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const fetchOverviewData = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const res = await fetch('/api/clinical/overview-all');
      const result = await res.json();
      if (result.success) {
        setStudents(result.students || []);
        setAlerts(result.alerts || { critical: [], warning: [], info: [] });
      }
    } catch (error) {
      console.error('Error fetching overview data:', error);
    }
    setRefreshing(false);
  };

  const handleRefresh = () => {
    fetchOverviewData(true);
  };

  // Filter students
  const filteredStudents = students.filter(student => {
    // Program filter
    if (filterProgram !== 'all' && student.program !== filterProgram) {
      return false;
    }

    // Status filter
    if (filterStatus !== 'all' && student.clinicalStatus !== filterStatus) {
      return false;
    }

    // Cohort filter
    if (filterCohort !== 'all' && student.cohort_id !== filterCohort) {
      return false;
    }

    // Search
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      const name = `${student.first_name} ${student.last_name}`.toLowerCase();
      if (!name.includes(search)) {
        return false;
      }
    }

    return true;
  });

  // Get unique programs from cohorts
  const programs = [...new Set(cohorts.map(c => c.program?.abbreviation).filter(Boolean))];

  // Calculate stats
  const stats = {
    total: filteredStudents.length,
    activeInternship: filteredStudents.filter(s => s.clinicalStatus === 'active_internship').length,
    activeClinicals: filteredStudents.filter(s => s.clinicalStatus === 'active_clinicals').length,
    preparing: filteredStudents.filter(s => s.clinicalStatus === 'preparing').length,
    completed: filteredStudents.filter(s => s.clinicalStatus === 'completed').length,
  };

  // Filter alerts based on current filters
  const filteredAlerts = {
    critical: alerts.critical.filter(a => {
      const student = students.find(s => s.id === a.student.id);
      if (!student) return false;
      if (filterProgram !== 'all' && student.program !== filterProgram) return false;
      if (filterCohort !== 'all' && student.cohort_id !== filterCohort) return false;
      return true;
    }),
    warning: alerts.warning.filter(a => {
      const student = students.find(s => s.id === a.student.id);
      if (!student) return false;
      if (filterProgram !== 'all' && student.program !== filterProgram) return false;
      if (filterCohort !== 'all' && student.cohort_id !== filterCohort) return false;
      return true;
    }),
    info: alerts.info,
  };

  const totalAlerts = filteredAlerts.critical.length + filteredAlerts.warning.length;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!session) return null;

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
                <p className="text-gray-600 dark:text-gray-400">All students across all programs</p>
              </div>
            </div>
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

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
              />
            </div>

            {/* Program Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filterProgram}
                onChange={(e) => setFilterProgram(e.target.value)}
                className="px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
              >
                <option value="all">All Programs</option>
                {programs.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
            >
              <option value="all">All Statuses</option>
              <option value="active_internship">Active Internship</option>
              <option value="active_clinicals">Active Clinicals</option>
              <option value="preparing">Preparing</option>
              <option value="completed">Completed</option>
              <option value="not_started">Not Started</option>
            </select>

            {/* Cohort Filter */}
            <select
              value={filterCohort}
              onChange={(e) => setFilterCohort(e.target.value)}
              className="px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
            >
              <option value="all">All Cohorts</option>
              {cohorts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.program?.abbreviation} Group {c.cohort_number}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Total Students</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <ClipboardList className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.activeInternship}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Active Internship</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.activeClinicals}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Active Clinicals</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <FileCheck className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.preparing}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Preparing</div>
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

        {/* Alerts Section */}
        {(filteredAlerts.critical.length > 0 || filteredAlerts.warning.length > 0) && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <h2 className="font-semibold text-red-900 dark:text-red-300">Action Required</h2>
                <span className="ml-auto text-sm text-red-700 dark:text-red-400">
                  {filteredAlerts.critical.length + filteredAlerts.warning.length} items need attention
                </span>
              </div>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-60 overflow-y-auto">
              {filteredAlerts.critical.map((alert, idx) => (
                <div key={`critical-${idx}`} className="flex items-center justify-between p-3 bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {alert.student.first_name} {alert.student.last_name}
                      </div>
                      <div className="text-sm text-red-600 dark:text-red-400">{alert.message}</div>
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
              {filteredAlerts.warning.map((alert, idx) => (
                <div key={`warning-${idx}`} className="flex items-center justify-between p-3 bg-yellow-50/50 dark:bg-yellow-900/10 hover:bg-yellow-50 dark:hover:bg-yellow-900/20">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {alert.student.first_name} {alert.student.last_name}
                      </div>
                      <div className="text-sm text-yellow-600 dark:text-yellow-400">{alert.message}</div>
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

        {/* Student Progress Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">All Students</h2>
              <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
                {filteredStudents.length} students
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Program</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cohort</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Phase</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Next Due</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No students match your filters
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map(student => (
                    <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {student.first_name} {student.last_name}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
                          {student.program}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-sm">
                        {student.cohort_number ? `Group ${student.cohort_number}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[student.clinicalStatus]}`}>
                          {STATUS_LABELS[student.clinicalStatus]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {student.internshipPhase ? (
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {PHASE_LABELS[student.internshipPhase] || student.internshipPhase}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {student.nextDueDate ? (
                          <div className="text-sm">
                            <div className="text-gray-900 dark:text-white">{formatDate(student.nextDueDate)}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{student.nextDueType}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {student.internshipId ? (
                          <Link
                            href={`/clinical/internships/${student.internshipId}`}
                            className="text-sm text-teal-600 dark:text-teal-400 hover:underline"
                          >
                            View
                          </Link>
                        ) : (
                          <Link
                            href={`/lab-management/students/${student.id}`}
                            className="text-sm text-gray-500 dark:text-gray-400 hover:underline"
                          >
                            Profile
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
