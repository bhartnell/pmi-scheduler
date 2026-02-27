'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  BarChart3,
  ClipboardList,
  User,
  Clock,
  Briefcase,
  Users,
  UserCheck,
  FileText,
  TrendingUp,
  GitCompare,
  Activity,
  CalendarCheck,
  BookOpen,
} from 'lucide-react';
import { canAccessClinical, type Role } from '@/lib/permissions';

interface ReportCard {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  color: string;
  bgColor: string;
  requiresClinical?: boolean;
  comingSoon?: boolean;
}

export default function ReportsIndexPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [userRole, setUserRole] = useState<Role | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetch('/api/instructor/me')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.user) {
            setUserRole(data.user.role);
          }
        })
        .catch(console.error);
    }
  }, [session]);

  const reports: ReportCard[] = [
    {
      id: 'lab-progress',
      title: 'Lab Progress',
      description: 'View cohort progress: scenarios, skills, attendance, and overall performance.',
      icon: ClipboardList,
      href: '/lab-management/reports/lab-progress',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      id: 'student-progress',
      title: 'Student Progress',
      description: 'Individual student report: grades, skills, team lead history, and trends.',
      icon: User,
      href: '/lab-management/reports/student-progress',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      id: 'clinical-hours',
      title: 'Clinical Hours',
      description: 'Hours by department and site. Track progress toward requirements.',
      icon: Clock,
      href: '/lab-management/reports/clinical-hours',
      color: 'text-teal-600 dark:text-teal-400',
      bgColor: 'bg-teal-100 dark:bg-teal-900/30',
      requiresClinical: true,
    },
    {
      id: 'internship-status',
      title: 'Internship Status',
      description: 'Placement status, agency assignments, preceptors, and progress.',
      icon: Briefcase,
      href: '/lab-management/reports/internship-status',
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
      requiresClinical: true,
    },
    {
      id: 'team-leads',
      title: 'Team Lead Rotations',
      description: 'Who has led, how often, and who needs more opportunities.',
      icon: Users,
      href: '/lab-management/reports/team-leads',
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    },
    {
      id: 'onboarding-status',
      title: 'Onboarding Status',
      description: 'New instructor onboarding task progress and completion.',
      icon: UserCheck,
      href: '/lab-management/reports/onboarding-status',
      color: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
    },
    {
      id: 'instructor-workload',
      title: 'Instructor Workload',
      description: 'Compare lab assignments, hours, and workload distribution across instructors.',
      icon: TrendingUp,
      href: '/reports/instructor-workload',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      id: 'availability-patterns',
      title: 'Availability Patterns',
      description: 'Day-of-week distribution, submission consistency, coverage gaps, and monthly trends.',
      icon: Activity,
      href: '/reports/availability-patterns',
      color: 'text-violet-600 dark:text-violet-400',
      bgColor: 'bg-violet-100 dark:bg-violet-900/30',
    },
    {
      id: 'cohort-comparison',
      title: 'Cohort Comparison',
      description: 'Side-by-side skills, scenarios, clinical hours, and overall completion across cohorts.',
      icon: GitCompare,
      href: '/reports/cohort-comparison',
      color: 'text-cyan-600 dark:text-cyan-400',
      bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
    },
    {
      id: 'scenario-analytics',
      title: 'Scenario Analytics',
      description: 'Pass rates, difficulty indicators, and performance data for each scenario.',
      icon: BarChart3,
      href: '/reports/scenario-analytics',
      color: 'text-rose-600 dark:text-rose-400',
      bgColor: 'bg-rose-100 dark:bg-rose-900/30',
    },
    {
      id: 'scenario-usage',
      title: 'Scenario Usage',
      description: 'Which scenarios are used most, frequency by cohort, and usage trends.',
      icon: BookOpen,
      href: '/reports/scenario-usage',
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    },
    {
      id: 'attendance',
      title: 'Attendance Report',
      description: 'Lab attendance rates, absences, and tardiness trends across cohorts.',
      icon: CalendarCheck,
      href: '/reports/attendance',
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    },
  ];

  // Filter reports based on user role
  const visibleReports = reports.filter(report => {
    if (report.requiresClinical && userRole && !canAccessClinical(userRole)) {
      return false;
    }
    return true;
  });

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">
              Lab Management
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span>Reports</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
              <p className="text-gray-600 dark:text-gray-400">Generate and export reports for students, labs, and clinical activities</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleReports.map((report) => {
            const Icon = report.icon;

            if (report.comingSoon) {
              return (
                <div
                  key={report.id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 opacity-60 cursor-not-allowed"
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${report.bgColor}`}>
                      <Icon className={`w-6 h-6 ${report.color}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{report.title}</h3>
                        <span className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                          Coming Soon
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{report.description}</p>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <Link
                key={report.id}
                href={report.href}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 group"
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${report.bgColor} group-hover:scale-105 transition-transform`}>
                    <Icon className={`w-6 h-6 ${report.color}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {report.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{report.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Export Info */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-800 dark:text-blue-300">Export Options</h3>
              <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                All reports can be exported to PDF or Excel, or printed directly from your browser.
                Each report shows the generation date and who created it.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
