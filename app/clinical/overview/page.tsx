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
  CheckCircle2,
  Clock,
  FileCheck,
  ClipboardList,
  ExternalLink,
  RefreshCw,
  Stethoscope,
  Ambulance,
  GraduationCap
} from 'lucide-react';
import { canAccessClinical, type Role } from '@/lib/permissions';

interface StudentOverview {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  cohort_id: string | null;
  program: string;
  cohort_number: number | null;
  semester: string | null;
  clinicalStatus: 'active_internship' | 'active_clinicals' | 'preparing' | 'completed' | 'not_started';
  internshipId: string | null;
  internshipStatus: string | null;
  internshipPhase: string | null;
  clearedForNremt: boolean;
  nextDueDate: string | null;
  nextDueType: string | null;
  emtTrackingComplete: boolean;
  aemtTrackingComplete: boolean;
}

interface Alert {
  type: string;
  student: { id: string; first_name: string; last_name: string };
  message: string;
  details: string;
  link: string;
  program?: string;
}

// PM Semester definitions
const PM_SEMESTER_CONFIG: Record<string, { label: string; description: string; color: string; bgColor: string; trackerLink: string }> = {
  'S4': { label: 'S4 - Internship', description: 'Field internship phase', color: 'text-purple-700 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/30', trackerLink: '/clinical/internships' },
  'S3': { label: 'S3 - Clinicals', description: 'Hospital clinical rotations', color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30', trackerLink: '/clinical/hours' },
  'S2': { label: 'S2 - Compliance', description: 'Pre-clinical compliance docs', color: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30', trackerLink: '/clinical/compliance' },
  'S1': { label: 'S1 - Didactic', description: 'Classroom phase', color: 'text-gray-700 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-700', trackerLink: '/lab-management' },
};

export default function ClinicalOverviewPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [students, setStudents] = useState<StudentOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userRole, setUserRole] = useState<Role | null>(null);
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

  // Group students by program
  const emtStudents = students.filter(s => s.program === 'EMT');
  const aemtStudents = students.filter(s => s.program === 'AEMT');
  const pmStudents = students.filter(s => s.program === 'PM' || s.program === 'PMD');

  // Group PM students by semester
  const pmBySemester = pmStudents.reduce((acc, student) => {
    const semester = student.semester || 'Unassigned';
    if (!acc[semester]) acc[semester] = [];
    acc[semester].push(student);
    return acc;
  }, {} as Record<string, StudentOverview[]>);

  // Calculate stats for each program
  const emtStats = {
    total: emtStudents.length,
    active: emtStudents.filter(s => s.clinicalStatus === 'active_clinicals').length,
    completed: emtStudents.filter(s => s.emtTrackingComplete).length,
    preparing: emtStudents.filter(s => s.clinicalStatus === 'preparing').length,
  };

  const aemtStats = {
    total: aemtStudents.length,
    active: aemtStudents.filter(s => s.clinicalStatus === 'active_clinicals').length,
    completed: aemtStudents.filter(s => s.aemtTrackingComplete).length,
    preparing: aemtStudents.filter(s => s.clinicalStatus === 'preparing').length,
  };

  // Calculate PM stats by semester
  const getPmSemesterStats = (semester: string) => {
    const semesterStudents = pmBySemester[semester] || [];
    return {
      total: semesterStudents.length,
      active: semesterStudents.filter(s => s.clinicalStatus === 'active_internship' || s.clinicalStatus === 'active_clinicals').length,
      completed: semesterStudents.filter(s => s.clinicalStatus === 'completed' || s.clearedForNremt).length,
      preparing: semesterStudents.filter(s => s.clinicalStatus === 'preparing' || s.clinicalStatus === 'not_started').length,
    };
  };

  // Filter alerts by program
  const getAlertsForProgram = (program: string) => {
    return {
      critical: alerts.critical.filter(a => {
        const student = students.find(s => s.id === a.student.id);
        return student?.program === program || student?.program === 'PMD';
      }),
      warning: alerts.warning.filter(a => {
        const student = students.find(s => s.id === a.student.id);
        return student?.program === program || student?.program === 'PMD';
      }),
    };
  };

  const totalAlerts = alerts.critical.length + alerts.warning.length;

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!session) return null;

  // Program Section Component
  const ProgramSection = ({
    title,
    icon: Icon,
    iconColor,
    bgColor,
    stats,
    trackerLink,
    trackerLabel,
    alerts: programAlerts,
  }: {
    title: string;
    icon: any;
    iconColor: string;
    bgColor: string;
    stats: { total: number; active: number; completed: number; preparing: number };
    trackerLink: string;
    trackerLabel: string;
    alerts: { critical: Alert[]; warning: Alert[] };
  }) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
      <div className={`px-4 py-3 border-b border-gray-200 dark:border-gray-700 ${bgColor}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon className={`w-5 h-5 ${iconColor}`} />
            <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {stats.total} students
            </span>
          </div>
          <Link
            href={trackerLink}
            className={`text-sm font-medium ${iconColor} hover:underline flex items-center gap-1`}
          >
            {trackerLabel}
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="p-4">
        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.active}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Active</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.preparing}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Preparing</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.completed}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Complete</div>
          </div>
        </div>

        {/* Alerts for this program */}
        {(programAlerts.critical.length > 0 || programAlerts.warning.length > 0) && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Alerts</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {programAlerts.critical.map((alert, idx) => (
                <div key={`critical-${idx}`} className="flex items-center justify-between text-sm p-1.5 bg-red-50 dark:bg-red-900/20 rounded">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span className="text-gray-900 dark:text-white">{alert.student.first_name} {alert.student.last_name}</span>
                    <span className="text-red-600 dark:text-red-400 text-xs">{alert.message}</span>
                  </div>
                  <Link href={alert.link} className="text-red-600 dark:text-red-400 hover:underline text-xs">
                    View
                  </Link>
                </div>
              ))}
              {programAlerts.warning.map((alert, idx) => (
                <div key={`warning-${idx}`} className="flex items-center justify-between text-sm p-1.5 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                    <span className="text-gray-900 dark:text-white">{alert.student.first_name} {alert.student.last_name}</span>
                    <span className="text-yellow-600 dark:text-yellow-400 text-xs">{alert.message}</span>
                  </div>
                  <Link href={alert.link} className="text-yellow-600 dark:text-yellow-400 hover:underline text-xs">
                    View
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {programAlerts.critical.length === 0 && programAlerts.warning.length === 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-4 h-4" />
            No alerts
          </div>
        )}
      </div>
    </div>
  );

  // PM Semester Section Component
  const PMSemesterSection = ({ semester }: { semester: string }) => {
    const config = PM_SEMESTER_CONFIG[semester] || {
      label: semester,
      description: 'Unknown semester',
      color: 'text-gray-700 dark:text-gray-400',
      bgColor: 'bg-gray-100 dark:bg-gray-700',
      trackerLink: '/clinical',
    };
    const stats = getPmSemesterStats(semester);
    const semesterStudents = pmBySemester[semester] || [];

    // Get alerts for this semester
    const semesterAlerts = {
      critical: alerts.critical.filter(a => {
        const student = students.find(s => s.id === a.student.id);
        return student && (student.program === 'PM' || student.program === 'PMD') && student.semester === semester;
      }),
      warning: alerts.warning.filter(a => {
        const student = students.find(s => s.id === a.student.id);
        return student && (student.program === 'PM' || student.program === 'PMD') && student.semester === semester;
      }),
    };

    if (semesterStudents.length === 0) return null;

    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
        <div className={`px-4 py-3 border-b border-gray-200 dark:border-gray-700 ${config.bgColor}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GraduationCap className={`w-5 h-5 ${config.color}`} />
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">{config.label}</h2>
                <p className="text-xs text-gray-600 dark:text-gray-400">{config.description}</p>
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {stats.total} students
              </span>
            </div>
            <Link
              href={config.trackerLink}
              className={`text-sm font-medium ${config.color} hover:underline flex items-center gap-1`}
            >
              View Tracker
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="p-4">
          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.active}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Active</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.preparing}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Preparing</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.completed}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Complete</div>
            </div>
          </div>

          {/* Alerts */}
          {(semesterAlerts.critical.length > 0 || semesterAlerts.warning.length > 0) && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Alerts</div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {semesterAlerts.critical.map((alert, idx) => (
                  <div key={`critical-${idx}`} className="flex items-center justify-between text-sm p-1.5 bg-red-50 dark:bg-red-900/20 rounded">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <span className="text-gray-900 dark:text-white">{alert.student.first_name} {alert.student.last_name}</span>
                      <span className="text-red-600 dark:text-red-400 text-xs">{alert.message}</span>
                    </div>
                    <Link href={alert.link} className="text-red-600 dark:text-red-400 hover:underline text-xs">
                      View
                    </Link>
                  </div>
                ))}
                {semesterAlerts.warning.map((alert, idx) => (
                  <div key={`warning-${idx}`} className="flex items-center justify-between text-sm p-1.5 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                      <span className="text-gray-900 dark:text-white">{alert.student.first_name} {alert.student.last_name}</span>
                      <span className="text-yellow-600 dark:text-yellow-400 text-xs">{alert.message}</span>
                    </div>
                    <Link href={alert.link} className="text-yellow-600 dark:text-yellow-400 hover:underline text-xs">
                      View
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {semesterAlerts.critical.length === 0 && semesterAlerts.warning.length === 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              No alerts
            </div>
          )}
        </div>
      </div>
    );
  };

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
                <p className="text-gray-600 dark:text-gray-400">All programs at a glance</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {totalAlerts > 0 && (
                <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-sm font-medium">
                  {totalAlerts} alerts
                </span>
              )}
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
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{students.length}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Total Students</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                <Ambulance className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{emtStudents.length}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">EMT</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <Stethoscope className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{aemtStudents.length}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">AEMT</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <GraduationCap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{pmStudents.length}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Paramedic</div>
              </div>
            </div>
          </div>
        </div>

        {/* EMT Section */}
        {emtStudents.length > 0 && (
          <ProgramSection
            title="EMT Program"
            icon={Ambulance}
            iconColor="text-teal-600 dark:text-teal-400"
            bgColor="bg-teal-50 dark:bg-teal-900/20"
            stats={emtStats}
            trackerLink="/clinical/emt-tracking"
            trackerLabel="View EMT Tracker"
            alerts={getAlertsForProgram('EMT')}
          />
        )}

        {/* AEMT Section */}
        {aemtStudents.length > 0 && (
          <ProgramSection
            title="AEMT Program"
            icon={Stethoscope}
            iconColor="text-indigo-600 dark:text-indigo-400"
            bgColor="bg-indigo-50 dark:bg-indigo-900/20"
            stats={aemtStats}
            trackerLink="/clinical/aemt-tracking"
            trackerLabel="View AEMT Tracker"
            alerts={getAlertsForProgram('AEMT')}
          />
        )}

        {/* Paramedic Sections by Semester */}
        {pmStudents.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Paramedic Program</h2>
              <span className="text-sm text-gray-500 dark:text-gray-400">by Semester</span>
            </div>

            {/* S4 - Internship */}
            <PMSemesterSection semester="S4" />

            {/* S3 - Clinicals */}
            <PMSemesterSection semester="S3" />

            {/* S2 - Compliance */}
            <PMSemesterSection semester="S2" />

            {/* S1 - Didactic */}
            <PMSemesterSection semester="S1" />

            {/* Unassigned PM students */}
            {pmBySemester['Unassigned']?.length > 0 && (
              <PMSemesterSection semester="Unassigned" />
            )}
          </div>
        )}

        {/* Empty State */}
        {students.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 text-center">
            <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No students found</p>
          </div>
        )}
      </main>
    </div>
  );
}
