'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  Users,
  ClipboardCheck,
  BarChart3,
  Home,
  ChevronRight,
  ClipboardList,
  Building2,
  UserCheck,
  Filter,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import { PageLoader } from '@/components/ui';
import { hasMinRole, canAccessScheduling } from '@/lib/permissions';
import { useEffectiveRole } from '@/hooks/useEffectiveRole';
import type { CurrentUser } from '@/types';
import Breadcrumbs from '@/components/Breadcrumbs';

export default function SchedulingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [userIsDirector, setUserIsDirector] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingSubCount, setPendingSubCount] = useState(0);
  const effectiveRole = useEffectiveRole(currentUser?.role ?? null);

  // Part-Timer Status state
  interface PartTimerInfo {
    id: string;
    name: string;
    email: string;
    role: string;
    availableThisWeek: number;
    availabilityDates: string[];
    confirmedShifts: number;
    pendingShifts: number;
    monthlyHours: number;
    lastShiftDate: string | null;
  }
  interface PartTimerSummary {
    totalPartTimers: number;
    availableThisWeek: number;
    unfilledShifts: number;
    pendingSignups: number;
  }
  const [partTimers, setPartTimers] = useState<PartTimerInfo[]>([]);
  const [ptSummary, setPtSummary] = useState<PartTimerSummary | null>(null);
  const [ptLoading, setPtLoading] = useState(false);
  const [ptFilter, setPtFilter] = useState<'all' | 'available'>('all');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  // Role guard: only scheduling-enabled roles
  useEffect(() => {
    if (effectiveRole && !canAccessScheduling(effectiveRole)) {
      router.push('/');
    }
  }, [effectiveRole, router]);

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
        // Check director status
        const isAdmin = data.user.role === 'admin' || data.user.role === 'superadmin';
        if (isAdmin) {
          setUserIsDirector(true);
        } else {
          // Check endorsements
          const endorseRes = await fetch('/api/admin/endorsements?user_id=' + data.user.id);
          const endorseData = await endorseRes.json();
          if (endorseData.success) {
            const hasDirector = endorseData.endorsements?.some(
              (e: { endorsement_type: string; is_active: boolean }) =>
                e.endorsement_type === 'director' && e.is_active
            );
            setUserIsDirector(hasDirector || false);
          }
        }
        // Get pending substitute request count for reviewers
        const userRole = data.user.role;
        if (isAdmin || userIsDirector || hasMinRole(userRole, 'lead_instructor')) {
          try {
            const subRes = await fetch('/api/scheduling/substitute-requests?status=pending');
            const subData = await subRes.json();
            if (subData.success) {
              setPendingSubCount(subData.requests?.length ?? 0);
            }
          } catch {
            // Non-critical — ignore errors
          }
        }
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
    setLoading(false);
  };

  // Fetch part-timer status when director/admin and user loaded
  useEffect(() => {
    if (!currentUser) return;
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'superadmin';
    if (!isAdmin && !userIsDirector) return;
    const fetchPartTimerStatus = async () => {
      setPtLoading(true);
      try {
        const res = await fetch('/api/scheduling/part-timer-status');
        const data = await res.json();
        if (data.success) {
          setPartTimers(data.partTimers || []);
          setPtSummary(data.summary || null);
        }
      } catch (err) {
        console.error('Error fetching part-timer status:', err);
      }
      setPtLoading(false);
    };
    fetchPartTimerStatus();
  }, [currentUser, userIsDirector]);

  if (status === 'loading' || loading) {
    return <PageLoader />;
  }

  if (!session || !currentUser) return null;

  const isAdmin = effectiveRole === 'admin' || effectiveRole === 'superadmin';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 text-blue-900 dark:text-blue-400 hover:text-blue-700">
                <div className="w-10 h-10 bg-blue-900 dark:bg-blue-700 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">PMI</span>
                </div>
                <div className="hidden sm:block">
                  <div className="font-bold text-lg leading-tight dark:text-white">PMI Paramedic Tools</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Scheduling</div>
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:block">
                {session?.user?.email}
              </span>
              <NotificationBell />
              <ThemeToggle />
            </div>
          </div>

          {/* Breadcrumbs */}
          <Breadcrumbs className="mt-4 mb-2" />

          {/* Title */}
          <div className="flex items-center gap-3">
            <Calendar className="w-7 h-7 text-cyan-600 dark:text-cyan-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Part-Timer Scheduling</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* My Availability */}
          <Link
            href="/scheduling/availability"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">
                <Calendar className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">My Availability</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Set when you're available to work
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
            </div>
          </Link>

          {/* Open Shifts */}
          <Link
            href="/scheduling/shifts"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Open Shifts</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  View and sign up for available shifts
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
            </div>
          </Link>

          {/* My Shifts */}
          <Link
            href="/scheduling/shifts?filter=mine"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
                <ClipboardCheck className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">My Shifts</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  View your confirmed shift assignments
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
            </div>
          </Link>

          {/* Substitute Requests — visible to all instructors */}
          <Link
            href="/scheduling/substitute-requests"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center group-hover:bg-orange-200 dark:group-hover:bg-orange-900/50 transition-colors">
                <ClipboardList className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Substitute Requests</h3>
                  {pendingSubCount > 0 && (
                    <span className="text-xs px-2 py-0.5 bg-yellow-500 text-white rounded-full font-semibold">
                      {pendingSubCount}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Request or manage lab day coverage
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
            </div>
          </Link>

          {/* Resource Bookings — visible to all instructors */}
          <Link
            href="/scheduling/resource-bookings"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/50 transition-colors">
                <Building2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Resource Bookings</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Book sim labs, rooms, and equipment
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
            </div>
          </Link>

          {/* Team Availability — visible to all instructors */}
          <Link
            href="/scheduling/team-availability"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-cyan-100 dark:bg-cyan-900/30 rounded-xl flex items-center justify-center group-hover:bg-cyan-200 dark:group-hover:bg-cyan-900/50 transition-colors">
                <Users className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Team Availability</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Find when multiple instructors are all free
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
            </div>
          </Link>

          {/* Semester Planner — visible to lead_instructors and above */}
          {effectiveRole && hasMinRole(effectiveRole, 'lead_instructor') && (
            <Link
              href="/scheduling/planner"
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900/30 rounded-xl flex items-center justify-center group-hover:bg-teal-200 dark:group-hover:bg-teal-900/50 transition-colors">
                  <Calendar className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Semester Planner</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Plan class schedules, rooms, and instructor assignments
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
              </div>
            </Link>
          )}

          {/* Director-only sections */}
          {(userIsDirector || isAdmin) && (
            <>
              {/* View All Availability */}
              <Link
                href="/scheduling/availability/all"
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 group border-2 border-amber-200 dark:border-amber-800"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center group-hover:bg-amber-200 dark:group-hover:bg-amber-900/50 transition-colors">
                    <Users className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">All Availability</h3>
                      <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">Director</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      See when all instructors are available
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                </div>
              </Link>

              {/* Create Shift */}
              <Link
                href="/scheduling/shifts/new"
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 group border-2 border-amber-200 dark:border-amber-800"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center group-hover:bg-amber-200 dark:group-hover:bg-amber-900/50 transition-colors">
                    <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create Shift</h3>
                      <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">Director</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Create new open shifts for instructors
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                </div>
              </Link>

              {/* Pending Signups */}
              <Link
                href="/scheduling/signups/pending"
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 group border-2 border-amber-200 dark:border-amber-800"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center group-hover:bg-amber-200 dark:group-hover:bg-amber-900/50 transition-colors">
                    <ClipboardCheck className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Pending Signups</h3>
                      <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">Director</span>
                      {pendingCount > 0 && (
                        <span className="text-xs px-2 py-0.5 bg-yellow-500 text-white rounded-full">{pendingCount}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Review and confirm shift signups
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                </div>
              </Link>

              {/* Reports */}
              <Link
                href="/scheduling/reports"
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 group border-2 border-amber-200 dark:border-amber-800"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center group-hover:bg-amber-200 dark:group-hover:bg-amber-900/50 transition-colors">
                    <BarChart3 className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Reports</h3>
                      <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">Director</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      View hours and scheduling reports
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                </div>
              </Link>
            </>
          )}
        </div>

        {/* Part-Timer Status Section — Director/Admin only */}
        {(userIsDirector || isAdmin) && (
          <div className="mt-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border-2 border-amber-200 dark:border-amber-800">
              {/* Section Header */}
              <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                    <UserCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Part-Timer Status</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Coordination overview</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">Director</span>
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select
                    value={ptFilter}
                    onChange={(e) => setPtFilter(e.target.value as 'all' | 'available')}
                    className="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="all">All Part-Timers</option>
                    <option value="available">Available This Week</option>
                  </select>
                </div>
              </div>

              {ptLoading ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <div className="animate-spin w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                  Loading part-timer status...
                </div>
              ) : ptSummary && ptSummary.totalPartTimers > 0 ? (
                <>
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-amber-50 dark:bg-amber-900/10">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{ptSummary.availableThisWeek}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Available This Week</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">{ptSummary.unfilledShifts}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Unfilled Shifts</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{ptSummary.pendingSignups}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Pending Signups</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{ptSummary.totalPartTimers}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Total Part-Timers</p>
                    </div>
                  </div>

                  {/* Part-Timer Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Name</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Available This Week</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Confirmed</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Pending</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Monthly Hours</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Last Shift</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {partTimers
                          .filter(pt => ptFilter === 'all' || pt.availableThisWeek > 0)
                          .map(pt => (
                          <tr key={pt.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900 dark:text-white">{pt.name}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{pt.email}</div>
                            </td>
                            <td className="text-center px-4 py-3">
                              {pt.availableThisWeek > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs font-medium">
                                  {pt.availableThisWeek} day{pt.availableThisWeek !== 1 ? 's' : ''}
                                </span>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500">--</span>
                              )}
                            </td>
                            <td className="text-center px-4 py-3">
                              {pt.confirmedShifts > 0 ? (
                                <span className="font-medium text-blue-600 dark:text-blue-400">{pt.confirmedShifts}</span>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500">0</span>
                              )}
                            </td>
                            <td className="text-center px-4 py-3">
                              {pt.pendingShifts > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded text-xs font-medium">
                                  {pt.pendingShifts}
                                </span>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500">0</span>
                              )}
                            </td>
                            <td className="text-center px-4 py-3">
                              <span className={pt.monthlyHours > 0 ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}>
                                {pt.monthlyHours > 0 ? `${pt.monthlyHours}h` : '--'}
                              </span>
                            </td>
                            <td className="text-center px-4 py-3">
                              {pt.lastShiftDate ? (
                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                  {new Date(pt.lastShiftDate + 'T12:00:00').toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </span>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500">--</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {partTimers.filter(pt => ptFilter === 'all' || pt.availableThisWeek > 0).length === 0 && (
                      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                        <Users className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p>No part-timers {ptFilter === 'available' ? 'available this week' : 'found'}</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <Users className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p>No part-time instructors configured</p>
                  <p className="text-xs mt-1">Mark instructors as part-time in the Admin Users page</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
