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
  Plus,
  Target,
  TrendingUp,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import { PageLoader } from '@/components/ui';
import { hasMinRole, canAccessScheduling } from '@/lib/permissions';
import LogHoursModal from '@/components/scheduling/LogHoursModal';
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
    monthlyHoursTarget: number | null;
    unavailableWeekdays: number[];
    availableThisWeek: number;
    availabilityDates: string[];
    confirmedShifts: number;
    pendingShifts: number;
    monthlyHours: number;
    semesterHours: number;
    upcomingHours: number;
    manualMonthlyHours: number;
    trend: Array<{ month: string; hours: number }>;
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
  // State for the Log Hours modal (per-row trigger from the part-timer table).
  const [logHoursFor, setLogHoursFor] = useState<{
    id: string;
    name: string;
    unavailableWeekdays: number[];
  } | null>(null);
  // Edit-target state for the inline monthly-hours-target control.
  const [editingTargetFor, setEditingTargetFor] = useState<string | null>(null);
  const [targetDraft, setTargetDraft] = useState<string>('');
  // Unavailable-weekdays editor — per-user checkbox popover.
  const [editingUnavailFor, setEditingUnavailFor] = useState<string | null>(null);
  const [unavailDraft, setUnavailDraft] = useState<number[]>([]);

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

  // Fetch part-timer status when director/admin and user loaded. Also
  // exposed as a callback so the Log Hours modal + target-edit flow
  // can refresh the totals after a save without reloading the page.
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

  useEffect(() => {
    if (!currentUser) return;
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'superadmin';
    if (!isAdmin && !userIsDirector) return;
    fetchPartTimerStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, userIsDirector]);

  // Save a new monthly_hours_target for one user, then refresh the table.
  const saveTarget = async (userId: string) => {
    const raw = targetDraft.trim();
    const target = raw === '' ? null : Math.round(Number(raw));
    if (target != null && (isNaN(target) || target <= 0 || target > 400)) {
      return;
    }
    try {
      await fetch('/api/scheduling/hours-target', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, target }),
      });
      setEditingTargetFor(null);
      setTargetDraft('');
      await fetchPartTimerStatus();
    } catch (err) {
      console.error('Error saving target:', err);
    }
  };

  // Save unavailable_weekdays for one user. Empty array clears the setting
  // (server stores NULL). Refreshes the table afterward.
  const saveUnavail = async (userId: string) => {
    try {
      await fetch('/api/scheduling/unavailable-days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, weekdays: unavailDraft }),
      });
      setEditingUnavailFor(null);
      setUnavailDraft([]);
      await fetchPartTimerStatus();
    } catch (err) {
      console.error('Error saving unavailable weekdays:', err);
    }
  };

  const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

          {/* Resource Bookings - archived, hidden from nav */}

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

          {/* Scheduling Polls */}
          <Link
            href="/scheduling/polls"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900/30 rounded-xl flex items-center justify-center group-hover:bg-teal-200 dark:group-hover:bg-teal-900/50 transition-colors">
                <ClipboardList className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Scheduling Polls</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Create and manage availability polls
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
            </div>
          </Link>

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
                          <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400 hidden sm:table-cell">Avail. Week</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400 hidden md:table-cell">Confirmed</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400 hidden md:table-cell">Pending</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Month / Target</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400 hidden lg:table-cell">Semester</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400 hidden lg:table-cell">Upcoming</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400 hidden xl:table-cell">3-Mo Trend</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400 hidden md:table-cell">Last Shift</th>
                          {isAdmin && (
                            <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {partTimers
                          .filter(pt => ptFilter === 'all' || pt.availableThisWeek > 0)
                          .map(pt => {
                            // Color-band the Month/Target cell. With no target
                            // we fall back to plain black/gray hours. With a
                            // target: green <80%, amber 80-100%, red >100%.
                            const target = pt.monthlyHoursTarget;
                            let pct = 0;
                            let targetTone: 'none' | 'under' | 'near' | 'over' = 'none';
                            if (target && target > 0) {
                              pct = Math.min(999, Math.round((pt.monthlyHours / target) * 100));
                              targetTone =
                                pct < 80 ? 'under' : pct <= 100 ? 'near' : 'over';
                            }
                            const monthColor =
                              targetTone === 'over'
                                ? 'text-red-600 dark:text-red-400'
                                : targetTone === 'near'
                                ? 'text-amber-600 dark:text-amber-400'
                                : targetTone === 'under'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : pt.monthlyHours > 0
                                ? 'text-gray-900 dark:text-white'
                                : 'text-gray-400 dark:text-gray-500';
                            const barColor =
                              targetTone === 'over'
                                ? 'bg-red-500'
                                : targetTone === 'near'
                                ? 'bg-amber-500'
                                : 'bg-emerald-500';
                            return (
                              <tr key={pt.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="font-medium text-gray-900 dark:text-white">{pt.name}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">{pt.email}</div>
                                  {pt.manualMonthlyHours > 0 && (
                                    <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                                      incl. {pt.manualMonthlyHours}h manual
                                    </div>
                                  )}
                                  {/* Unavailable-weekdays badge + inline editor.
                                      Shown as a subtle amber chip; admins can
                                      click to edit via a small checkbox
                                      popover rendered below. */}
                                  {editingUnavailFor === pt.id ? (
                                    <div className="mt-1 p-2 rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
                                      <div className="text-[10px] uppercase tracking-wide font-semibold text-amber-700 dark:text-amber-300 mb-1">
                                        Unavailable weekdays
                                      </div>
                                      <div className="flex flex-wrap gap-1.5 mb-2">
                                        {WEEKDAY_NAMES.map((name, wd) => {
                                          const on = unavailDraft.includes(wd);
                                          return (
                                            <button
                                              type="button"
                                              key={wd}
                                              onClick={() =>
                                                setUnavailDraft((prev) =>
                                                  on
                                                    ? prev.filter((x) => x !== wd)
                                                    : [...prev, wd].sort()
                                                )
                                              }
                                              className={`px-1.5 py-0.5 text-[10px] rounded border ${
                                                on
                                                  ? 'bg-amber-500 text-white border-amber-500'
                                                  : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                                              }`}
                                            >
                                              {name}
                                            </button>
                                          );
                                        })}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => saveUnavail(pt.id)}
                                          className="text-[11px] px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white"
                                        >
                                          Save
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingUnavailFor(null);
                                            setUnavailDraft([]);
                                          }}
                                          className="text-[11px] text-gray-500 hover:text-gray-700"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : pt.unavailableWeekdays.length > 0 ? (
                                    <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-[10px] text-amber-700 dark:text-amber-300">
                                      <span>
                                        Unavail:{' '}
                                        {pt.unavailableWeekdays
                                          .map((w) => WEEKDAY_NAMES[w])
                                          .join(', ')}
                                      </span>
                                      {isAdmin && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingUnavailFor(pt.id);
                                            setUnavailDraft([...pt.unavailableWeekdays]);
                                          }}
                                          className="hover:underline"
                                          title="Edit unavailable weekdays"
                                        >
                                          ✎
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    isAdmin && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingUnavailFor(pt.id);
                                          setUnavailDraft([]);
                                        }}
                                        className="mt-0.5 text-[10px] text-gray-400 hover:text-blue-600 hover:underline"
                                      >
                                        + set unavailable days
                                      </button>
                                    )
                                  )}
                                </td>
                                <td className="text-center px-4 py-3 hidden sm:table-cell">
                                  {pt.availableThisWeek > 0 ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs font-medium">
                                      {pt.availableThisWeek} day{pt.availableThisWeek !== 1 ? 's' : ''}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 dark:text-gray-500">--</span>
                                  )}
                                </td>
                                <td className="text-center px-4 py-3 hidden md:table-cell">
                                  {pt.confirmedShifts > 0 ? (
                                    <span className="font-medium text-blue-600 dark:text-blue-400">{pt.confirmedShifts}</span>
                                  ) : (
                                    <span className="text-gray-400 dark:text-gray-500">0</span>
                                  )}
                                </td>
                                <td className="text-center px-4 py-3 hidden md:table-cell">
                                  {pt.pendingShifts > 0 ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded text-xs font-medium">
                                      {pt.pendingShifts}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 dark:text-gray-500">0</span>
                                  )}
                                </td>
                                {/* Month / Target — fraction + progress bar when
                                    a target is set; plain hours otherwise.
                                    Click the pencil to edit the target inline. */}
                                <td className="text-center px-4 py-3">
                                  {editingTargetFor === pt.id ? (
                                    <div className="flex items-center justify-center gap-1">
                                      <input
                                        type="number"
                                        min={1}
                                        max={400}
                                        value={targetDraft}
                                        onChange={(e) => setTargetDraft(e.target.value)}
                                        className="w-16 px-1.5 py-0.5 text-sm border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                                        autoFocus
                                      />
                                      <button
                                        type="button"
                                        onClick={() => saveTarget(pt.id)}
                                        className="text-xs px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white"
                                      >
                                        Save
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingTargetFor(null);
                                          setTargetDraft('');
                                        }}
                                        className="text-xs text-gray-500 hover:text-gray-700"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center gap-0.5">
                                      <div className="flex items-baseline justify-center gap-1">
                                        <span className={`font-medium tabular-nums ${monthColor}`}>
                                          {pt.monthlyHours}h
                                        </span>
                                        {target ? (
                                          <span className="text-xs text-gray-400 dark:text-gray-500">
                                            / {target}h
                                          </span>
                                        ) : (
                                          isAdmin && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setEditingTargetFor(pt.id);
                                                setTargetDraft('');
                                              }}
                                              className="text-[10px] text-blue-600 hover:underline"
                                              title="Set monthly hours target"
                                            >
                                              <Target className="w-3 h-3 inline" />
                                            </button>
                                          )
                                        )}
                                      </div>
                                      {target && (
                                        <>
                                          <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                              className={`h-full ${barColor} transition-all`}
                                              style={{
                                                width: `${Math.min(100, pct)}%`,
                                              }}
                                            />
                                          </div>
                                          {isAdmin && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setEditingTargetFor(pt.id);
                                                setTargetDraft(String(target));
                                              }}
                                              className="text-[10px] text-gray-400 hover:text-blue-600 hover:underline"
                                              title="Edit target"
                                            >
                                              edit target
                                            </button>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td className="text-center px-4 py-3 hidden lg:table-cell">
                                  <span className={pt.semesterHours > 0 ? 'tabular-nums text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}>
                                    {pt.semesterHours > 0 ? `${pt.semesterHours}h` : '--'}
                                  </span>
                                </td>
                                <td className="text-center px-4 py-3 hidden lg:table-cell">
                                  <span className={pt.upcomingHours > 0 ? 'tabular-nums text-blue-700 dark:text-blue-300' : 'text-gray-400 dark:text-gray-500'}>
                                    {pt.upcomingHours > 0 ? `${pt.upcomingHours}h` : '--'}
                                  </span>
                                </td>
                                <td className="text-center px-4 py-3 hidden xl:table-cell">
                                  {/* Simple 3-number sparkline — small bars
                                      proportional to max in that trio. Zero
                                      months render as faint dashes so the
                                      cell always shows three positions. */}
                                  <TrendBars trend={pt.trend} />
                                </td>
                                <td className="text-center px-4 py-3 hidden md:table-cell">
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
                                {isAdmin && (
                                  <td className="text-center px-4 py-3">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setLogHoursFor({
                                          id: pt.id,
                                          name: pt.name,
                                          unavailableWeekdays: pt.unavailableWeekdays,
                                        })
                                      }
                                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800"
                                      title="Log hours for this user (class, prep, etc.)"
                                    >
                                      <Plus className="w-3 h-3" /> Log Hours
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
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

      {logHoursFor && (
        <LogHoursModal
          userId={logHoursFor.id}
          userName={logHoursFor.name}
          unavailableWeekdays={logHoursFor.unavailableWeekdays}
          onClose={() => setLogHoursFor(null)}
          onSaved={() => {
            setLogHoursFor(null);
            fetchPartTimerStatus();
          }}
        />
      )}
    </div>
  );
}

/**
 * Inline 3-bar sparkline for the part-timer trend column. Bars are sized
 * proportionally to the max hours in the trio; zero months render as faint
 * dashes so every row shows three positions. Tooltip on hover gives the
 * raw hours per month.
 */
function TrendBars({ trend }: { trend: Array<{ month: string; hours: number }> }) {
  if (!trend || trend.length === 0) {
    return <span className="text-gray-400 dark:text-gray-500">--</span>;
  }
  const max = Math.max(1, ...trend.map((t) => t.hours));
  return (
    <div
      className="inline-flex items-end gap-0.5 h-6"
      title={trend.map((t) => `${t.month}: ${t.hours}h`).join('  ·  ')}
    >
      {trend.map((t) => {
        const pct = Math.max(4, (t.hours / max) * 100);
        return t.hours > 0 ? (
          <div
            key={t.month}
            className="w-2 bg-blue-400 dark:bg-blue-500 rounded-sm"
            style={{ height: `${pct}%` }}
          />
        ) : (
          <div
            key={t.month}
            className="w-2 h-0.5 self-center bg-gray-300 dark:bg-gray-600 rounded-sm"
          />
        );
      })}
    </div>
  );
}
