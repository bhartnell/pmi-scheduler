'use client';

import React, { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3,
  Users,
  GraduationCap,
  BookOpen,
  Hospital,
  Home,
  ChevronRight,
  FileBarChart,
  ClipboardList,
  TrendingUp,
  Calendar,
  Target,
  Briefcase,
} from 'lucide-react';

interface ReportLink {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const REPORT_SECTIONS: { heading: string; reports: ReportLink[] }[] = [
  {
    heading: 'Analytics Dashboards',
    reports: [
      {
        title: 'Program Overview',
        description: 'Student counts, lab activity, top scenarios, and skill pass rates across programs.',
        href: '/reports/program-overview',
        icon: BarChart3,
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      },
      {
        title: 'Instructor Analytics',
        description: 'Teaching hours, evaluation volume, and workload distribution per instructor.',
        href: '/reports/instructor-analytics',
        icon: Users,
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-100 dark:bg-green-900/30',
      },
      {
        title: 'Student Progress',
        description: 'Attendance, skill completion, clinical hours, and at-risk identification by cohort.',
        href: '/reports/student-dashboard',
        icon: GraduationCap,
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-100 dark:bg-purple-900/30',
      },
      {
        title: 'Scenario Usage',
        description: 'Scenario usage counts, difficulty distribution, and category coverage.',
        href: '/reports/scenario-usage-overview',
        icon: BookOpen,
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-100 dark:bg-orange-900/30',
      },
      {
        title: 'Clinical Placements',
        description: 'Clinical site utilization, student hours by site, and internship pipeline.',
        href: '/reports/clinical-placements',
        icon: Hospital,
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-100 dark:bg-red-900/30',
      },
    ],
  },
  {
    heading: 'Existing Reports',
    reports: [
      {
        title: 'Attendance Report',
        description: 'Detailed attendance records with status tracking per cohort.',
        href: '/reports/attendance',
        icon: Calendar,
        color: 'text-cyan-600 dark:text-cyan-400',
        bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
      },
      {
        title: 'Scenario Analytics',
        description: 'Pass rates and difficulty calibration for all assessed scenarios.',
        href: '/reports/scenario-analytics',
        icon: Target,
        color: 'text-violet-600 dark:text-violet-400',
        bgColor: 'bg-violet-100 dark:bg-violet-900/30',
      },
      {
        title: 'Instructor Workload',
        description: 'Lab day assignments and teaching hours per instructor.',
        href: '/reports/instructor-workload',
        icon: Briefcase,
        color: 'text-teal-600 dark:text-teal-400',
        bgColor: 'bg-teal-100 dark:bg-teal-900/30',
      },
      {
        title: 'Gradebook',
        description: 'Student grades and assessment results.',
        href: '/reports/gradebook',
        icon: ClipboardList,
        color: 'text-amber-600 dark:text-amber-400',
        bgColor: 'bg-amber-100 dark:bg-amber-900/30',
      },
      {
        title: 'Cohort Comparison',
        description: 'Compare metrics across multiple cohorts.',
        href: '/reports/cohort-comparison',
        icon: TrendingUp,
        color: 'text-indigo-600 dark:text-indigo-400',
        bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
      },
      {
        title: 'Program Outcomes',
        description: 'Program-level outcomes and completion metrics.',
        href: '/reports/program-outcomes',
        icon: FileBarChart,
        color: 'text-pink-600 dark:text-pink-400',
        bgColor: 'bg-pink-100 dark:bg-pink-900/30',
      },
    ],
  },
];

export default function ReportsHubPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

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
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">Reports</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <FileBarChart className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Reports & Analytics
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Program dashboards, instructor metrics, student progress, and more
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-10">
        {REPORT_SECTIONS.map((section) => (
          <div key={section.heading}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {section.heading}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.reports.map((report) => {
                const Icon = report.icon;
                return (
                  <Link
                    key={report.href}
                    href={report.href}
                    className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 hover:shadow-md transition-all hover:-translate-y-0.5"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-lg ${report.bgColor} flex-shrink-0`}>
                        <Icon className={`w-5 h-5 ${report.color}`} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {report.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                          {report.description}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
