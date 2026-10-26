'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { ParkAwareLink as Link } from '@/components/ModuleGuard';
import {
  Calendar,
  ClipboardList,
  LogIn,
  LogOut,
  Stethoscope,
  Users,
  FileText,
  GraduationCap,
  Award,
  BookOpen,
  Settings,
  UserPlus,
  Briefcase,
  CheckSquare,
  Clock,
  CalendarDays,
  RotateCcw,
  HelpCircle,
  LayoutGrid,
  Check,
  Flame,
  DoorOpen,
} from 'lucide-react';
import { canAccessAdmin, canAccessClinical, canAccessScheduling, canAccessAffiliations, canAccessLVFR, hasMinRole } from '@/lib/permissions';
import { useEffectiveRole } from '@/hooks/useEffectiveRole';
import { ThemeToggle } from '@/components/ThemeToggle';
import SectionTiles, { OperationsHubRow } from '@/components/home/SectionTiles';
import HomeStatBar from '@/components/dashboard/HomeStatBar';
import HomeCalendarBand from '@/components/home/HomeCalendarBand';
import TodayBand from '@/components/home/TodayBand';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import AnnouncementBanner from '@/components/dashboard/AnnouncementBanner';
import CalendarConnectBanner from '@/components/dashboard/CalendarConnectBanner';
import { SkeletonStats, SkeletonCard } from '@/components/ui';
import type { CurrentUser as CurrentUserType } from '@/types';

export default function HomePage() {
  const { data: session, status } = useSession();
  const [currentUser, setCurrentUser] = useState<CurrentUserType | null>(null);
  const effectiveRole = useEffectiveRole(currentUser?.role ?? null);

  // React Query hook for current user (cached & shared across components)
  const { data: cachedUser } = useCurrentUser({
    enabled: !!session?.user?.email,
  });

  // When cached user arrives, handle redirect logic
  useEffect(() => {
    if (!cachedUser && !session?.user?.email) return;

    if (cachedUser) {
      const user = cachedUser;

      // Non-PMI users with no approved role should go through the
      // self-service volunteer request-access flow.
      const isPmiEmail =
        user.email?.endsWith('@pmi.edu') || user.email?.endsWith('@my.pmi.edu');
      if (!isPmiEmail && (!user.role || user.role === 'pending')) {
        window.location.href = '/request-access';
        return;
      }

      // PMI users with pending role: set user so we can render the
      // "access pending" screen.
      if (user.role === 'pending') {
        setCurrentUser(user);
        return;
      }

      // Students scoped to a specific program redirect to that program's dashboard
      if (user.role === 'student' && user.agency_scope?.includes('lvfr_aemt')) {
        window.location.href = '/lvfr-aemt';
        return;
      }

      setCurrentUser(user);
    } else if (session?.user?.email) {
      // cachedUser is null (not found) - redirect non-PMI users to request access
      const email = session.user.email;
      const isPmiEmail = email.endsWith('@pmi.edu') || email.endsWith('@my.pmi.edu');
      if (!isPmiEmail) {
        window.location.href = '/request-access';
      }
    }
  }, [cachedUser, session]);

  // Loading state with skeleton UI
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        {/* Header Skeleton */}
        <header className="bg-white dark:bg-gray-800 shadow-sm">
          <div className="max-w-screen-2xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          </div>
        </header>

        {/* Main Content Skeleton */}
        <main className="max-w-screen-2xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded mx-auto mb-2 animate-pulse" />
            <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded mx-auto animate-pulse" />
          </div>

          {/* Stats skeleton */}
          <div className="mb-8 max-w-screen-2xl mx-auto">
            <SkeletonStats rows={4} />
          </div>

          {/* Card grid skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 max-w-screen-2xl mx-auto">
            <SkeletonCard rows={6} />
          </div>
        </main>
      </div>
    );
  }

  // Not logged in — redirect to custom sign-in page (has Google + Microsoft + Guest)
  if (!session) {
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/signin';
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  // PMI users with pending role - show access pending screen
  if (currentUser?.role === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Access Pending Approval</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            Your account has been created but requires administrator approval before you can access PMI Paramedic Tools.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            An administrator will review your account and assign you the appropriate role. You will receive a notification once approved.
          </p>
          <div className="flex flex-col gap-3">
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300">
              Signed in as: <span className="font-medium">{session.user?.email}</span>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="flex items-center justify-center gap-2 px-5 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Guest users — minimal dashboard with Help only
  if (currentUser?.role === 'guest') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <header className="bg-white dark:bg-gray-800 shadow-sm">
          <div className="max-w-screen-2xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <Stethoscope className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-white">PMI Paramedic Tools</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Pima Paramedic Institute</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:block">{session.user?.email}</span>
              <ThemeToggle />
              <button onClick={() => signOut()} className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </header>
        <main className="max-w-screen-2xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome, {session.user?.name?.split(' ')[0] || 'Guest'}!</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">You have guest-level access.</p>
          </div>
          <div className="max-w-md mx-auto mb-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Limited Access</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Contact an administrator if you need additional access to PMI Paramedic Tools.
            </p>
          </div>
          <div className="grid grid-cols-1 max-w-md mx-auto gap-4">
            <Link href="/help" className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-shadow p-6 group">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-sky-100 dark:bg-sky-900/30 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-sky-200 dark:group-hover:bg-sky-900/50 transition-colors">
                  <HelpCircle className="w-8 h-8 text-sky-600 dark:text-sky-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Help Center</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Documentation, guides, and FAQs.</p>
              </div>
            </Link>
          </div>
        </main>
        <footer className="mt-12 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>PMI Paramedic Tools © {new Date().getFullYear()}</p>
        </footer>
      </div>
    );
  }

  // Logged in - show main menu
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Top bar + sub-nav line come from AppChrome in the root layout (TRIM 6/7b-1a) */}
      {/* Main Content */}
      <main id="main-content" className="px-[clamp(16px,2.75vw,96px)] py-6 w-full max-w-[3000px] mx-auto">
        <PageErrorBoundary>

        {/* System Announcements */}
        <ErrorBoundary>
          <AnnouncementBanner />
        </ErrorBoundary>

        {/* Connect Google Calendar prompt — instructors+ only,
            self-hides on connect or after dismissal. */}
        <ErrorBoundary>
          <CalendarConnectBanner />
        </ErrorBoundary>

        {/* Stat bar (TRIM 6/7a-2): merged Quick Stats + Overview, plus the large
            Log Site Visit button (replaces the old Site Visit Check-In banner). */}
        {currentUser && effectiveRole && hasMinRole(effectiveRole, 'instructor') && (
          <ErrorBoundary>
            <HomeStatBar
              isAdmin={hasMinRole(effectiveRole, 'admin')}
              canLogSiteVisit={canAccessClinical(effectiveRole)}
            />
          </ErrorBoundary>
        )}

        {/* Today + This week on row 1, Month below (TRIM 6/7a-5, mock round 9) */}
        {currentUser && effectiveRole && hasMinRole(effectiveRole, 'volunteer_instructor') && (
          <ErrorBoundary>
            <HomeCalendarBand
              userName={currentUser.name ?? null}
              defaultMine={effectiveRole === 'volunteer_instructor'}
              canViewAs={hasMinRole(effectiveRole, 'admin')}
              canEdit={hasMinRole(effectiveRole, 'admin')}
              sectionsSlot={
                <div className="min-w-0">
                  <ErrorBoundary>
                    <SectionTiles role={effectiveRole} compact />
                  </ErrorBoundary>
                  <OperationsHubRow role={effectiveRole} />
                </div>
              }
              todaySlot={
                hasMinRole(effectiveRole, 'instructor') ? (
                  <ErrorBoundary>
                    <TodayBand />
                  </ErrorBoundary>
                ) : undefined
              }
            />
          </ErrorBoundary>
        )}

        {/* Section tiles (TRIM 6/7a-1): beside the Month for calendar users (6/7a-7), here otherwise */}
        {!(currentUser && effectiveRole && hasMinRole(effectiveRole, 'volunteer_instructor')) && (
          <ErrorBoundary>
            <SectionTiles role={effectiveRole} />
          </ErrorBoundary>
        )}


        </PageErrorBoundary>
      </main>

      {/* Footer */}
      <footer className="mt-12 py-6 text-center text-sm text-gray-500 dark:text-gray-400 print:hidden">
        <p>PMI Paramedic Tools © {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
