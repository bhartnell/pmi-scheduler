'use client';

import Link from 'next/link';
import {
  BookOpen,
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
    href: '/lab-management/scenarios',
    icon: BookOpen,
    label: 'Scenarios',
    color: 'bg-purple-500',
  },
  students: {
    href: '/lab-management/students',
    icon: Users,
    label: 'Students',
    color: 'bg-green-500',
  },
  schedule: {
    href: '/lab-management/schedule',
    icon: Calendar,
    label: 'Schedule',
    color: 'bg-blue-500',
  },
  emt_tracker: {
    href: '/lab-management/emt-tracker',
    icon: Clipboard,
    label: 'EMT Tracker',
    color: 'bg-orange-500',
  },
  aemt_tracker: {
    href: '/lab-management/aemt-tracker',
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
    href: '/lab-management/admin',
    icon: Settings,
    label: 'Admin',
    color: 'bg-gray-500',
  },
  feedback: {
    href: '/lab-management/admin/feedback',
    icon: MessageSquare,
    label: 'Feedback',
    color: 'bg-pink-500',
  },
  my_certs: {
    href: '/lab-management/my-certifications',
    icon: Award,
    label: 'My Certs',
    color: 'bg-yellow-500',
  },
  learning_styles: {
    href: '/lab-management/seating/learning-styles',
    icon: Brain,
    label: 'Learning',
    color: 'bg-cyan-500',
  },
  cohorts: {
    href: '/lab-management/admin/cohorts',
    icon: Users,
    label: 'Cohorts',
    color: 'bg-teal-500',
  },
  lab_days: {
    href: '/lab-management/schedule',
    icon: Calendar,
    label: 'Lab Days',
    color: 'bg-sky-500',
  },
  skill_sheets: {
    href: '/lab-management/skill-sheets',
    icon: FileText,
    label: 'Skill Sheets',
    color: 'bg-lime-500',
  },
  reports: {
    href: '/lab-management/reports',
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
