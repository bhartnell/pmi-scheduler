import {
  CalendarDays,
  FlaskConical,
  Award,
  Users,
  GraduationCap,
  Stethoscope,
  BarChart3,
  Shield,
  UserCircle,
  Package,
  Printer,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';
import { hasMinRole, canAccessAdmin, type Role } from '@/lib/permissions';

// TRIM 6/7a-1: the nine sections of the nav regroup. Links point at today's
// hubs; 6/7b repoints them to the new section landings.

export interface HomeSectionChip {
  label: string;
  href: string;
}

export interface HomeSection {
  key: string;
  title: string;
  short: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon square (light + dark). */
  color: string;
  chips: HomeSectionChip[];
  /** Section visible to this role. Students see Student view and Me only. */
  visible: (role: Role | string) => boolean;
}

const instructorUp = (role: Role | string) => hasMinRole(role, 'instructor');

export const HOME_SECTIONS: HomeSection[] = [
  {
    key: 'schedule',
    title: 'Schedule',
    short: 'Schedule',
    description: 'Calendar, lab days, planner and availability.',
    href: '/calendar',
    icon: CalendarDays,
    color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    chips: [
      { label: 'Calendar', href: '/calendar' },
      { label: 'Lab days', href: '/labs/schedule' },
      { label: 'Planner', href: '/academics/planner' },
      { label: 'Workload', href: '/reports/instructor-workload' },
    ],
    visible: instructorUp,
  },
  {
    key: 'labs',
    title: 'Labs',
    short: 'Labs',
    description: 'Lab days, stations, scenarios and skill sheets.',
    href: '/labs',
    icon: FlaskConical,
    color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    chips: [
      { label: 'Lab schedule', href: '/labs/schedule' },
      { label: 'Scenarios', href: '/labs/scenarios' },
      { label: 'Skill sheets', href: '/skill-sheets' },
    ],
    visible: instructorUp,
  },
  {
    key: 'testing',
    title: 'Testing & certification',
    short: 'Testing',
    description: 'AHA ACLS and PALS, OSCE and exam scheduling.',
    href: '/labs/aha-hub',
    icon: Award,
    color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    chips: [
      { label: 'AHA Hub', href: '/labs/aha-hub' },
      { label: 'OSCE', href: '/osce' },
      { label: 'Exams', href: '/exam-scheduling' },
    ],
    visible: instructorUp,
  },
  {
    key: 'cohorts',
    title: 'Cohorts',
    short: 'Cohorts',
    description: 'Cohorts, rosters, groups and student tracking.',
    href: '/academics/cohorts',
    icon: Users,
    color: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
    chips: [
      { label: 'Cohorts', href: '/academics/cohorts' },
      { label: 'Students', href: '/academics/students' },
      { label: 'Groups', href: '/labs/groups' },
    ],
    visible: instructorUp,
  },
  {
    key: 'student',
    title: 'Student view',
    short: 'Student view',
    description: 'What a student sees: dashboard and progress.',
    href: '/student',
    icon: GraduationCap,
    color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    chips: [
      { label: 'Dashboard', href: '/student' },
      { label: 'My progress', href: '/student/my-progress' },
    ],
    visible: () => true,
  },
  {
    key: 'clinical',
    title: 'Clinical',
    short: 'Clinical',
    description: 'Internships, site visits, preceptors and meetings.',
    href: '/clinical',
    icon: Stethoscope,
    color: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
    chips: [
      { label: 'Internships', href: '/clinical/internships' },
      { label: 'Site visits', href: '/clinical/site-visits' },
      { label: 'Meeting polls', href: '/scheduling/polls' },
    ],
    visible: instructorUp,
  },
  {
    key: 'reports',
    title: 'Reports',
    short: 'Reports',
    description: 'Every report in one list.',
    href: '/reports',
    icon: BarChart3,
    color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
    chips: [
      { label: 'All reports', href: '/reports' },
      { label: 'Instructor workload', href: '/reports/instructor-workload' },
    ],
    visible: instructorUp,
  },
  {
    key: 'admin',
    title: 'Admin',
    short: 'Admin',
    description: 'Users, roles, settings, audit log and feedback.',
    href: '/admin',
    icon: Shield,
    color: 'bg-slate-200 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300',
    chips: [
      { label: 'Users', href: '/admin/users' },
      { label: 'Settings', href: '/admin/settings' },
      { label: 'Feedback', href: '/admin/feedback' },
    ],
    visible: (role) => canAccessAdmin(role),
  },
  {
    key: 'me',
    title: 'Me',
    short: 'Me',
    description: 'My settings, notifications and tasks.',
    href: '/settings',
    icon: UserCircle,
    color: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
    chips: [
      { label: 'Settings', href: '/settings' },
      { label: 'Notifications', href: '/notifications' },
      { label: 'Tasks', href: '/tasks' },
    ],
    visible: () => true,
  },
];

export interface OpsHubLink {
  label: string;
  href: string;
  icon: LucideIcon;
  color: string;
}

// Same URLs the previous home page used for Josh's PMI Operations Hub.
export const OPS_HUB_LINKS: OpsHubLink[] = [
  { label: 'Inventory', href: 'https://pmi-ops.vercel.app/inventory', icon: Package, color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
  { label: 'Print Hub', href: 'https://pmi-ops.vercel.app/print-hub', icon: Printer, color: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400' },
  { label: 'Library', href: 'https://pmi-ops.vercel.app/library', icon: BookOpen, color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
  { label: 'Certifications', href: 'https://gridsquares.app/certifications', icon: Award, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
];

export function visibleSections(role: Role | string | null | undefined): HomeSection[] {
  if (!role) return [];
  return HOME_SECTIONS.filter((s) => s.visible(role));
}
