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
  UserPlus
} from 'lucide-react';
import { canAccessAdmin, getRoleLabel, getRoleBadgeClasses, type Role } from '@/lib/permissions';
import { ThemeToggle } from '@/components/ThemeToggle';

interface CurrentUser {
  id: string;
  role: Role;
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    if (session?.user?.email) {
      fetch('/api/instructor/me')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.user) {
            setCurrentUser(data.user);
          }
        })
        .catch(console.error);
    }
  }, [session]);

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700 dark:text-gray-300">Loading...</p>
        </div>
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

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Guest instructor?</p>
            <Link
              href="/guest"
              className="inline-flex items-center gap-2 px-4 py-2 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-lg transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Guest Access
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Logged in - show main menu
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
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
      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome, {session.user?.name?.split(' ')[0] || 'User'}!</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">What would you like to do today?</p>
        </div>

        {/* Main Navigation Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Lab Management Card */}
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

          {/* Instructor Portal Card */}
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

        {/* Quick Links */}
        <div className="mt-12 max-w-5xl mx-auto">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">Quick Links</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Link
              href="/lab-management/scenarios"
              className="flex flex-col items-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <FileText className="w-6 h-6 text-gray-600 dark:text-gray-400 mb-2" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Scenarios</span>
            </Link>
            <Link
              href="/lab-management/students"
              className="flex flex-col items-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <Users className="w-6 h-6 text-gray-600 dark:text-gray-400 mb-2" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Students</span>
            </Link>
            <Link
              href="/lab-management/schedule"
              className="flex flex-col items-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <Calendar className="w-6 h-6 text-gray-600 dark:text-gray-400 mb-2" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Lab Schedule</span>
            </Link>
            <Link
              href="/instructor/certifications"
              className="flex flex-col items-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <Award className="w-6 h-6 text-purple-600 dark:text-purple-400 mb-2" />
              <span className="text-sm text-gray-700 dark:text-gray-300">My Certs</span>
            </Link>
            <Link
              href="/lab-management/admin/cohorts"
              className="flex flex-col items-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <ClipboardList className="w-6 h-6 text-gray-600 dark:text-gray-400 mb-2" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Cohorts</span>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>PMI Paramedic Tools © {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
