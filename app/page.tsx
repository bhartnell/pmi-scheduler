'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
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
  BookOpen
} from 'lucide-react';

export default function HomePage() {
  const { data: session, status } = useSession();

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700">Loading...</p>
        </div>
      </div>
    );
  }

  // Not logged in - show sign in page
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Stethoscope className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">PMI Paramedic Tools</h1>
            <p className="text-gray-600 mt-2">Administrative tools for Pima Paramedic Institute</p>
          </div>
          
          <button
            onClick={() => signIn('google')}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <LogIn className="w-5 h-5" />
            Sign in with Google
          </button>
          
          <p className="text-center text-sm text-gray-500 mt-4">
            Use your @pmi.edu account to sign in
          </p>
        </div>
      </div>
    );
  }

  // Logged in - show main menu
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900">PMI Paramedic Tools</h1>
              <p className="text-sm text-gray-600">Pima Paramedic Institute</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 hidden sm:block">{session.user?.email}</span>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
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
          <h2 className="text-3xl font-bold text-gray-900">Welcome, {session.user?.name?.split(' ')[0] || 'User'}!</h2>
          <p className="text-gray-600 mt-2">What would you like to do today?</p>
        </div>

        {/* Main Navigation Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Lab Management Card */}
          <Link
            href="/lab-management"
            className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow p-6 group"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
                <GraduationCap className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Lab Management</h3>
              <p className="text-gray-600 text-sm mb-4">
                Manage lab schedules, scenarios, students, and assessments.
              </p>
              <div className="flex flex-wrap justify-center gap-2 text-xs">
                <span className="px-2 py-1 bg-green-50 text-green-700 rounded-full">Scenarios</span>
                <span className="px-2 py-1 bg-green-50 text-green-700 rounded-full">Students</span>
                <span className="px-2 py-1 bg-green-50 text-green-700 rounded-full">Grading</span>
              </div>
            </div>
          </Link>

          {/* Instructor Portal Card */}
          <Link
            href="/instructor"
            className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow p-6 group"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
                <Award className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Instructor Portal</h3>
              <p className="text-gray-600 text-sm mb-4">
                Track certifications, CE hours, and teaching activities.
              </p>
              <div className="flex flex-wrap justify-center gap-2 text-xs">
                <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-full">Certifications</span>
                <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-full">CE Tracker</span>
                <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-full">Teaching Log</span>
              </div>
            </div>
          </Link>

          {/* Scheduling Card */}
          <Link
            href="/scheduler"
            className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow p-6 group"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                <Calendar className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Scheduling Polls</h3>
              <p className="text-gray-600 text-sm mb-4">
                Find the best meeting times with students and preceptors.
              </p>
              <div className="flex flex-wrap justify-center gap-2 text-xs">
                <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full">Create Polls</span>
                <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full">View Results</span>
              </div>
            </div>
          </Link>
        </div>

        {/* Quick Links */}
        <div className="mt-12 max-w-5xl mx-auto">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">Quick Links</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Link
              href="/lab-management/scenarios"
              className="flex flex-col items-center p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <FileText className="w-6 h-6 text-gray-600 mb-2" />
              <span className="text-sm text-gray-700">Scenarios</span>
            </Link>
            <Link
              href="/lab-management/students"
              className="flex flex-col items-center p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <Users className="w-6 h-6 text-gray-600 mb-2" />
              <span className="text-sm text-gray-700">Students</span>
            </Link>
            <Link
              href="/lab-management/schedule"
              className="flex flex-col items-center p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <Calendar className="w-6 h-6 text-gray-600 mb-2" />
              <span className="text-sm text-gray-700">Lab Schedule</span>
            </Link>
            <Link
              href="/instructor/certifications"
              className="flex flex-col items-center p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <Award className="w-6 h-6 text-purple-600 mb-2" />
              <span className="text-sm text-gray-700">My Certs</span>
            </Link>
            <Link
              href="/lab-management/admin/cohorts"
              className="flex flex-col items-center p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <ClipboardList className="w-6 h-6 text-gray-600 mb-2" />
              <span className="text-sm text-gray-700">Cohorts</span>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 py-6 text-center text-sm text-gray-500">
        <p>PMI Paramedic Tools © {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
