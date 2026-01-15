'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Briefcase,
  Users,
  Calendar,
  Building2,
  ClipboardList,
  Car,
  AlertTriangle,
  TrendingUp,
  Clock,
  FileCheck,
  BookOpen,
  LayoutDashboard
} from 'lucide-react';
import { canAccessClinical, type Role } from '@/lib/permissions';

interface DashboardStats {
  activePreceptors: number;
  totalAgencies: number;
  inPhase1: number;
  inPhase2: number;
  atRisk: number;
  totalInternships: number;
}

export default function ClinicalDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    activePreceptors: 0,
    totalAgencies: 0,
    inPhase1: 0,
    inPhase2: 0,
    atRisk: 0,
    totalInternships: 0,
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch current user
      const userRes = await fetch('/api/instructor/me');
      const userData = await userRes.json();
      if (userData.success && userData.user) {
        setUserRole(userData.user.role);

        // Check permission
        if (!canAccessClinical(userData.user.role)) {
          router.push('/');
          return;
        }
      }

      // Fetch stats
      const [preceptorsRes, agenciesRes, internshipsRes] = await Promise.all([
        fetch('/api/clinical/preceptors?activeOnly=true'),
        fetch('/api/clinical/agencies'),
        fetch('/api/clinical/internships'),
      ]);

      const preceptorsData = await preceptorsRes.json();
      const agenciesData = await agenciesRes.json();
      const internshipsData = await internshipsRes.json();

      const internships = internshipsData.internships || [];
      const inPhase1 = internships.filter((i: any) => i.current_phase === 'phase_1_mentorship').length;
      const inPhase2 = internships.filter((i: any) => i.current_phase === 'phase_2_evaluation').length;
      const atRisk = internships.filter((i: any) => i.status === 'at_risk').length;

      setStats({
        activePreceptors: preceptorsData.preceptors?.length || 0,
        totalAgencies: agenciesData.agencies?.length || 0,
        inPhase1,
        inPhase2,
        atRisk,
        totalInternships: internships.length,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span>Clinical & Internship</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
              <Briefcase className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clinical & Internship</h1>
              <p className="text-gray-600 dark:text-gray-400">Manage internships, preceptors, and field placements</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                <Users className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.activePreceptors}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Preceptors</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalAgencies}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Agencies</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.inPhase1}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">In Phase 1</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Clock className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.inPhase2}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">In Phase 2</div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Overview Dashboard - Primary */}
          <Link
            href="/clinical/overview"
            className="bg-gradient-to-br from-teal-500 to-cyan-600 dark:from-teal-600 dark:to-cyan-700 rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6 group md:col-span-2 lg:col-span-1"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/20 rounded-xl group-hover:bg-white/30 transition-colors">
                <LayoutDashboard className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-1">Overview Dashboard</h3>
                <p className="text-sm text-teal-100 mb-3">
                  See all priorities and what needs attention
                </p>
                <div className="flex items-center text-white text-sm font-medium">
                  View Dashboard
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </div>
          </Link>

          {/* Preceptors */}
          <Link
            href="/clinical/preceptors"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6 group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-teal-100 dark:bg-teal-900/30 rounded-xl group-hover:bg-teal-200 dark:group-hover:bg-teal-900/50 transition-colors">
                <Users className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Preceptor Directory</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  View and manage field training officers
                </p>
                <div className="flex items-center text-teal-600 dark:text-teal-400 text-sm font-medium">
                  {stats.activePreceptors} active preceptors
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </div>
          </Link>

          {/* Internship Tracker */}
          <Link
            href="/clinical/internships"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6 group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
                <ClipboardList className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Internship Tracker</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Track student progress through internship phases
                </p>
                <div className="flex items-center text-purple-600 dark:text-purple-400 text-sm font-medium">
                  {stats.totalInternships} students tracked
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </div>
          </Link>

          {/* Compliance Docs Tracker */}
          <Link
            href="/clinical/compliance"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6 group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">
                <FileCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Compliance Docs</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Track immunizations, clearances, and required documents
                </p>
                <div className="flex items-center text-green-600 dark:text-green-400 text-sm font-medium">
                  View tracker
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </div>
          </Link>

          {/* Clinical Hours Tracker */}
          <Link
            href="/clinical/hours"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6 group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Clinical Hours</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Track shifts and hours by department
                </p>
                <div className="flex items-center text-blue-600 dark:text-blue-400 text-sm font-medium">
                  View tracker
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </div>
          </Link>

          {/* mCE Module Tracker */}
          <Link
            href="/clinical/mce"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6 group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/50 transition-colors">
                <BookOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">mCE Modules</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Track continuing education module completion
                </p>
                <div className="flex items-center text-indigo-600 dark:text-indigo-400 text-sm font-medium">
                  View tracker
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </div>
          </Link>

          {/* Meetings - Coming Soon */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 opacity-60">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Meetings</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Schedule and track internship meetings
                </p>
                <span className="inline-block px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded-full">
                  Coming Soon
                </span>
              </div>
            </div>
          </div>

          {/* Ride Requests - Coming Soon */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 opacity-60">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                <Car className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Ride Requests</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Manage student field ride requests
                </p>
                <span className="inline-block px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded-full">
                  Coming Soon
                </span>
              </div>
            </div>
          </div>

          {/* Agencies - Coming Soon */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 opacity-60">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                <Building2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Agencies & Contacts</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  EMS agencies and hospital contacts
                </p>
                <span className="inline-block px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded-full">
                  Coming Soon
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Items (Placeholder) */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Action Items
          </h3>
          <div className="text-gray-500 dark:text-gray-400 text-sm">
            <p>Action items and alerts will appear here once internship tracking is enabled.</p>
            <ul className="mt-3 space-y-2">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full"></span>
                Overdue phase evaluations
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full"></span>
                Upcoming meetings this week
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full"></span>
                Pending ride requests
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
