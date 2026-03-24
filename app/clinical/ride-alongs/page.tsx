'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Ambulance,
  Calendar,
  Users,
  Zap,
  ClipboardList,
  Loader2,
} from 'lucide-react';
import { canAccessClinical, type Role } from '@/lib/permissions';
import Breadcrumbs from '@/components/Breadcrumbs';

interface Stats {
  totalShifts: number;
  openShifts: number;
  filledShifts: number;
  assignedStudents: number;
  studentsWithAvailability: number;
}

export default function RideAlongsHubPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalShifts: 0,
    openShifts: 0,
    filledShifts: 0,
    assignedStudents: 0,
    studentsWithAvailability: 0,
  });

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
    setLoading(true);
    try {
      // Fetch user role
      const userRes = await fetch('/api/instructor/me');
      const userData = await userRes.json();
      if (userData.success && userData.user) {
        setUserRole(userData.user.role);
        if (!canAccessClinical(userData.user.role)) {
          router.push('/');
          return;
        }
      }

      // Fetch shifts and availability in parallel
      const [shiftsRes, availRes] = await Promise.all([
        fetch('/api/clinical/ride-alongs'),
        fetch('/api/clinical/ride-alongs/availability'),
      ]);

      const shiftsData = await shiftsRes.json();
      const availData = await availRes.json();

      const shifts = shiftsData.shifts || [];
      const avail = availData.availability || [];

      // Count unique assigned students across all shifts
      const assignedStudentIds = new Set<string>();
      for (const shift of shifts) {
        const assignments = shift.assignments || [];
        for (const a of assignments) {
          if (a.status !== 'cancelled') {
            assignedStudentIds.add(a.student_id);
          }
        }
      }

      setStats({
        totalShifts: shifts.length,
        openShifts: shifts.filter((s: { status: string }) => s.status === 'open').length,
        filledShifts: shifts.filter((s: { status: string }) => s.status === 'filled').length,
        assignedStudents: assignedStudentIds.size,
        studentsWithAvailability: avail.length,
      });
    } catch (error) {
      console.error('Error fetching ride-along data:', error);
    }
    setLoading(false);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Breadcrumbs className="mb-2" />
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Ambulance className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ride-Along Scheduling</h1>
              <p className="text-gray-600 dark:text-gray-400">Manage EMT student ride-along shifts and assignments</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Calendar className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.openShifts}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Open Shifts</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <ClipboardList className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.filledShifts}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Filled Shifts</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.assignedStudents}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Students Assigned</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Zap className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.studentsWithAvailability}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">With Availability</div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Shift Manager */}
          <Link
            href="/clinical/ride-alongs/shifts"
            className="bg-gradient-to-br from-purple-500 to-indigo-600 dark:from-purple-600 dark:to-indigo-700 rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6 group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/20 rounded-xl group-hover:bg-white/30 transition-colors">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-1">Shift Manager</h3>
                <p className="text-sm text-purple-100 mb-3">
                  Create shifts, import from templates, and assign students
                </p>
                <div className="flex items-center text-white text-sm font-medium">
                  Manage Shifts
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </div>
          </Link>

          {/* Student Availability */}
          <Link
            href="/clinical/ride-alongs/availability"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6 group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">
                <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Student Availability</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  View and collect student ride-along availability
                </p>
                <div className="flex items-center text-green-600 dark:text-green-400 text-sm font-medium">
                  {stats.studentsWithAvailability} students submitted
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </div>
          </Link>

          {/* Unified Calendar */}
          <Link
            href="/calendar?include=ride_along"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6 group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/50 transition-colors">
                <Calendar className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">View Calendar</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  See ride-along shifts on the unified calendar
                </p>
                <div className="flex items-center text-indigo-600 dark:text-indigo-400 text-sm font-medium">
                  Open calendar
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
