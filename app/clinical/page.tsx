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
  Building2,
  ClipboardList,
  TrendingUp,
  Clock,
  FileCheck,
  LayoutDashboard,
  GraduationCap,
  Hospital,
  Ambulance,
  CalendarDays,
  BarChart3,
  Shield,
  BookOpen,
} from 'lucide-react';
import { canAccessClinical, type Role } from '@/lib/permissions';

interface DashboardStats {
  activePreceptors: number;
  totalClinicalSites: number;
  totalInternshipAgencies: number;
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
    totalClinicalSites: 0,
    totalInternshipAgencies: 0,
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

      // Fetch stats — fetch clinical sites (hospitals) and internship agencies (EMS) separately
      const [preceptorsRes, clinicalSitesRes, internshipAgenciesRes, internshipsRes] = await Promise.all([
        fetch('/api/clinical/preceptors?activeOnly=true'),
        fetch('/api/clinical/agencies?type=hospital'),
        fetch('/api/clinical/agencies?type=ems'),
        fetch('/api/clinical/internships'),
      ]);

      const preceptorsData = await preceptorsRes.json();
      const clinicalSitesData = await clinicalSitesRes.json();
      const internshipAgenciesData = await internshipAgenciesRes.json();
      const internshipsData = await internshipsRes.json();

      const internships = internshipsData.internships || [];
      const inPhase1 = internships.filter((i: any) => i.current_phase === 'phase_1_mentorship').length;
      const inPhase2 = internships.filter((i: any) => i.current_phase === 'phase_2_evaluation').length;
      const atRisk = internships.filter((i: any) => i.status === 'at_risk').length;

      setStats({
        activePreceptors: preceptorsData.preceptors?.length || 0,
        totalClinicalSites: clinicalSitesData.agencies?.length || 0,
        totalInternshipAgencies: internshipAgenciesData.agencies?.length || 0,
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
                <Hospital className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalClinicalSites}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Clinical Sites</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Ambulance className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalInternshipAgencies}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Field Agencies</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.inPhase1 + stats.inPhase2}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">In Internship</div>
              </div>
            </div>
          </div>
        </div>

        {/* Sites & Agencies Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            Sites &amp; Agencies
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Clinical Sites */}
            <Link
              href="/clinical/agencies?type=hospital"
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6 group border-l-4 border-blue-500"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                  <Hospital className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Clinical Sites</h3>
                    <span className="px-2.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-sm font-medium rounded-full">
                      {stats.totalClinicalSites}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Hospitals and ERs where students complete clinical rotations
                  </p>
                  <div className="flex items-center text-blue-600 dark:text-blue-400 text-sm font-medium">
                    View clinical sites
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </div>
                </div>
              </div>
            </Link>

            {/* Internship Agencies */}
            <Link
              href="/clinical/agencies?type=ems"
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6 group border-l-4 border-orange-500"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl group-hover:bg-orange-200 dark:group-hover:bg-orange-900/50 transition-colors">
                  <Ambulance className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Internship Agencies</h3>
                    <span className="px-2.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-sm font-medium rounded-full">
                      {stats.totalInternshipAgencies}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Fire departments and ambulance services for field internships
                  </p>
                  <div className="flex items-center text-orange-600 dark:text-orange-400 text-sm font-medium">
                    View field agencies
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </div>
                </div>
              </div>
            </Link>
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

          {/* Cohort Manager - Secondary Prominent */}
          <Link
            href="/lab-management/admin/cohorts"
            className="bg-gradient-to-br from-purple-500 to-indigo-600 dark:from-purple-600 dark:to-indigo-700 rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6 group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/20 rounded-xl group-hover:bg-white/30 transition-colors">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-1">Cohort Manager</h3>
                <p className="text-sm text-purple-100 mb-3">
                  Manage cohorts, semesters, and dates
                </p>
                <div className="flex items-center text-white text-sm font-medium">
                  Manage Cohorts
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

          {/* EMT Tracking */}
          <Link
            href="/clinical/emt-tracking"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6 group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                <ClipboardList className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">EMT Tracking</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Track mCE, vax, ride-alongs, and vitals for EMT students
                </p>
                <div className="flex items-center text-blue-600 dark:text-blue-400 text-sm font-medium">
                  View tracker
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </div>
          </Link>

          {/* AEMT Tracking */}
          <Link
            href="/clinical/aemt-tracking"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6 group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
                <ClipboardList className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">AEMT Tracking</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Track mCE, vax, ride-alongs, clinicals, and vitals for AEMT students
                </p>
                <div className="flex items-center text-purple-600 dark:text-purple-400 text-sm font-medium">
                  View tracker
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </div>
          </Link>

          {/* Summative Evaluations */}
          <Link
            href="/clinical/summative-evaluations"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6 group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl group-hover:bg-orange-200 dark:group-hover:bg-orange-900/50 transition-colors">
                <ClipboardList className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Summative Evaluations</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Semester 4 final psychomotor scenarios
                </p>
                <div className="flex items-center text-orange-600 dark:text-orange-400 text-sm font-medium">
                  Manage evaluations
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </div>
          </Link>

          {/* Site Visits */}
          <Link
            href="/clinical/site-visits"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6 group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-cyan-100 dark:bg-cyan-900/30 rounded-xl group-hover:bg-cyan-200 dark:group-hover:bg-cyan-900/50 transition-colors">
                <Building2 className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Site Visits</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Log and track instructor visits to clinical sites
                </p>
                <div className="flex items-center text-cyan-600 dark:text-cyan-400 text-sm font-medium">
                  Log visit
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </div>
          </Link>

          {/* Planning Calendar */}
          <Link
            href="/clinical/planning-calendar"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6 group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/50 transition-colors">
                <CalendarDays className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Planning Calendar</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Track which days PMI has access to sites vs other schools
                </p>
                <div className="flex items-center text-indigo-600 dark:text-indigo-400 text-sm font-medium">
                  View calendar
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </div>
          </Link>

          {/* Site Capacity */}
          <Link
            href="/clinical/capacity"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6 group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-teal-100 dark:bg-teal-900/30 rounded-xl group-hover:bg-teal-200 dark:group-hover:bg-teal-900/50 transition-colors">
                <BarChart3 className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Site Capacity</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Monitor student placement limits and utilization across all sites
                </p>
                <div className="flex items-center text-teal-600 dark:text-teal-400 text-sm font-medium">
                  View capacity
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </div>
          </Link>

          {/* Compliance Tracker */}
          <Link
            href="/clinical/compliance-tracker"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6 group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-violet-100 dark:bg-violet-900/30 rounded-xl group-hover:bg-violet-200 dark:group-hover:bg-violet-900/50 transition-colors">
                <Shield className="w-6 h-6 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Compliance Tracker</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Track student compliance status across all clinical requirements
                </p>
                <div className="flex items-center text-violet-600 dark:text-violet-400 text-sm font-medium">
                  View tracker
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </div>
          </Link>

          {/* MCE Tracker */}
          <Link
            href="/clinical/mce"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6 group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-rose-100 dark:bg-rose-900/30 rounded-xl group-hover:bg-rose-200 dark:group-hover:bg-rose-900/50 transition-colors">
                <BookOpen className="w-6 h-6 text-rose-600 dark:text-rose-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">MCE Tracker</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Track mandatory continuing education hours for students
                </p>
                <div className="flex items-center text-rose-600 dark:text-rose-400 text-sm font-medium">
                  View tracker
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </div>
          </Link>

        </div>
      </main>
    </div>
  );
}
