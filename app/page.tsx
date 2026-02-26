'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
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
  Building2,
  Plus,
  CheckSquare,
  Clock,
  CalendarDays
} from 'lucide-react';
import { canAccessAdmin, canAccessClinical, getRoleLabel, getRoleBadgeClasses } from '@/lib/permissions';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import CustomizeModal from '@/components/dashboard/CustomizeModal';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import {
  NotificationsWidget,
  MyLabsWidget,
  QuickLinksWidget,
  NeedsAttentionWidget,
  OverviewStatsWidget,
  OpenStationsWidget,
  RecentFeedbackWidget,
  OnboardingWidget,
  OverdueTasksWidget,
  RecentActivityWidget,
  QuickStatsWidget,
  MyTasksWidget,
  CertExpiryWidget,
  ROLE_DEFAULTS,
} from '@/components/dashboard/widgets';
import AnnouncementBanner from '@/components/dashboard/AnnouncementBanner';
import type { CurrentUserMinimal } from '@/types';

interface DashboardPreferences {
  dashboard_widgets: string[];
  quick_links: string[];
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const [currentUser, setCurrentUser] = useState<CurrentUserMinimal | null>(null);
  const [preferences, setPreferences] = useState<DashboardPreferences | null>(null);
  const [showCustomize, setShowCustomize] = useState(false);
  const [hasOnboarding, setHasOnboarding] = useState(false);

  useEffect(() => {
    if (session?.user?.email) {
      // Fetch user and preferences in parallel
      Promise.all([
        fetch('/api/instructor/me').then(res => res.json()),
        fetch('/api/user/preferences').then(res => res.json()),
        fetch('/api/onboarding/dashboard').then(res => res.json()).catch(() => null)
      ]).then(([userData, prefsData, onboardingData]) => {
        if (userData.success && userData.user) {
          const user = userData.user;

          // Non-PMI users who have no approved lab_users entry yet should be
          // redirected to the self-service request-access flow.
          const isPmiEmail =
            user.email?.endsWith('@pmi.edu') || user.email?.endsWith('@my.pmi.edu');
          if (!isPmiEmail && (!user.role || user.role === 'pending')) {
            window.location.href = '/request-access';
            return;
          }

          setCurrentUser(user);
          // Show onboarding card for admins or users with active assignments
          const isAdminRole = user.role === 'admin' || user.role === 'superadmin';
          const hasActiveOnboarding = onboardingData?.success && onboardingData?.hasActiveAssignment;
          setHasOnboarding(isAdminRole || !!hasActiveOnboarding);
        } else if (userData.success === false) {
          // Could not find or create a user - redirect non-PMI users to request access
          const email = session?.user?.email || '';
          const isPmiEmail = email.endsWith('@pmi.edu') || email.endsWith('@my.pmi.edu');
          if (!isPmiEmail) {
            window.location.href = '/request-access';
            return;
          }
        }
        if (prefsData.success && prefsData.preferences) {
          setPreferences(prefsData.preferences);
        } else if (userData.user) {
          // Use role defaults if no preferences
          const defaults = ROLE_DEFAULTS[userData.user.role] || ROLE_DEFAULTS.instructor;
          setPreferences({
            dashboard_widgets: defaults.widgets,
            quick_links: defaults.quickLinks,
          });
        }
      }).catch(console.error);
    }
  }, [session]);

  const handleSavePreferences = async (widgets: string[], quickLinks: string[]) => {
    try {
      const res = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dashboard_widgets: widgets,
          quick_links: quickLinks,
        }),
      });
      if (res.ok) {
        setPreferences({ dashboard_widgets: widgets, quick_links: quickLinks });
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  };

  const handleResetPreferences = async () => {
    try {
      await fetch('/api/user/preferences', { method: 'DELETE' });
      const prefsRes = await fetch('/api/user/preferences');
      const prefsData = await prefsRes.json();
      if (prefsData.success) {
        setPreferences(prefsData.preferences);
      }
    } catch (error) {
      console.error('Error resetting preferences:', error);
    }
  };

  // Render a widget by ID
  const renderWidget = (widgetId: string) => {
    const quickLinks = preferences?.quick_links || ['scenarios', 'students', 'schedule'];
    switch (widgetId) {
      case 'notifications':
        return <NotificationsWidget key={widgetId} />;
      case 'my_labs':
        return <MyLabsWidget key={widgetId} />;
      case 'quick_links':
        return <QuickLinksWidget key={widgetId} links={quickLinks} />;
      case 'needs_attention':
        return <NeedsAttentionWidget key={widgetId} />;
      case 'overview_stats':
        return <OverviewStatsWidget key={widgetId} />;
      case 'open_stations':
        return <OpenStationsWidget key={widgetId} />;
      case 'recent_feedback':
        return <RecentFeedbackWidget key={widgetId} />;
      case 'onboarding':
        return <OnboardingWidget key={widgetId} />;
      case 'overdue_tasks':
        return <OverdueTasksWidget key={widgetId} />;
      case 'recent_activity':
        return <RecentActivityWidget key={widgetId} />;
      case 'quick_stats':
        return <QuickStatsWidget key={widgetId} />;
      case 'my_tasks':
        return <MyTasksWidget key={widgetId} />;
      case 'cert_expiry':
        return <CertExpiryWidget key={widgetId} />;
      default:
        return null;
    }
  };

  // Loading state with skeleton UI
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        {/* Header Skeleton */}
        <header className="bg-white dark:bg-gray-800 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
              <div className="space-y-2">
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
          </div>
        </header>

        {/* Main Content Skeleton */}
        <main className="max-w-6xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded mx-auto mb-2 animate-pulse"></div>
            <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded mx-auto animate-pulse"></div>
          </div>

          {/* Skeleton Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="animate-pulse bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                  <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // Not logged in - show sign in page
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Stethoscope className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">PMI Paramedic Tools</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Administrative tools for Pima Paramedic Institute</p>
          </div>

          <button
            onClick={() => signIn('google')}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <LogIn className="w-5 h-5" />
            Sign in with Google
          </button>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
            Use your @pmi.edu account to sign in
          </p>

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 text-center space-y-3">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Guest instructor?</p>
              <Link
                href="/guest"
                className="inline-flex items-center gap-2 px-4 py-2 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-lg transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Guest Access
              </Link>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Volunteer instructor with a non-PMI account?</p>
              <button
                onClick={() => signIn('google')}
                className="inline-flex items-center gap-2 px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors text-sm"
              >
                <UserPlus className="w-4 h-4" />
                Request Access
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Logged in - show main menu
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 dark:text-white">PMI Paramedic Tools</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Pima Paramedic Institute</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:block">{session.user?.email}</span>
            <NotificationBell />
            <ThemeToggle />
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-12">
        <PageErrorBoundary>
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome, {session.user?.name?.split(' ')[0] || 'User'}!</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">What would you like to do today?</p>
        </div>

        {/* System Announcements */}
        <ErrorBoundary>
          <AnnouncementBanner />
        </ErrorBoundary>

        {/* Customizable Dashboard Widgets - First thing instructors see */}
        {preferences && preferences.dashboard_widgets.length > 0 && (
          <ErrorBoundary>
          <div className="mb-10 max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Your Dashboard</h3>
              <button
                onClick={() => setShowCustomize(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors print:hidden"
              >
                <Settings className="w-4 h-4" />
                Customize
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {preferences.dashboard_widgets.map(widgetId => renderWidget(widgetId))}
            </div>
          </div>
          </ErrorBoundary>
        )}

        {/* Quick Action - Site Visit Check-In (for clinical users) */}
        {currentUser && canAccessClinical(currentUser.role) && (
          <div className="mb-8 max-w-5xl mx-auto">
            <Link
              href="/clinical/site-visits"
              className="block bg-gradient-to-r from-cyan-500 to-teal-500 dark:from-cyan-600 dark:to-teal-600 rounded-2xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] p-6 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center group-hover:bg-white/30 transition-colors">
                    <Building2 className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Site Visit Check-In</h3>
                    <p className="text-cyan-100 text-sm">Log your clinical site visit</p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 bg-white/20 px-4 py-2 rounded-lg text-white font-medium">
                  <Plus className="w-5 h-5" />
                  Log Visit
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* Main Navigation Cards */}
        <ErrorBoundary>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
          {/* Lab Management Card - Not for volunteer instructors */}
          {currentUser && currentUser.role !== 'volunteer_instructor' && (
            <Link
              href="/lab-management"
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-shadow p-6 group"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">
                  <GraduationCap className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Lab Management</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  Manage lab schedules, scenarios, students, and assessments.
                </p>
                <div className="flex flex-wrap justify-center gap-2 text-xs">
                  <span className="px-2 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">Scenarios</span>
                  <span className="px-2 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">Students</span>
                  <span className="px-2 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">Grading</span>
                </div>
              </div>
            </Link>
          )}

          {/* Lab Schedule (Read-Only) Card - For volunteer instructors only */}
          {currentUser && currentUser.role === 'volunteer_instructor' && (
            <Link
              href="/lab-management/schedule"
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-shadow p-6 group"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">
                  <GraduationCap className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Lab Schedule</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  View upcoming lab schedules and assignments (read-only).
                </p>
                <div className="flex flex-wrap justify-center gap-2 text-xs">
                  <span className="px-2 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">View Only</span>
                  <span className="px-2 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">Schedule</span>
                </div>
              </div>
            </Link>
          )}

          {/* Instructor Portal Card - Not for volunteer instructors */}
          {currentUser && currentUser.role !== 'volunteer_instructor' && (
            <Link
              href="/instructor"
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-shadow p-6 group"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
                  <Award className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Instructor Portal</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  Track certifications, CE hours, and teaching activities.
                </p>
                <div className="flex flex-wrap justify-center gap-2 text-xs">
                  <span className="px-2 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full">Certifications</span>
                  <span className="px-2 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full">CE Tracker</span>
                  <span className="px-2 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full">Teaching Log</span>
                </div>
              </div>
            </Link>
          )}

          {/* Scheduling Card */}
          <Link
            href="/scheduler"
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-shadow p-6 group"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                <Calendar className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Scheduling Polls</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                Find the best meeting times with students and preceptors.
              </p>
              <div className="flex flex-wrap justify-center gap-2 text-xs">
                <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">Create Polls</span>
                <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">View Results</span>
              </div>
            </div>
          </Link>

          {/* Tasks Card */}
          <Link
            href="/tasks"
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-shadow p-6 group"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-amber-200 dark:group-hover:bg-amber-900/50 transition-colors">
                <CheckSquare className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Tasks</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                Assign and track tasks between instructors.
              </p>
              <div className="flex flex-wrap justify-center gap-2 text-xs">
                <span className="px-2 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">Assign</span>
                <span className="px-2 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">Track</span>
                <span className="px-2 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">Comment</span>
              </div>
            </div>
          </Link>

          {/* Part-Timer Scheduling Card */}
          <Link
            href="/scheduling"
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-shadow p-6 group"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-cyan-100 dark:bg-cyan-900/30 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-cyan-200 dark:group-hover:bg-cyan-900/50 transition-colors">
                <Clock className="w-8 h-8 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Part-Timer Scheduling</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                Set availability and sign up for open shifts.
              </p>
              <div className="flex flex-wrap justify-center gap-2 text-xs">
                <span className="px-2 py-1 bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 rounded-full">Availability</span>
                <span className="px-2 py-1 bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 rounded-full">Shifts</span>
                <span className="px-2 py-1 bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 rounded-full">Sign Up</span>
              </div>
            </div>
          </Link>

          {/* Unified Calendar Card */}
          <Link
            href="/calendar"
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-shadow p-6 group"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-rose-200 dark:group-hover:bg-rose-900/50 transition-colors">
                <CalendarDays className="w-8 h-8 text-rose-600 dark:text-rose-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Calendar</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                Unified view of lab days, open shifts, and coverage needs.
              </p>
              <div className="flex flex-wrap justify-center gap-2 text-xs">
                <span className="px-2 py-1 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-full">Lab Days</span>
                <span className="px-2 py-1 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-full">Shifts</span>
                <span className="px-2 py-1 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-full">Coverage</span>
              </div>
            </div>
          </Link>

          {/* Onboarding Card - For admin/superadmin or users with active onboarding */}
          {hasOnboarding && (
            <Link
              href="/onboarding"
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-shadow p-6 group border-2 border-indigo-200 dark:border-indigo-800"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/50 transition-colors">
                  <BookOpen className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Onboarding</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  {currentUser && canAccessAdmin(currentUser.role)
                    ? 'Manage instructor onboarding assignments and progress.'
                    : 'Track your onboarding progress and complete required tasks.'}
                </p>
                <div className="flex flex-wrap justify-center gap-2 text-xs">
                  <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full">Tasks</span>
                  <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full">Progress</span>
                  <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full">Tracks</span>
                </div>
              </div>
            </Link>
          )}

          {/* Clinical & Internship Card - Only for lead_instructor+ */}
          {currentUser && canAccessClinical(currentUser.role) && (
            <Link
              href="/clinical"
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-shadow p-6 group border-2 border-teal-200 dark:border-teal-800"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-teal-100 dark:bg-teal-900/30 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-teal-200 dark:group-hover:bg-teal-900/50 transition-colors">
                  <Briefcase className="w-8 h-8 text-teal-600 dark:text-teal-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Clinical & Internship</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  Track internships, preceptors, and field placements.
                </p>
                <div className="flex flex-wrap justify-center gap-2 text-xs">
                  <span className="px-2 py-1 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded-full">Internships</span>
                  <span className="px-2 py-1 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded-full">Preceptors</span>
                  <span className="px-2 py-1 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded-full">Meetings</span>
                </div>
              </div>
            </Link>
          )}

          {/* Admin Card - Only for admin+ */}
          {currentUser && canAccessAdmin(currentUser.role) && (
            <Link
              href="/admin"
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-shadow p-6 group border-2 border-red-200 dark:border-red-800"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-red-200 dark:group-hover:bg-red-900/50 transition-colors">
                  <Settings className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Admin Settings</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  Manage users, roles, and system settings.
                </p>
                <div className="flex flex-wrap justify-center gap-2 text-xs">
                  <span className="px-2 py-1 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">Users</span>
                  <span className="px-2 py-1 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">Guests</span>
                  <span className="px-2 py-1 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">Settings</span>
                </div>
              </div>
            </Link>
          )}
        </div>
        </ErrorBoundary>
        </PageErrorBoundary>
      </main>

      {/* Customize Modal */}
      <CustomizeModal
        isOpen={showCustomize}
        onClose={() => setShowCustomize(false)}
        widgets={preferences?.dashboard_widgets || []}
        quickLinks={preferences?.quick_links || []}
        onSave={handleSavePreferences}
        onReset={handleResetPreferences}
      />

      {/* Footer */}
      <footer className="mt-12 py-6 text-center text-sm text-gray-500 dark:text-gray-400 print:hidden">
        <p>PMI Paramedic Tools © {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
