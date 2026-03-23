'use client';

import Link from 'next/link';
import {
  BookOpen,
  BookOpenCheck,
  Users,
  Calendar,
  Settings,
  Award,
  Brain,
  MessageSquare,
  Clipboard,
  FileText,
  Stethoscope,
  GraduationCap,
  BarChart3,
  ClipboardCheck,
  Timer,
  ListTodo,
  Activity,
  type LucideIcon,
} from 'lucide-react';

// Available quick link definitions
export const QUICK_LINK_DEFINITIONS: Record<string, {
  href: string;
  icon: LucideIcon;
  label: string;
  color: string;
}> = {
  scenarios: {
    href: '/labs/scenarios',
    icon: BookOpen,
    label: 'Scenarios',
    color: 'bg-purple-500',
  },
  students: {
    href: '/academics/students',
    icon: Users,
    label: 'Students',
    color: 'bg-green-500',
  },
  schedule: {
    href: '/calendar',
    icon: Calendar,
    label: 'Calendar',
    color: 'bg-blue-500',
  },
  emt_tracker: {
    href: '/clinical/emt-tracking',
    icon: Clipboard,
    label: 'EMT Tracker',
    color: 'bg-orange-500',
  },
  aemt_tracker: {
    href: '/clinical/aemt-tracking',
    icon: Clipboard,
    label: 'AEMT Tracker',
    color: 'bg-amber-500',
  },
  clinical: {
    href: '/clinical',
    icon: Stethoscope,
    label: 'Clinical',
    color: 'bg-red-500',
  },
  internships: {
    href: '/clinical/internships',
    icon: GraduationCap,
    label: 'Internships',
    color: 'bg-indigo-500',
  },
  admin: {
    href: '/labs/admin',
    icon: Settings,
    label: 'Admin',
    color: 'bg-gray-500',
  },
  feedback: {
    href: '/admin/feedback',
    icon: MessageSquare,
    label: 'Feedback',
    color: 'bg-pink-500',
  },
  my_certs: {
    href: '/labs/my-certifications',
    icon: Award,
    label: 'My Certs',
    color: 'bg-yellow-500',
  },
  // learning_styles - archived, hidden from nav
  // learning_styles: {
  //   href: '/labs/seating/learning-styles',
  //   icon: Brain,
  //   label: 'Learning',
  //   color: 'bg-cyan-500',
  // },
  cohorts: {
    href: '/academics/cohorts',
    icon: Users,
    label: 'Cohorts',
    color: 'bg-teal-500',
  },
  lab_days: {
    href: '/labs/schedule',
    icon: Calendar,
    label: 'Lab Days',
    color: 'bg-sky-500',
  },
  skill_sheets: {
    href: '/academics/skill-sheets',
    icon: FileText,
    label: 'Skill Sheets',
    color: 'bg-lime-500',
  },
  reports: {
    href: '/reports',
    icon: BarChart3,
    label: 'Reports',
    color: 'bg-violet-500',
  },
  onboarding: {
    href: '/onboarding',
    icon: ClipboardCheck,
    label: 'Onboarding',
    color: 'bg-indigo-500',
  },
  todays_labs: {
    href: '/labs/schedule?today=true',
    icon: Timer,
    label: "Today's Labs",
    color: 'bg-emerald-500',
  },
  tasks: {
    href: '/tasks',
    icon: ListTodo,
    label: 'Tasks',
    color: 'bg-rose-500',
  },
  ekg_warmup: {
    href: '/labs/ekg-warmup',
    icon: Activity,
    label: 'EKG Warmup',
    color: 'bg-red-600',
  },
  case_studies: {
    href: '/cases',
    icon: BookOpenCheck,
    label: 'Case Studies',
    color: 'bg-orange-500',
  },
  lvfr_dashboard: {
    href: '/lvfr-aemt',
    icon: Stethoscope,
    label: 'LVFR AEMT',
    color: 'bg-red-600',
  },
  lvfr_calendar: {
    href: '/lvfr-aemt/calendar',
    icon: Calendar,
    label: 'LVFR Calendar',
    color: 'bg-red-500',
  },
  lvfr_scheduling: {
    href: '/lvfr-aemt/scheduling',
    icon: ClipboardCheck,
    label: 'LVFR Coverage',
    color: 'bg-red-400',
  },
  lvfr_pharm: {
    href: '/lvfr-aemt/pharm',
    icon: Award,
    label: 'LVFR Pharm',
    color: 'bg-red-500',
  },
};

interface QuickLinksWidgetProps {
  links?: string[]; // Array of link IDs from QUICK_LINK_DEFINITIONS
}

export default function QuickLinksWidget({ links }: QuickLinksWidgetProps) {
  // Default links if none provided
  const linkIds = links || ['scenarios', 'students', 'schedule', 'emt_tracker', 'clinical', 'admin'];

  const resolvedLinks = linkIds
    .map(id => QUICK_LINK_DEFINITIONS[id])
    .filter(Boolean);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">Quick Access</h3>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {resolvedLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex flex-col items-center p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-colors"
            >
              <div className={`p-2 rounded-full ${link.color} mb-2`}>
                <link.icon className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-medium text-gray-900 dark:text-white text-center">{link.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
