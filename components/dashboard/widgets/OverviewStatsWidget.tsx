'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, BookOpen, Calendar, MessageSquare, BarChart3, Briefcase } from 'lucide-react';

/**
 * Role-aware dashboard overview tiles.
 *
 *   Tile 1 — Active Students (everyone)
 *   Tile 2 — "In Internship" (lead_instructor+) OR "Scenarios" (instructors)
 *            Swapped from the old static Scenarios-for-everyone because
 *            scenario count rarely changes and isn't actionable; internship
 *            count is the question admins actually ask at the dashboard.
 *   Tile 3 — Labs This Week (everyone)
 *   Tile 4 — "Open Feedback" (admin+) OR "Labs This Month" (others)
 *            Open Feedback is admin-only — instructors can't action feedback
 *            items, so showing them a number is noise.
 */

interface Stats {
  activeStudents: number;
  totalScenarios: number;
  labsThisWeek: number;
  labsThisMonth: number;
  openFeedback: number;
  inInternship: number;
}

interface StatItem {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  href: string;
}

type Role =
  | 'superadmin'
  | 'admin'
  | 'lead_instructor'
  | 'instructor'
  | 'volunteer_instructor'
  | 'agency_liaison'
  | 'agency_observer'
  | 'program_director'
  | 'student'
  | 'guest'
  | 'pending'
  | null;

const ROLE_LEVEL: Record<NonNullable<Role>, number> = {
  superadmin: 100,
  admin: 90,
  lead_instructor: 80,
  instructor: 60,
  volunteer_instructor: 40,
  agency_liaison: 30,
  agency_observer: 20,
  program_director: 50,
  student: 10,
  guest: 0,
  pending: 0,
};

function hasMinRole(role: Role, min: NonNullable<Role>): boolean {
  if (!role) return false;
  return (ROLE_LEVEL[role] ?? 0) >= (ROLE_LEVEL[min] ?? 0);
}

export default function OverviewStatsWidget() {
  const [stats, setStats] = useState<Stats>({
    activeStudents: 0,
    totalScenarios: 0,
    labsThisWeek: 0,
    labsThisMonth: 0,
    openFeedback: 0,
    inInternship: 0,
  });
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Resolve role first so we know which tiles to populate.
        const meRes = await fetch('/api/instructor/me');
        const meData = meRes.ok ? await meRes.json() : null;
        const myRole = (meData?.user?.role ?? null) as Role;
        setRole(myRole);

        const canAdmin = hasMinRole(myRole, 'admin');
        const canLead = hasMinRole(myRole, 'lead_instructor');

        const startOfWeek = getStartOfWeek();
        const endOfWeek = getEndOfWeek();
        const startOfMonth = getStartOfMonth();
        const endOfMonth = getEndOfMonth();

        const [studentsRes, labsWeekRes, labsMonthRes, scenariosRes, feedbackRes, internshipRes] =
          await Promise.all([
            fetch('/api/lab-management/students?status=active'),
            fetch(`/api/lab-management/lab-days?startDate=${startOfWeek}&endDate=${endOfWeek}`),
            fetch(`/api/lab-management/lab-days?startDate=${startOfMonth}&endDate=${endOfMonth}`),
            // Only instructors see Scenarios; skip the fetch for admin+
            canLead ? Promise.resolve(null) : fetch('/api/lab-management/scenarios'),
            // Only admins see Open Feedback
            canAdmin ? fetch('/api/feedback?status=new&limit=1') : Promise.resolve(null),
            // Only lead_instructor+ see In Internship
            canLead ? fetch('/api/dashboard/internship-count') : Promise.resolve(null),
          ]);

        const [studentsData, labsWeekData, labsMonthData, scenariosData, feedbackData, internshipData] =
          await Promise.all([
            studentsRes.json(),
            labsWeekRes.json(),
            labsMonthRes.json(),
            scenariosRes ? scenariosRes.json() : null,
            feedbackRes ? feedbackRes.json() : null,
            internshipRes ? internshipRes.json() : null,
          ]);

        setStats({
          activeStudents: studentsData.pagination?.total ?? studentsData.students?.length ?? 0,
          totalScenarios: scenariosData?.pagination?.total ?? scenariosData?.scenarios?.length ?? 0,
          labsThisWeek: labsWeekData.pagination?.total ?? labsWeekData.labDays?.length ?? 0,
          labsThisMonth: labsMonthData.pagination?.total ?? labsMonthData.labDays?.length ?? 0,
          openFeedback: feedbackData?.total ?? feedbackData?.totalCount ?? 0,
          inInternship: internshipData?.counts?.active ?? 0,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const canAdmin = hasMinRole(role, 'admin');
  const canLead = hasMinRole(role, 'lead_instructor');

  // Build tile list in a stable order: Students · [Internship|Scenarios] · Labs this week · [Feedback|Labs this month]
  const statItems: StatItem[] = [
    {
      label: 'Active Students',
      value: stats.activeStudents,
      icon: Users,
      color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
      href: '/academics/students',
    },
    canLead
      ? {
          label: 'In Internship',
          value: stats.inInternship,
          icon: Briefcase,
          color: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
          href: '/clinical/internships',
        }
      : {
          label: 'Scenarios',
          value: stats.totalScenarios,
          icon: BookOpen,
          color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
          href: '/labs/scenarios',
        },
    {
      label: 'Labs This Week',
      value: stats.labsThisWeek,
      icon: Calendar,
      color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      href: '/calendar',
    },
    canAdmin
      ? {
          label: 'Open Feedback',
          value: stats.openFeedback,
          icon: MessageSquare,
          color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
          href: '/admin/feedback',
        }
      : {
          label: 'Labs This Month',
          value: stats.labsThisMonth,
          icon: Calendar,
          color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
          href: '/calendar',
        },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Overview
        </h3>
      </div>
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {statItems.map(item => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer group"
              >
                <div className={`p-2 rounded-lg ${item.color}`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{item.value}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 group-hover:underline">{item.label}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getStartOfWeek(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day;
  const startOfWeek = new Date(now.setDate(diff));
  return startOfWeek.toISOString().split('T')[0];
}

function getEndOfWeek(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() + (6 - day);
  const endOfWeek = new Date(now.setDate(diff));
  return endOfWeek.toISOString().split('T')[0];
}

function getStartOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
}

function getEndOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
}
