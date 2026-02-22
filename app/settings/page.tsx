'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import {
  Home,
  Settings,
  Bell,
  Mail,
  User,
  ChevronRight
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import EmailSettingsPanel from '@/components/EmailSettingsPanel';
import { useToast } from '@/components/Toast';

function SettingsPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'notifications' | 'email' | 'profile'>('notifications');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  // Check for tab in URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'email' || tab === 'notifications' || tab === 'profile') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  const tabs = [
    { id: 'notifications', label: 'In-App Notifications', icon: Bell },
    { id: 'email', label: 'Email Notifications', icon: Mail },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 text-blue-900 dark:text-blue-400 hover:text-blue-700">
                <div className="w-10 h-10 bg-blue-900 dark:bg-blue-700 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">PMI</span>
                </div>
                <div className="hidden sm:block">
                  <div className="font-bold text-lg leading-tight dark:text-white">PMI Paramedic Tools</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Settings</div>
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:block">
                {session.user?.email}
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
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">Settings</span>
          </div>

          {/* Title */}
          <div className="flex items-center gap-3">
            <Settings className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors flex-1 justify-center ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.id === 'notifications' ? 'In-App' : 'Email'}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'notifications' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            <div className="px-6 py-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-600" />
                In-App Notification Preferences
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Choose which types of notifications appear in your notification bell
              </p>
            </div>
            <div className="p-6">
              <InAppNotificationSettings />
            </div>
          </div>
        )}

        {activeTab === 'email' && (
          <EmailSettingsPanel />
        )}
      </main>
    </div>
  );
}

// Component to manage in-app notification category preferences
function InAppNotificationSettings() {
  const toast = useToast();
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    tasks: true,
    labs: true,
    scheduling: true,
    feedback: true,
    clinical: true,
    system: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const CATEGORIES = [
    { id: 'tasks', label: 'Tasks', description: 'Task assignments and completions' },
    { id: 'labs', label: 'Labs & Schedule', description: 'Lab assignments and reminders' },
    { id: 'scheduling', label: 'Shift Scheduling', description: 'Shift availability and confirmations' },
    { id: 'feedback', label: 'Feedback & Bugs', description: 'Feedback report updates' },
    { id: 'clinical', label: 'Clinical', description: 'Clinical hours and compliance' },
    { id: 'system', label: 'System', description: 'Account and system updates' },
  ];

  useEffect(() => {
    fetchPrefs();
  }, []);

  const fetchPrefs = async () => {
    try {
      const res = await fetch('/api/notifications/preferences');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.preferences) {
          setPrefs(data.preferences);
        }
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    }
    setLoading(false);
  };

  const handleToggle = async (category: string) => {
    const newPrefs = { ...prefs, [category]: !prefs[category] };
    setPrefs(newPrefs);
    setSaving(true);

    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPrefs),
      });
      if (res.ok) {
        toast.success('Settings saved');
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      // Revert on error
      setPrefs(prefs);
      toast.error('Failed to save settings');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {CATEGORIES.map((cat) => (
        <label
          key={cat.id}
          className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
        >
          <div>
            <div className="font-medium text-gray-900 dark:text-white">{cat.label}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{cat.description}</div>
          </div>
          <div className="relative">
            <input
              type="checkbox"
              checked={prefs[cat.id] ?? true}
              onChange={() => handleToggle(cat.id)}
              disabled={saving}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-500 peer-checked:bg-blue-600"></div>
          </div>
        </label>
      ))}
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
        Changes are saved automatically
      </p>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <SettingsPageContent />
    </Suspense>
  );
}
