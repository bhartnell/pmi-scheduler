'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Plus,
  FileText,
  BookOpen,
  ChevronRight,
  ClipboardList,
  Flag,
  Activity,
  MessageSquare,
  Users,
  Stethoscope,
  Zap,
  Layers,
  Monitor,
} from 'lucide-react';
import { PageLoader } from '@/components/ui';
import { hasMinRole, canManageContent } from '@/lib/permissions';
import { useEffectiveRole } from '@/hooks/useEffectiveRole';
import type { CurrentUser } from '@/types';
import Breadcrumbs from '@/components/Breadcrumbs';

export default function LabsPage() {
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
  const canManage = effectiveRole ? canManageContent(effectiveRole) : false;

  const tiles = [
    {
      title: 'Lab Schedule',
      description: 'View upcoming lab days and session details',
      href: '/labs/schedule',
      icon: Calendar,
      color: 'blue',
      show: true,
    },
    {
      title: 'Create Lab Day',
      description: 'Set up a new lab day with stations and scenarios',
      href: '/labs/schedule/new',
      icon: Plus,
      color: 'green',
      show: canManage,
    },
    {
      title: 'Lab Templates',
      description: 'Reusable lab day templates for quick setup',
      href: '/labs/templates',
      icon: FileText,
      color: 'indigo',
      show: canManage,
    },
    {
      title: 'Scenarios',
      description: 'Create and manage simulation scenarios',
      href: '/labs/scenarios',
      icon: BookOpen,
      color: 'purple',
      show: isInstructor,
    },
    {
      title: 'Scenario Library',
      description: 'Browse the shared scenario collection',
      href: '/labs/scenario-library',
      icon: Layers,
      color: 'violet',
      show: isInstructor,
    },
    {
      title: 'Skill Drills',
      description: 'Focused skill practice sessions',
      href: '/labs/skill-drills',
      icon: Zap,
      color: 'orange',
      show: isInstructor,
    },
    {
      title: 'Stations',
      description: 'Manage lab stations and equipment',
      // /labs/stations has no index page (only /log and /pool subroutes).
      // Pool is the station management view — matches this card's purpose.
      href: '/labs/stations/pool',
      icon: Monitor,
      color: 'teal',
      show: canManage,
    },
    {
      title: 'Student Groups',
      description: 'Manage lab rotation groups',
      href: '/labs/groups',
      icon: Users,
      color: 'cyan',
      show: isInstructor,
    },
    {
      title: 'Flags',
      description: 'Student performance flags and follow-ups',
      href: '/labs/flags',
      icon: Flag,
      color: 'red',
      show: isInstructor,
    },
    {
      title: 'EKG Warmup',
      description: 'EKG interpretation practice sessions',
      href: '/labs/ekg-warmup',
      icon: Activity,
      color: 'rose',
      show: isInstructor,
    },
    {
      title: 'Debrief Review',
      description: 'Post-lab debrief notes and feedback',
      href: '/labs/debrief-review',
      icon: MessageSquare,
      color: 'amber',
      show: isInstructor,
    },
    {
      title: 'Skill Sheets',
      description: 'Lab-specific skill evaluation sheets',
      href: '/labs/skill-sheets',
      icon: ClipboardList,
      color: 'emerald',
      show: isInstructor,
    },
    // Protocol Tracking removed from /labs 2026-04-18 — protocol tracking
    // lives in Platinum, not in this section. The route still exists for
    // any deep links but is not surfaced here.
  ];

  const colorMap: Record<string, { bg: string; icon: string; hoverBg: string }> = {
    blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', icon: 'text-blue-600 dark:text-blue-400', hoverBg: 'group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50' },
    green: { bg: 'bg-green-100 dark:bg-green-900/30', icon: 'text-green-600 dark:text-green-400', hoverBg: 'group-hover:bg-green-200 dark:group-hover:bg-green-900/50' },
    indigo: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', icon: 'text-indigo-600 dark:text-indigo-400', hoverBg: 'group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/50' },
    purple: { bg: 'bg-purple-100 dark:bg-purple-900/30', icon: 'text-purple-600 dark:text-purple-400', hoverBg: 'group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50' },
    violet: { bg: 'bg-violet-100 dark:bg-violet-900/30', icon: 'text-violet-600 dark:text-violet-400', hoverBg: 'group-hover:bg-violet-200 dark:group-hover:bg-violet-900/50' },
    orange: { bg: 'bg-orange-100 dark:bg-orange-900/30', icon: 'text-orange-600 dark:text-orange-400', hoverBg: 'group-hover:bg-orange-200 dark:group-hover:bg-orange-900/50' },
    teal: { bg: 'bg-teal-100 dark:bg-teal-900/30', icon: 'text-teal-600 dark:text-teal-400', hoverBg: 'group-hover:bg-teal-200 dark:group-hover:bg-teal-900/50' },
    cyan: { bg: 'bg-cyan-100 dark:bg-cyan-900/30', icon: 'text-cyan-600 dark:text-cyan-400', hoverBg: 'group-hover:bg-cyan-200 dark:group-hover:bg-cyan-900/50' },
    red: { bg: 'bg-red-100 dark:bg-red-900/30', icon: 'text-red-600 dark:text-red-400', hoverBg: 'group-hover:bg-red-200 dark:group-hover:bg-red-900/50' },
    rose: { bg: 'bg-rose-100 dark:bg-rose-900/30', icon: 'text-rose-600 dark:text-rose-400', hoverBg: 'group-hover:bg-rose-200 dark:group-hover:bg-rose-900/50' },
    amber: { bg: 'bg-amber-100 dark:bg-amber-900/30', icon: 'text-amber-600 dark:text-amber-400', hoverBg: 'group-hover:bg-amber-200 dark:group-hover:bg-amber-900/50' },
    emerald: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', icon: 'text-emerald-600 dark:text-emerald-400', hoverBg: 'group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900/50' },
    sky: { bg: 'bg-sky-100 dark:bg-sky-900/30', icon: 'text-sky-600 dark:text-sky-400', hoverBg: 'group-hover:bg-sky-200 dark:group-hover:bg-sky-900/50' },
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Breadcrumbs />

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Labs</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Lab scheduling, scenarios, skill drills, grading, and student tracking
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
