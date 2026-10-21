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
  type LucideIcon,
} from 'lucide-react';
import {
  canAccessAdmin,
  canAccessClinical,
  canAccessAffiliations,
  canAccessScheduling,
  hasMinRole,
} from '@/lib/permissions';

/**
 * The nine sections of the site, by function. Single source for the home top
 * bar and the home section tiles. Hrefs point at today's hubs; TRIM 6/7b
 * repoints them at the new section landings.
 */
export interface HomeSectionChip {
  label: string;
  href: string;
}

export interface HomeSection {
  key: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon square and chips, light + dark. */
  iconBg: string;
  chip: string;
  chips: HomeSectionChip[];
  visible: (role: string) => boolean;
}

const isInstructor = (role: string) => hasMinRole(role, 'instructor');

export const HOME_SECTIONS: HomeSection[] = [
  {
    key: 'schedule',
    label: 'Schedule',
    description: 'Calendar, lab days, planner and availability.',
    href: '/calendar',
    icon: CalendarDays,
    iconBg: 'bg-blue-600',
    chip: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    chips: [
      { label: 'Calendar', href: '/calendar' },
      { label: 'Planner', href: '/academics/planner' },
      { label: 'Availability', href: '/scheduling' },
    ],
    visible: (r) => isInstructor(r) || canAccessScheduling(r),
  },
  {
    key: 'labs',
    label: 'Labs',
    description: 'Lab days, stations, grading, scenarios and skill sheets.',
    href: '/labs',
    icon: FlaskConical,
    iconBg: 'bg-green-600',
    chip: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    chips: [
      { label: 'Lab days', href: '/labs/schedule' },
      { label: 'Scenarios', href: '/labs/scenarios' },
      { label: 'Open lab', href: '/admin/open-labs' },
    ],
    visible: isInstructor,
  },
  {
    key: 'testing',
    label: 'Testing & certification',
    description: 'ACLS, PALS, OSCE and written exam sessions.',
    href: '/labs/aha-hub',
    icon: Award,
    iconBg: 'bg-red-600',
    chip: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    chips: [
      { label: 'AHA', href: '/labs/aha-hub' },
      { label: 'OSCE', href: '/osce' },
      { label: 'Written exam', href: '/exam-scheduling' },
    ],
    visible: isInstructor,
  },
  {
    key: 'cohorts',
    label: 'Cohorts',
    description: 'Cohort overview, rosters, groups and seating charts.',
    href: '/academics',
    icon: Users,
    iconBg: 'bg-indigo-600',
    chip: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    chips: [
      { label: 'Cohorts', href: '/academics/cohorts' },
      { label: 'Students', href: '/academics/students' },
      { label: 'Seating', href: '/labs/seating' },
    ],
    visible: isInstructor,
  },
  {
    key: 'student',
    label: 'Student view',
    description: 'Student dashboard, progress, labs and evaluations.',
    href: '/student',
    icon: GraduationCap,
    iconBg: 'bg-amber-600',
    chip: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    chips: [
      { label: 'My progress', href: '/student/my-progress' },
      { label: 'Available labs', href: '/student/available-labs' },
      { label: 'Peer eval', href: '/student/peer-eval' },
    ],
    visible: (r) => r === 'student' || isInstructor(r),
  },
  {
    key: 'clinical',
    label: 'Clinical',
    description: 'Internships, site visits, preceptors and meeting polls.',
    href: '/clinical',
    icon: Stethoscope,
    iconBg: 'bg-teal-600',
    chip: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
    chips: [
      { label: 'Site visits', href: '/clinical/site-visits' },
      { label: 'Internships', href: '/clinical/internships' },
      { label: 'Polls', href: '/scheduling/polls' },
    ],
    visible: (r) => canAccessClinical(r) || canAccessAffiliations(r),
  },
  {
    key: 'reports',
    label: 'Reports',
    description: 'Every report in one list.',
    href: '/reports',
    icon: BarChart3,
    iconBg: 'bg-purple-600',
    chip: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    chips: [
      { label: 'Program overview', href: '/reports/program-overview' },
      { label: 'Instructor workload', href: '/reports/instructor-workload' },
      { label: 'Lab progress', href: '/reports/lab-progress' },
    ],
    visible: isInstructor,
  },
  {
    key: 'admin',
    label: 'Admin',
    description: 'Users, roles, semesters, exports and settings.',
    href: '/admin',
    icon: Shield,
    iconBg: 'bg-slate-600',
    chip: 'bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300',
    chips: [
      { label: 'Users', href: '/admin/users' },
      { label: 'Semesters', href: '/admin/semesters' },
      { label: 'Settings', href: '/admin/settings' },
    ],
    visible: canAccessAdmin,
  },
  {
    key: 'me',
    label: 'Me',
    description: 'Settings, notifications, my stats and tasks.',
    href: '/settings',
    icon: UserCircle,
    iconBg: 'bg-pink-600',
    chip: 'bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
    chips: [
      { label: 'Settings', href: '/settings' },
      { label: 'My stats', href: '/instructor/my-stats' },
      { label: 'Tasks', href: '/tasks' },
    ],
    visible: () => true,
  },
];

export function visibleSections(role: string | null | undefined): HomeSection[] {
  const r = role || 'guest';
  return HOME_SECTIONS.filter((s) => s.visible(r));
}

/** Josh's PMI Operations Hub links, unchanged from the previous home page. */
export const OPS_HUB_LINKS: { label: string; href: string }[] = [
  { label: 'Inventory', href: 'https://pmi-ops.vercel.app/inventory' },
  { label: 'Print Hub', href: 'https://pmi-ops.vercel.app/print-hub' },
  { label: 'Library', href: 'https://pmi-ops.vercel.app/library' },
  { label: 'Certifications', href: 'https://gridsquares.app/certifications' },
];
