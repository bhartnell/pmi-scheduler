'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { 
  Calendar, 
  Users, 
  FileText, 
  ClipboardCheck, 
  BarChart3, 
  Settings,
  ChevronRight,
  Plus,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';

interface Cohort {
  id: string;
  cohort_number: number;
  student_count: number;
  program: {
    name: string;
    abbreviation: string;
  };
}

interface LabDay {
  id: string;
  date: string;
  cohort: {
    cohort_number: number;
    program: {
      abbreviation: string;
    };
  };
  stations: any[];
}

export default function LabManagementDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [upcomingLabs, setUpcomingLabs] = useState<LabDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  const fetchData = async () => {
    try {
      // Fetch active cohorts
      const cohortsRes = await fetch('/api/lab-management/cohorts');
      const cohortsData = await cohortsRes.json();
      if (cohortsData.success) {
        setCohorts(cohortsData.cohorts);
      }

      // Fetch upcoming lab days
      const today = new Date().toISOString().split('T')[0];
      const labsRes = await fetch(`/api/lab-management/lab-days?startDate=${today}`);
      const labsData = await labsRes.json();
      if (labsData.success) {
        setUpcomingLabs(labsData.labDays.slice(0, 5));
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
    setLoading(false);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const navItems = [
    { href: '/lab-management/schedule', icon: Calendar, label: 'Schedule', desc: 'Manage lab days and stations' },
    { href: '/lab-management/scenarios', icon: FileText, label: 'Scenarios', desc: 'Training scenario library' },
    { href: '/lab-management/students', icon: Users, label: 'Students', desc: 'Student roster and progress' },
    { href: '/lab-management/grade', icon: ClipboardCheck, label: 'Grade', desc: 'Assess student performance' },
    { href: '/lab-management/reports', icon: BarChart3, label: 'Reports', desc: 'Team lead distribution & more' },
    { href: '/lab-management/admin', icon: Settings, label: 'Admin', desc: 'Cohorts, users, settings' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Lab Management</h1>
              <p className="text-gray-600 mt-1">Manage labs, scenarios, and student assessments</p>
            </div>
            <Link
              href="/lab-management/schedule/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              <Plus className="w-5 h-5" />
              New Lab Day
            </Link>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Active Cohorts</div>
            <div className="text-2xl font-bold text-gray-900">{cohorts.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Total Students</div>
            <div className="text-2xl font-bold text-gray-900">
              {cohorts.reduce((sum, c) => sum + (c.student_count || 0), 0)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Upcoming Labs</div>
            <div className="text-2xl font-bold text-gray-900">{upcomingLabs.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">This Week</div>
            <div className="text-2xl font-bold text-gray-900">
              {upcomingLabs.filter(lab => {
                const labDate = new Date(lab.date);
                const today = new Date();
                const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
                return labDate <= weekFromNow;
              }).length}
            </div>
          </div>
        </div>

        {/* Navigation Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                    <item.icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{item.label}</h3>
                    <p className="text-sm text-gray-600">{item.desc}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
              </div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Cohorts */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Active Cohorts</h2>
              <Link href="/lab-management/admin/cohorts" className="text-sm text-blue-600 hover:text-blue-800">
                Manage
              </Link>
            </div>
            <div className="divide-y">
              {cohorts.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No active cohorts</p>
                  <Link href="/lab-management/admin/cohorts/new" className="text-blue-600 text-sm hover:underline">
                    Create a cohort
                  </Link>
                </div>
              ) : (
                cohorts.map((cohort) => (
                  <Link
                    key={cohort.id}
                    href={`/lab-management/students?cohortId=${cohort.id}`}
                    className="p-4 flex items-center justify-between hover:bg-gray-50"
                  >
                    <div>
                      <div className="font-medium text-gray-900">
                        {cohort.program.abbreviation} Group {cohort.cohort_number}
                      </div>
                      <div className="text-sm text-gray-600">
                        {cohort.student_count} students
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Upcoming Labs */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Upcoming Labs</h2>
              <Link href="/lab-management/schedule" className="text-sm text-blue-600 hover:text-blue-800">
                View All
              </Link>
            </div>
            <div className="divide-y">
              {upcomingLabs.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No upcoming labs scheduled</p>
                  <Link href="/lab-management/schedule/new" className="text-blue-600 text-sm hover:underline">
                    Schedule a lab day
                  </Link>
                </div>
              ) : (
                upcomingLabs.map((lab) => {
                  const labDate = new Date(lab.date);
                  const isToday = labDate.toDateString() === new Date().toDateString();
                  
                  return (
                    <Link
                      key={lab.id}
                      href={`/lab-management/schedule/${lab.id}`}
                      className="p-4 flex items-center justify-between hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`text-center p-2 rounded-lg min-w-[50px] ${isToday ? 'bg-blue-100' : 'bg-gray-100'}`}>
                          <div className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-gray-600'}`}>
                            {labDate.toLocaleDateString('en-US', { weekday: 'short' })}
                          </div>
                          <div className={`text-lg font-bold ${isToday ? 'text-blue-700' : 'text-gray-900'}`}>
                            {labDate.getDate()}
                          </div>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {lab.cohort.program.abbreviation} Group {lab.cohort.cohort_number}
                          </div>
                          <div className="text-sm text-gray-600">
                            {lab.stations?.length || 0} stations
                          </div>
                        </div>
                      </div>
                      {isToday && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                          Today
                        </span>
                      )}
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
