'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Users,
  Calendar,
  ClipboardList,
  Settings,
  TrendingUp,
  Plus,
  ChevronRight,
  Clock,
  Star,
  AlertCircle,
  UserPlus,
  Check,
  Award,
  Brain,
  Layout
} from 'lucide-react';
import LabHeader from '@/components/LabHeader';
import { canManageContent, type Role } from '@/lib/permissions';

interface DashboardStats {
  totalStudents: number;
  activeStudents: number;
  totalScenarios: number;
  upcomingLabs: number;
}

interface StationAssignment {
  id: string;
  station_number: number;
  instructor_name: string | null;
  instructor_email: string | null;
  scenario: {
    id: string;
    title: string;
    category: string;
    difficulty: string;
  } | null;
  lab_day: {
    id: string;
    date: string;
    title: string;
    cohort: {
      id: string;
      cohort_number: number;
      program: { abbreviation: string };
    };
  };
}

interface UpcomingLab {
  id: string;
  date: string;
  title: string;
  cohort: {
    cohort_number: number;
    program: { abbreviation: string };
  };
  stations_count: number;
}

interface CurrentUser {
  id: string;
  role: Role;
}

export default function LabManagementDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    activeStudents: 0,
    totalScenarios: 0,
    upcomingLabs: 0
  });
  const [myAssignments, setMyAssignments] = useState<StationAssignment[]>([]);
  const [openStations, setOpenStations] = useState<StationAssignment[]>([]);
  const [upcomingLabs, setUpcomingLabs] = useState<UpcomingLab[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchCurrentUser();
    }
  }, [session]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
        fetchDashboardData();
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      setLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      // Fetch students count
      const studentsRes = await fetch('/api/lab-management/students?status=active');
      const studentsData = await studentsRes.json();

      // Fetch scenarios count
      const scenariosRes = await fetch('/api/lab-management/scenarios');
      const scenariosData = await scenariosRes.json();

      // Fetch upcoming labs (next 14 days)
      const today = new Date().toISOString().split('T')[0];
      const twoWeeksOut = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const labsRes = await fetch(`/api/lab-management/lab-days?startDate=${today}&endDate=${twoWeeksOut}`);
      const labsData = await labsRes.json();

      // Fetch my assignments (stations where I'm the instructor)
      const myAssignmentsRes = await fetch(`/api/lab-management/stations?instructor=${session?.user?.email}&upcoming=true`);
      const myAssignmentsData = await myAssignmentsRes.json();

      // Fetch open stations (no instructor assigned)
      const openRes = await fetch(`/api/lab-management/stations?open=true&upcoming=true`);
      const openData = await openRes.json();

      setStats({
        totalStudents: studentsData.students?.length || 0,
        activeStudents: studentsData.students?.filter((s: any) => s.status === 'active').length || 0,
        totalScenarios: scenariosData.scenarios?.length || 0,
        upcomingLabs: labsData.labDays?.length || 0
      });

      setMyAssignments(myAssignmentsData.stations || []);
      setOpenStations(openData.stations || []);
      setUpcomingLabs(labsData.labDays?.slice(0, 5) || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
    setLoading(false);
  };

  const claimStation = async (stationId: string) => {
    setClaiming(stationId);
    try {
      const res = await fetch(`/api/lab-management/stations/${stationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructor_name: session?.user?.name || '',
          instructor_email: session?.user?.email || ''
        })
      });

      const data = await res.json();
      if (data.success) {
        // Refresh data
        fetchDashboardData();
      } else {
        alert('Failed to claim station');
      }
    } catch (error) {
      console.error('Error claiming station:', error);
      alert('Failed to claim station');
    }
    setClaiming(null);
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  const canManage = currentUser && canManageContent(currentUser.role);

  const quickLinks = [
    { href: '/lab-management/scenarios', icon: BookOpen, label: 'Scenarios', color: 'bg-purple-500' },
    { href: '/lab-management/students', icon: Users, label: 'Students', color: 'bg-green-500' },
    { href: '/lab-management/schedule', icon: Calendar, label: 'Schedule', color: 'bg-blue-500' },
    { href: '/lab-management/seating/learning-styles', icon: Brain, label: 'Learning', color: 'bg-cyan-500' },
    { href: '/lab-management/my-certifications', icon: Award, label: 'My Certs', color: 'bg-pink-500' },
    ...(canManage ? [{ href: '/lab-management/admin', icon: Settings, label: 'Admin', color: 'bg-gray-500' }] : []),
  ];

  // Format date for display (timezone-safe)
  const formatDate = (dateString: string) => {
    // Parse as local date by adding T12:00:00 to avoid timezone issues
    const date = new Date(dateString + 'T12:00:00');
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
  };

  // Check if date is today or tomorrow (timezone-safe)
  const isUrgent = (dateString: string) => {
    const date = new Date(dateString + 'T12:00:00');
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return date.toDateString() === today.toDateString() || date.toDateString() === tomorrow.toDateString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <LabHeader
        title="Lab Management Dashboard"
        actions={
          canManage ? (
            <Link
              href="/lab-management/schedule/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              New Lab Day
            </Link>
          ) : null
        }
      />

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* My Assignments Section */}
        {myAssignments.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500" />
                My Lab Assignments
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {myAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 ${
                    isUrgent(assignment.lab_day.date) ? 'border-l-yellow-500' : 'border-l-blue-500'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className={`text-sm font-medium px-2 py-1 rounded ${
                      isUrgent(assignment.lab_day.date)
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                    }`}>
                      {formatDate(assignment.lab_day.date)}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Station {assignment.station_number}
                    </div>
                  </div>

                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {assignment.scenario?.title || 'No scenario assigned'}
                  </h3>

                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {assignment.lab_day.cohort.program.abbreviation} Group {assignment.lab_day.cohort.cohort_number}
                  </div>

                  {assignment.scenario && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-3">
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">{assignment.scenario.category}</span>
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">{assignment.scenario.difficulty}</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {assignment.scenario && (
                      <Link
                        href={`/lab-management/scenarios/${assignment.scenario.id}`}
                        className="flex-1 text-center px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                      >
                        View Scenario
                      </Link>
                    )}
                    <Link
                      href={`/lab-management/grade/station/${assignment.id}`}
                      className="flex-1 text-center px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Grade
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Open Stations (Need Instructor) */}
        {openStations.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-500" />
                Open Stations - Need Instructor
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({openStations.length})</span>
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {openStations.slice(0, 6).map((station) => (
                <div
                  key={station.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-l-orange-400"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className={`text-sm font-medium px-2 py-1 rounded ${
                      isUrgent(station.lab_day.date)
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                        : 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'
                    }`}>
                      {formatDate(station.lab_day.date)}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Station {station.station_number}
                    </div>
                  </div>

                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {station.scenario?.title || 'No scenario assigned'}
                  </h3>

                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {station.lab_day.cohort.program.abbreviation} Group {station.lab_day.cohort.cohort_number}
                  </div>

                  {station.scenario && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-3">
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">{station.scenario.category}</span>
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">{station.scenario.difficulty}</span>
                    </div>
                  )}

                  <button
                    onClick={() => claimStation(station.id)}
                    disabled={claiming === station.id}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                  >
                    {claiming === station.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                    {claiming === station.id ? 'Claiming...' : 'Claim This Station'}
                  </button>
                </div>
              ))}
            </div>
            {openStations.length > 6 && (
              <div className="text-center mt-4">
                <Link href="/lab-management/schedule" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
                  View all {openStations.length} open stations →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {loading ? '...' : stats.activeStudents}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Active Students</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <BookOpen className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {loading ? '...' : stats.totalScenarios}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Scenarios</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {loading ? '...' : stats.upcomingLabs}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Upcoming Labs</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <ClipboardList className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {loading ? '...' : stats.totalStudents}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Students</div>
              </div>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Upcoming Labs */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Upcoming Labs
              </h2>
              <Link href="/lab-management/schedule" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                View All
              </Link>
            </div>
            <div className="p-4">
              {loading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : upcomingLabs.length === 0 ? (
                <div className="text-center py-6">
                  <Calendar className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No upcoming labs scheduled</p>
                  <Link
                    href="/lab-management/schedule/new"
                    className="text-blue-600 dark:text-blue-400 text-sm hover:underline mt-2 inline-block"
                  >
                    Schedule a lab day
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingLabs.map((lab) => (
                    <Link
                      key={lab.id}
                      href={`/lab-management/schedule/${lab.id}`}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
                    >
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {lab.cohort.program.abbreviation} Group {lab.cohort.cohort_number}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(lab.date)} • {lab.stations_count || 0} stations
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">Quick Access</h2>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {quickLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
                  >
                    <div className={`p-2 rounded-full ${link.color} mb-2`}>
                      <link.icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{link.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions - Only for lead_instructor+ */}
        {canManage && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Link
                href="/lab-management/students/new"
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-lg transition-shadow flex items-center gap-3"
              >
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Plus className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">Add Student</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Register a new student</div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </Link>

              <Link
                href="/lab-management/scenarios/new"
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-lg transition-shadow flex items-center gap-3"
              >
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Plus className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">Create Scenario</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Add training scenario</div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </Link>

              <Link
                href="/lab-management/admin/cohorts"
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-lg transition-shadow flex items-center gap-3"
              >
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">Manage Cohorts</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Add or edit cohorts</div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
