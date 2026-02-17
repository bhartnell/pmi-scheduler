'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Settings } from 'lucide-react';
import LabHeader from '@/components/LabHeader';
import { canManageContent } from '@/lib/permissions';
import CustomizeModal from '@/components/dashboard/CustomizeModal';
import {
  NotificationsWidget,
  MyLabsWidget,
  QuickLinksWidget,
  NeedsAttentionWidget,
  OverviewStatsWidget,
  OpenStationsWidget,
  RecentFeedbackWidget,
  ROLE_DEFAULTS,
} from '@/components/dashboard/widgets';
import type { CurrentUserMinimal } from '@/types';

interface CurrentUser extends CurrentUserMinimal {
  name?: string;
}

interface DashboardPreferences {
  dashboard_widgets: string[];
  quick_links: string[];
}

export default function LabManagementDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [preferences, setPreferences] = useState<DashboardPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCustomize, setShowCustomize] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchUserAndPreferences();
    }
  }, [session]);

  const fetchUserAndPreferences = async () => {
    try {
      // Fetch user and preferences in parallel
      const [userRes, prefsRes] = await Promise.all([
        fetch('/api/instructor/me'),
        fetch('/api/user/preferences'),
      ]);

      const userData = await userRes.json();
      const prefsData = await prefsRes.json();

      if (userData.success && userData.user) {
        setCurrentUser(userData.user);
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
    } catch (error) {
      console.error('Error fetching user/preferences:', error);
    } finally {
      setLoading(false);
    }
  };

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
      // Fetch fresh defaults
      const prefsRes = await fetch('/api/user/preferences');
      const prefsData = await prefsRes.json();
      if (prefsData.success) {
        setPreferences(prefsData.preferences);
      }
    } catch (error) {
      console.error('Error resetting preferences:', error);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  const canManage = currentUser && canManageContent(currentUser.role);
  const widgets = preferences?.dashboard_widgets || ['notifications', 'my_labs', 'quick_links'];
  const quickLinks = preferences?.quick_links || ['scenarios', 'students', 'schedule'];

  // Get first name for greeting
  const firstName = session.user?.name?.split(' ')[0] || 'there';

  // Render a widget by ID
  const renderWidget = (widgetId: string) => {
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
      default:
        return null;
    }
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
        {/* Welcome Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Welcome, {firstName}!
          </h2>
          <button
            onClick={() => setShowCustomize(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Customize
          </button>
        </div>

        {/* Widget Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {widgets.map(widgetId => renderWidget(widgetId))}
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
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* Customize Modal */}
      <CustomizeModal
        isOpen={showCustomize}
        onClose={() => setShowCustomize(false)}
        widgets={widgets}
        quickLinks={quickLinks}
        onSave={handleSavePreferences}
        onReset={handleResetPreferences}
      />
    </div>
  );
}
