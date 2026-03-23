'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Users,
  GraduationCap,
  ChevronRight,
  ClipboardList,
  BarChart3,
  FileText,
  Upload,
  BookOpen,
} from 'lucide-react';
import { PageLoader } from '@/components/ui';
import { hasMinRole } from '@/lib/permissions';
import { useEffectiveRole } from '@/hooks/useEffectiveRole';
import type { CurrentUser } from '@/types';
import Breadcrumbs from '@/components/Breadcrumbs';

export default function AcademicsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const effectiveRole = useEffectiveRole(currentUser?.role ?? null);

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
        setCurrentUser(data.user);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) return <PageLoader />;
  if (!session) return null;

  const isAdmin = effectiveRole ? hasMinRole(effectiveRole, 'admin') : false;
  const isInstructor = effectiveRole ? hasMinRole(effectiveRole, 'instructor') : false;

  const tiles = [
    {
      title: 'Semester Planner',
      description: 'Plan and manage semester schedules, rooms, and time blocks',
      href: '/academics/planner',
      icon: Calendar,
      color: 'blue',
      show: isInstructor,
    },
    {
      title: 'Course Templates',
      description: 'Create and manage reusable course templates',
      href: '/academics/planner/templates',
      icon: FileText,
      color: 'indigo',
      show: isAdmin,
    },
    {
      title: 'Instructor Workload',
      description: 'View and balance instructor teaching loads',
      href: '/academics/planner/workload',
      icon: BarChart3,
      color: 'purple',
      show: isAdmin,
    },
    {
      title: 'Cohort Manager',
      description: 'Manage student cohorts and class groups',
      href: '/academics/cohorts',
      icon: Users,
      color: 'green',
      show: isAdmin,
    },
    {
      title: 'Student Roster',
      description: 'View and manage enrolled students',
      href: '/academics/students',
      icon: GraduationCap,
      color: 'orange',
      show: isInstructor,
    },
    {
      title: 'Import Students',
      description: 'Bulk import students from CSV or spreadsheet',
      href: '/academics/students/import',
      icon: Upload,
      color: 'teal',
      show: isAdmin,
    },
    {
      title: 'Skill Sheet Library',
      description: 'Browse and manage skill evaluation sheets',
      href: '/academics/skill-sheets',
      icon: ClipboardList,
      color: 'cyan',
      show: isInstructor,
    },
    {
      title: 'Competency Tracking',
      description: 'Track student skill competency progress',
      href: '/academics/skill-sheets',
      icon: BookOpen,
      color: 'rose',
      show: isInstructor,
    },
  ];

  const colorMap: Record<string, { bg: string; icon: string; hoverBg: string }> = {
    blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', icon: 'text-blue-600 dark:text-blue-400', hoverBg: 'group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50' },
    indigo: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', icon: 'text-indigo-600 dark:text-indigo-400', hoverBg: 'group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/50' },
    purple: { bg: 'bg-purple-100 dark:bg-purple-900/30', icon: 'text-purple-600 dark:text-purple-400', hoverBg: 'group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50' },
    green: { bg: 'bg-green-100 dark:bg-green-900/30', icon: 'text-green-600 dark:text-green-400', hoverBg: 'group-hover:bg-green-200 dark:group-hover:bg-green-900/50' },
    orange: { bg: 'bg-orange-100 dark:bg-orange-900/30', icon: 'text-orange-600 dark:text-orange-400', hoverBg: 'group-hover:bg-orange-200 dark:group-hover:bg-orange-900/50' },
    teal: { bg: 'bg-teal-100 dark:bg-teal-900/30', icon: 'text-teal-600 dark:text-teal-400', hoverBg: 'group-hover:bg-teal-200 dark:group-hover:bg-teal-900/50' },
    cyan: { bg: 'bg-cyan-100 dark:bg-cyan-900/30', icon: 'text-cyan-600 dark:text-cyan-400', hoverBg: 'group-hover:bg-cyan-200 dark:group-hover:bg-cyan-900/50' },
    rose: { bg: 'bg-rose-100 dark:bg-rose-900/30', icon: 'text-rose-600 dark:text-rose-400', hoverBg: 'group-hover:bg-rose-200 dark:group-hover:bg-rose-900/50' },
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Breadcrumbs />

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Academics</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Semester planning, cohort management, student tracking, and skill evaluations
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tiles
            .filter((t) => t.show)
            .map((tile) => {
              const colors = colorMap[tile.color];
              const Icon = tile.icon;
              return (
                <Link
                  key={tile.href}
                  href={tile.href}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 group"
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 ${colors.bg} rounded-xl flex items-center justify-center ${colors.hoverBg} transition-colors`}>
                      <Icon className={`w-6 h-6 ${colors.icon}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{tile.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{tile.description}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                  </div>
                </Link>
              );
            })}
        </div>
      </div>
    </div>
  );
}
