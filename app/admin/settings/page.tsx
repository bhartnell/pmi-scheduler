'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Settings,
  Shield,
  AlertTriangle,
  Database,
  RefreshCw,
  Trash2,
  Download,
  Mail,
  Bell
} from 'lucide-react';
import { PROTECTED_SUPERADMINS } from '@/lib/permissions';
import { PageLoader } from '@/components/ui';
import type { CurrentUserMinimal, Role } from '@/types';

interface CurrentUser extends CurrentUserMinimal {
  email: string;
}

interface SystemStats {
  users: number;
  scenarios: number;
  students: number;
  labDays: number;
  certifications: number;
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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
        // Only superadmins can access settings
        if (data.user.role !== 'superadmin') {
          router.push('/admin');
          return;
        }
        setCurrentUser(data.user);
        fetchStats();
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
    setLoading(false);
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  if (status === 'loading' || loading) {
    return <PageLoader />;
  }

  if (!session || !currentUser) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/admin" className="hover:text-blue-600 dark:hover:text-blue-400">Admin</Link>
            <ChevronRight className="w-4 h-4" />
            <span>Settings</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <Settings className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">System Settings</h1>
              <p className="text-gray-600 dark:text-gray-400">Superadmin configuration options</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Superadmin Warning */}
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-400">
            <Shield className="w-5 h-5" />
            <span className="font-medium">Superadmin Access Only</span>
          </div>
          <p className="text-sm text-red-700 dark:text-red-500 mt-1">
            Changes made here affect the entire system. Please exercise caution.
          </p>
        </div>

        {/* System Stats */}
        {stats && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <Database className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">System Statistics</h2>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.users}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Users</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.scenarios}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Scenarios</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.students}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Students</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.labDays}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Lab Days</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.certifications}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Certifications</p>
              </div>
            </div>
          </div>
        )}

        {/* Email & Notification Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <Mail className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Email & Notifications</h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">System Email Provider</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Resend is configured and active</p>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                Active
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Notification Categories</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Task assignments, clinical visits, scheduling, system alerts</p>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">4 categories</span>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-sm"
              >
                <Bell className="w-4 h-4" />
                Manage personal notification preferences
              </Link>
            </div>
          </div>
        </div>

        {/* Protected Accounts */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <Shield className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Protected Accounts</h2>
          </div>
          <div className="p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              These accounts have permanent superadmin status and cannot be modified or deleted.
            </p>
            <div className="space-y-2">
              {PROTECTED_SUPERADMINS.map(email => (
                <div key={email} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <Shield className="w-4 h-4 text-red-500 dark:text-red-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{email}</span>
                  <span className="ml-auto text-xs text-gray-500 dark:text-gray-500">Protected</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border-2 border-red-200 dark:border-red-800">
          <div className="px-4 py-3 border-b border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h2 className="font-semibold text-red-900 dark:text-red-400">Danger Zone</h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Export Data</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Download all system data as JSON</p>
              </div>
              <button
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                onClick={() => showToast('Export feature coming soon', 'success')}
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>

            <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Clear Expired Sessions</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Remove expired guest access entries</p>
              </div>
              <button
                className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded hover:bg-yellow-200 dark:hover:bg-yellow-900/50"
                onClick={() => showToast('Cleanup feature coming soon', 'success')}
              >
                <RefreshCw className="w-4 h-4" />
                Clean Up
              </button>
            </div>

            <div className="flex items-center justify-between p-3 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20">
              <div>
                <h3 className="font-medium text-red-900 dark:text-red-400">Purge Old Data</h3>
                <p className="text-sm text-red-700 dark:text-red-500">Permanently delete data older than 2 years</p>
              </div>
              <button
                className="flex items-center gap-2 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
                onClick={() => showToast('This action is disabled for safety', 'error')}
              >
                <Trash2 className="w-4 h-4" />
                Purge
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
