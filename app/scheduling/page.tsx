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
  ChevronRight
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import { PageLoader } from '@/components/ui';
import { isDirector } from '@/lib/endorsements';
import type { CurrentUser } from '@/types';

export default function SchedulingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [userIsDirector, setUserIsDirector] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

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
        // Get pending signup count if director
        if (isAdmin || userIsDirector) {
          // This would fetch pending signups count
        }
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
    setLoading(false);
  };

  if (status === 'loading' || loading) {
    return <PageLoader />;
  }

  if (!session || !currentUser) return null;

  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'superadmin';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
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
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-4 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-900 dark:text-white">Scheduling</span>
          </div>

          {/* Title */}
          <div className="flex items-center gap-3">
            <Calendar className="w-7 h-7 text-cyan-600 dark:text-cyan-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Part-Timer Scheduling</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
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
      </main>
    </div>
  );
}
