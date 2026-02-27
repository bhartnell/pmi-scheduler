'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  HelpCircle,
  Search,
  Book,
  Users,
  Keyboard,
  Video,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Play,
  GraduationCap,
  Shield,
  Award,
  Settings,
  Bell,
  X,
  ArrowRight,
  Lightbulb,
  FileText,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Section {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

interface FaqItem {
  question: string;
  answer: string;
  category: string;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: string;
}

interface VideoPlaceholder {
  title: string;
  description: string;
  duration: string;
  category: string;
}

interface RoleFeature {
  feature: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Content Data
// ---------------------------------------------------------------------------

const SECTIONS: Section[] = [
  { id: 'getting-started', title: 'Getting Started', icon: Book, color: 'blue' },
  { id: 'roles', title: 'Features by Role', icon: Users, color: 'purple' },
  { id: 'faq', title: 'FAQ', icon: HelpCircle, color: 'amber' },
  { id: 'shortcuts', title: 'Keyboard Shortcuts', icon: Keyboard, color: 'green' },
  { id: 'videos', title: 'Video Tutorials', icon: Video, color: 'rose' },
  { id: 'report', title: 'Report an Issue', icon: MessageSquare, color: 'teal' },
];

const GETTING_STARTED_STEPS = [
  {
    step: 1,
    title: 'Sign In',
    description:
      'Navigate to the PMI Paramedic Tools site and click "Sign in with Google." Use your @pmi.edu or @my.pmi.edu account. Non-PMI accounts can request volunteer access via the Request Access link.',
    icon: Shield,
  },
  {
    step: 2,
    title: 'Explore the Dashboard',
    description:
      'After signing in, the home dashboard shows quick-access cards for all major sections: Lab Management, Instructor Portal, Scheduling, Clinical & Internship, and Admin. The dashboard also shows customizable widgets such as upcoming labs, notifications, and task summaries.',
    icon: Home,
  },
  {
    step: 3,
    title: 'Use the Command Palette',
    description:
      'Press Cmd+K (Mac) or Ctrl+K (Windows/Linux) at any time to open the command palette. You can quickly navigate to any section, search students, scenarios, tasks, and more — all from the keyboard.',
    icon: Search,
  },
  {
    step: 4,
    title: 'Customize Your Dashboard',
    description:
      'Click the "Customize" button on the dashboard to add, remove, or reorder widgets. Your layout is saved per-device and synced across sessions. Use "Reset" to restore the default layout for your role.',
    icon: Settings,
  },
  {
    step: 5,
    title: 'Check Notifications',
    description:
      'The bell icon in the header shows unread notifications. You will receive alerts for task assignments, certification expirations, scheduling updates, and clinical site visits. Manage your notification preferences at /settings.',
    icon: Bell,
  },
  {
    step: 6,
    title: 'Submit Feedback',
    description:
      'Use the blue Feedback button in the bottom-right corner of any page to report bugs, request features, or share general feedback. You can optionally attach a screenshot. The system automatically captures your page URL and browser info.',
    icon: MessageSquare,
  },
];

const ADMIN_FEATURES: RoleFeature[] = [
  { feature: 'User Management', description: 'Create, edit, and assign roles to all users at /admin/users. Manage guest instructors at /admin/guests.' },
  { feature: 'Role Assignment', description: 'Promote users between guest, user, instructor, lead_instructor, admin, and superadmin roles at /admin/roles.' },
  { feature: 'System Settings', description: 'Superadmins can access /admin/settings for system-wide configuration, protected accounts, and data export.' },
  { feature: 'Announcements', description: 'Post system-wide announcements at /admin/announcements that appear as banners on all user dashboards.' },
  { feature: 'Audit Log', description: 'Review sensitive system operations and user actions via the audit trail in admin settings.' },
  { feature: 'Reports', description: 'Access comprehensive reports for student progress, clinical hours, instructor workload, and lab analytics.' },
  { feature: 'Certification Compliance', description: 'Track certification expiry for all instructors at /admin/certifications and view compliance at /admin/certifications/compliance.' },
  { feature: 'Program Requirements', description: 'Configure program-wide requirements and pass thresholds at /admin/program-requirements.' },
  { feature: 'Access Requests', description: 'Approve or deny non-PMI instructor access requests at /admin/access-requests.' },
  { feature: 'Email Templates', description: 'Customize system email notifications at /admin/email-templates.' },
];

const INSTRUCTOR_FEATURES: RoleFeature[] = [
  { feature: 'Lab Schedule', description: 'Create and manage lab day schedules at /lab-management/schedule. Add stations, assign scenarios, and configure timers.' },
  { feature: 'Students', description: 'Manage the student roster at /lab-management/students. Add students, view progress, flag concerns, and track attendance.' },
  { feature: 'Scenarios', description: 'Build and maintain the scenario library at /lab-management/scenarios. Tag scenarios by category, difficulty, and skill requirements.' },
  { feature: 'Seating & Groups', description: 'Manage group assignments and seating charts at /lab-management/seating. The system can auto-assign groups based on learning style preferences.' },
  { feature: 'Cohort Management', description: 'Create and manage student cohorts at /lab-management/cohorts. Archive cohorts when they graduate.' },
  { feature: 'Grading', description: 'Grade station performance for students at /lab-management/grade/station/[id]. Results feed into student progress reports.' },
  { feature: 'Certifications', description: 'Track your personal certifications and CE hours at /instructor/certifications and /instructor/ce.' },
  { feature: 'Scheduling Polls', description: 'Create Doodle-style scheduling polls at /scheduler to find the best meeting time with students or preceptors.' },
  { feature: 'Part-Timer Scheduling', description: 'Set your availability and sign up for open shifts at /scheduling. Admins can view all availability at /scheduling/availability/all.' },
  { feature: 'Onboarding', description: 'Assign onboarding tracks to new instructors and monitor their progress at /onboarding.' },
  { feature: 'Tasks', description: 'Create, assign, and track tasks between instructors at /tasks. Tasks support comments, file attachments, and due dates.' },
  { feature: 'EKG Warm-Up', description: 'Run an EKG rhythm identification exercise at /lab-management/ekg-warmup for student warm-up activities.' },
];

const STUDENT_FEATURES: RoleFeature[] = [
  { feature: 'Student Portal', description: 'Access your personal dashboard at /student. View your assigned lab schedule, upcoming activities, and progress summary.' },
  { feature: 'Clinical Hours', description: 'Track clinical hour logs and review your placement records at /clinical/hours.' },
  { feature: 'Skill Sign-Offs', description: 'View which skills have been signed off and which remain outstanding in your progress tracker.' },
  { feature: 'Completions', description: 'Review completed lab sessions, scenario grades, and attendance history at /student/completions.' },
  { feature: 'Scheduling Polls', description: 'Submit your availability for scheduling polls when an instructor sends you a poll link at /poll/[id].' },
  { feature: 'Onboarding', description: 'Complete assigned onboarding tasks and track your progress at /onboarding.' },
  { feature: 'Certifications', description: 'View your current certifications at /lab-management/my-certifications.' },
];

const FAQ_ITEMS: FaqItem[] = [
  {
    category: 'Account & Access',
    question: 'How do I sign in?',
    answer:
      'Click "Sign in with Google" on the login page and use your @pmi.edu or @my.pmi.edu Google account. If you are a volunteer instructor with a non-PMI account, click "Request Access" and an admin will approve your account.',
  },
  {
    category: 'Account & Access',
    question: 'My role says "pending" — what do I do?',
    answer:
      'New @pmi.edu accounts are automatically created with a pending status. An administrator must assign you a role before you can access the system. Contact your program director or a current admin.',
  },
  {
    category: 'Account & Access',
    question: 'I cannot access a certain section. Why?',
    answer:
      'Access is role-based. Students can only see student-facing features. Instructors can see lab management and scheduling. Clinical features require lead_instructor or higher. Admin features require admin or superadmin. Contact an admin if you believe your role needs to be updated.',
  },
  {
    category: 'Lab Management',
    question: 'How do I create a new lab day?',
    answer:
      'Go to Lab Management > Schedule, then click the "+ New Lab Day" button. Fill in the date, cohort, and optionally add stations and assign scenarios. Lab days can also be created from the quick actions menu (press the period key or click the + button in the bottom right).',
  },
  {
    category: 'Lab Management',
    question: 'How do I add a student to a lab?',
    answer:
      'Students are organized into cohorts and groups. When you create or edit a lab day, you can associate it with a cohort. Students in that cohort are automatically included. You can also manually adjust attendance on the lab day detail page.',
  },
  {
    category: 'Lab Management',
    question: 'How does scenario grading work?',
    answer:
      'From a lab day detail page, click on a station to start grading. You can mark skills as pass/fail, add notes, and submit. Grades are saved immediately and feed into student progress reports. You can also grade in bulk for multiple students at once.',
  },
  {
    category: 'Scheduling',
    question: 'What is the difference between Scheduling Polls and Part-Timer Scheduling?',
    answer:
      'Scheduling Polls (/scheduler) are Doodle-style polls for finding a meeting time — you create a poll with proposed dates, share the link, and participants mark their availability. Part-Timer Scheduling (/scheduling) is for managing recurring shift availability and sign-ups for open shifts.',
  },
  {
    category: 'Scheduling',
    question: 'How do I set my weekly availability?',
    answer:
      'Go to Part-Timer Scheduling > Availability. You can set general availability for each day of the week. This availability is used to show which open shifts you might be available for.',
  },
  {
    category: 'Clinical',
    question: 'How do I log a site visit?',
    answer:
      'Go to Clinical & Internship > Site Visits, or click the "Site Visit Check-In" banner on the home dashboard. Select the clinical agency, enter your visit details, and submit. Site visits are tracked for compliance purposes.',
  },
  {
    category: 'Clinical',
    question: 'What are summative evaluations?',
    answer:
      'Summative evaluations are formal assessments of student performance at the end of a clinical rotation. Instructors or preceptors create evaluations at /clinical/summative-evaluations. Graded evaluations contribute to student progression records.',
  },
  {
    category: 'Notifications',
    question: 'How do I manage my notification preferences?',
    answer:
      'Go to Settings (/settings) to manage which notification categories you receive. You can toggle email and in-app notifications for task assignments, certification reminders, scheduling updates, and clinical alerts.',
  },
  {
    category: 'Data & Export',
    question: 'Can I export data to Excel or PDF?',
    answer:
      'Yes. Most report pages have an Export button that lets you download data as an Excel spreadsheet or print as a PDF. Look for the export icon or the export dropdown on report pages like /lab-management/reports and /reports/instructor-workload.',
  },
  {
    category: 'Technical',
    question: 'The page is loading slowly. What should I do?',
    answer:
      'First, try refreshing the page (F5 or Cmd+R). If the issue persists, check your internet connection. For persistent problems, use the Feedback button to report the issue with a screenshot. The system auto-captures your browser info to help diagnose performance issues.',
  },
  {
    category: 'Technical',
    question: 'What browsers are supported?',
    answer:
      'PMI Paramedic Tools works best in modern browsers: Chrome, Firefox, Edge, and Safari (desktop and mobile). Internet Explorer is not supported. For best performance, use the latest version of your preferred browser.',
  },
];

const SHORTCUTS: ShortcutItem[] = [
  { keys: ['⌘K', 'Ctrl+K'], description: 'Open command palette / global search', category: 'Global' },
  { keys: ['.'], description: 'Open quick actions menu', category: 'Global' },
  { keys: ['?'], description: 'Show keyboard shortcuts help (on supported pages)', category: 'Global' },
  { keys: ['Esc'], description: 'Close modal, palette, or quick actions', category: 'Global' },
  { keys: ['↑ ↓'], description: 'Navigate items in command palette', category: 'Command Palette' },
  { keys: ['↵'], description: 'Execute selected command', category: 'Command Palette' },
  { keys: ['⌘K', 'Ctrl+K'], description: 'Close command palette (when open)', category: 'Command Palette' },
  { keys: ['Tab'], description: 'Move focus between interactive elements', category: 'Accessibility' },
  { keys: ['Enter', 'Space'], description: 'Activate focused button or link', category: 'Accessibility' },
];

const VIDEO_PLACEHOLDERS: VideoPlaceholder[] = [
  {
    title: 'Getting Started: Your First Login',
    description: 'A walkthrough of signing in, exploring the dashboard, and customizing your layout.',
    duration: '3 min',
    category: 'Basics',
  },
  {
    title: 'Lab Management Overview',
    description: 'How to create lab days, manage scenarios, assign stations, and track attendance.',
    duration: '8 min',
    category: 'Lab Management',
  },
  {
    title: 'Grading Student Performance',
    description: 'Step-by-step guide to grading station rotations and viewing student progress.',
    duration: '5 min',
    category: 'Lab Management',
  },
  {
    title: 'Using Scheduling Polls',
    description: 'Create a poll, share the link, collect availability, and pick a meeting time.',
    duration: '4 min',
    category: 'Scheduling',
  },
  {
    title: 'Clinical Tracking Walkthrough',
    description: 'How to log site visits, manage internships, and track preceptor evaluations.',
    duration: '6 min',
    category: 'Clinical',
  },
  {
    title: 'Admin: Managing Users & Roles',
    description: 'How to create accounts, assign roles, approve access requests, and manage guests.',
    duration: '5 min',
    category: 'Admin',
  },
];

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; lightBg: string }> = {
  blue: {
    bg: 'bg-blue-600',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
    lightBg: 'bg-blue-50 dark:bg-blue-900/20',
  },
  purple: {
    bg: 'bg-purple-600',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800',
    lightBg: 'bg-purple-50 dark:bg-purple-900/20',
  },
  amber: {
    bg: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800',
    lightBg: 'bg-amber-50 dark:bg-amber-900/20',
  },
  green: {
    bg: 'bg-green-600',
    text: 'text-green-600 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
    lightBg: 'bg-green-50 dark:bg-green-900/20',
  },
  rose: {
    bg: 'bg-rose-600',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-200 dark:border-rose-800',
    lightBg: 'bg-rose-50 dark:bg-rose-900/20',
  },
  teal: {
    bg: 'bg-teal-600',
    text: 'text-teal-600 dark:text-teal-400',
    border: 'border-teal-200 dark:border-teal-800',
    lightBg: 'bg-teal-50 dark:bg-teal-900/20',
  },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KbdKey({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-mono font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded shadow-sm">
      {children}
    </kbd>
  );
}

interface FaqAccordionProps {
  item: FaqItem;
  isOpen: boolean;
  onToggle: () => void;
  searchQuery: string;
}

function FaqAccordion({ item, isOpen, onToggle, searchQuery }: FaqAccordionProps) {
  function highlight(text: string, query: string) {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 text-inherit rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="font-medium text-gray-900 dark:text-white text-sm pr-4">
          {highlight(item.question, searchQuery)}
        </span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {highlight(item.answer, searchQuery)}
          </p>
        </div>
      )}
    </div>
  );
}

interface VideoCardProps {
  video: VideoPlaceholder;
}

function VideoCard({ video }: VideoCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">
      {/* Thumbnail placeholder */}
      <div className="relative bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 h-36 flex items-center justify-center group cursor-pointer">
        <div className="w-14 h-14 bg-white/90 dark:bg-gray-900/90 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
          <Play className="w-6 h-6 text-gray-700 dark:text-gray-300 ml-1" />
        </div>
        <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 text-white text-xs rounded font-mono">
          {video.duration}
        </span>
        <span className="absolute top-2 left-2 px-2 py-0.5 bg-blue-600/90 text-white text-xs rounded font-medium">
          {video.category}
        </span>
        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/5 transition-colors" />
        <p className="absolute bottom-8 left-0 right-0 text-center text-xs text-gray-500 dark:text-gray-400 font-medium">
          Coming Soon
        </p>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">{video.title}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{video.description}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function HelpPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [openFaqs, setOpenFaqs] = useState<Set<number>>(new Set());
  const [activeSection, setActiveSection] = useState('getting-started');

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  // Track active section on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    );

    const currentRefs = sectionRefs.current;
    for (const el of Object.values(currentRefs)) {
      if (el) observer.observe(el);
    }
    return () => {
      for (const el of Object.values(currentRefs)) {
        if (el) observer.unobserve(el);
      }
    };
  }, []);

  const scrollTo = useCallback((id: string) => {
    const el = sectionRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const toggleFaq = (index: number) => {
    setOpenFaqs((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Client-side search filtering
  const searchLower = searchQuery.toLowerCase().trim();

  const filteredFaqs = FAQ_ITEMS.map((item, index) => ({
    item,
    index,
    matches:
      !searchLower ||
      item.question.toLowerCase().includes(searchLower) ||
      item.answer.toLowerCase().includes(searchLower) ||
      item.category.toLowerCase().includes(searchLower),
  })).filter((f) => f.matches);

  const filteredShortcuts = SHORTCUTS.filter(
    (s) =>
      !searchLower ||
      s.description.toLowerCase().includes(searchLower) ||
      s.keys.some((k) => k.toLowerCase().includes(searchLower)) ||
      s.category.toLowerCase().includes(searchLower)
  );

  const filteredAdminFeatures = ADMIN_FEATURES.filter(
    (f) =>
      !searchLower ||
      f.feature.toLowerCase().includes(searchLower) ||
      f.description.toLowerCase().includes(searchLower)
  );

  const filteredInstructorFeatures = INSTRUCTOR_FEATURES.filter(
    (f) =>
      !searchLower ||
      f.feature.toLowerCase().includes(searchLower) ||
      f.description.toLowerCase().includes(searchLower)
  );

  const filteredStudentFeatures = STUDENT_FEATURES.filter(
    (f) =>
      !searchLower ||
      f.feature.toLowerCase().includes(searchLower) ||
      f.description.toLowerCase().includes(searchLower)
  );

  // Group FAQ items by category for display
  const faqByCategory: Record<string, typeof filteredFaqs> = {};
  for (const item of filteredFaqs) {
    const cat = item.item.category;
    if (!faqByCategory[cat]) faqByCategory[cat] = [];
    faqByCategory[cat].push(item);
  }

  // Group shortcuts by category
  const shortcutsByCategory: Record<string, ShortcutItem[]> = {};
  for (const s of filteredShortcuts) {
    if (!shortcutsByCategory[s.category]) shortcutsByCategory[s.category] = [];
    shortcutsByCategory[s.category].push(s);
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!session) return null;

  const hasResults =
    filteredFaqs.length > 0 ||
    filteredShortcuts.length > 0 ||
    filteredAdminFeatures.length > 0 ||
    filteredInstructorFeatures.length > 0 ||
    filteredStudentFeatures.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">Help</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <HelpCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Help Center</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Documentation, guides, and FAQs for PMI Paramedic Tools
                </p>
              </div>
            </div>

            {/* Search bar */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search help docs..."
                className="w-full pl-9 pr-9 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Search result count */}
      {searchQuery && (
        <div className="max-w-7xl mx-auto px-4 pt-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {hasResults ? (
              <>
                Found results in{' '}
                {[
                  filteredFaqs.length > 0 && 'FAQ',
                  filteredShortcuts.length > 0 && 'Shortcuts',
                  (filteredAdminFeatures.length > 0 || filteredInstructorFeatures.length > 0 || filteredStudentFeatures.length > 0) && 'Features by Role',
                ]
                  .filter(Boolean)
                  .join(', ')}
              </>
            ) : (
              <>No results found for &ldquo;{searchQuery}&rdquo; — try different keywords</>
            )}
          </p>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar Table of Contents */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-6">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 px-2">
                On this page
              </p>
              <nav className="space-y-0.5">
                {SECTIONS.map((section) => {
                  const Icon = section.icon;
                  const colors = COLOR_MAP[section.color];
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => scrollTo(section.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                        isActive
                          ? `${colors.lightBg} ${colors.text} font-medium`
                          : 'text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {section.title}
                    </button>
                  );
                })}
              </nav>

              <div className="mt-6 px-3">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Need more help?</p>
                <button
                  onClick={() => {
                    const feedbackBtn = document.querySelector<HTMLButtonElement>(
                      '[aria-label="Submit Feedback"]'
                    );
                    feedbackBtn?.click();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  Submit Feedback
                </button>
              </div>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0 space-y-10">
            {/* Mobile section nav */}
            <div className="lg:hidden flex gap-2 overflow-x-auto pb-1">
              {SECTIONS.map((section) => {
                const Icon = section.icon;
                const colors = COLOR_MAP[section.color];
                return (
                  <button
                    key={section.id}
                    onClick={() => scrollTo(section.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 border transition-colors ${colors.border} ${colors.lightBg} ${colors.text}`}
                  >
                    <Icon className="w-3 h-3" />
                    {section.title}
                  </button>
                );
              })}
            </div>

            {/* ── Getting Started ── */}
            <section
              id="getting-started"
              ref={(el) => { sectionRefs.current['getting-started'] = el; }}
              className="scroll-mt-6"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Book className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Getting Started</h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {GETTING_STARTED_STEPS.map((step) => {
                  const Icon = step.icon;
                  return (
                    <div
                      key={step.step}
                      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex gap-4"
                    >
                      <div className="flex-shrink-0">
                        <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                          <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                            Step {step.step}
                          </span>
                        </div>
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1.5">
                          {step.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick tips */}
              <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Lightbulb className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">Pro Tip</p>
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      Press <KbdKey>⌘K</KbdKey> / <KbdKey>Ctrl+K</KbdKey> at any time to instantly search and navigate
                      to any part of the system — students, scenarios, tasks, lab days, and more.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Features by Role ── */}
            <section
              id="roles"
              ref={(el) => { sectionRefs.current['roles'] = el; }}
              className="scroll-mt-6"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Features by Role</h2>
              </div>

              <div className="space-y-5">
                {/* Admin */}
                {(filteredAdminFeatures.length > 0 || !searchLower) && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 overflow-hidden">
                    <div className="px-5 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 flex items-center gap-3">
                      <Shield className="w-5 h-5 text-red-600 dark:text-red-400" />
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">Admin / Superadmin</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Full system management — user, settings, reports, certifications
                        </p>
                      </div>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {(filteredAdminFeatures.length > 0 ? filteredAdminFeatures : ADMIN_FEATURES).map((f) => (
                        <div key={f.feature} className="px-5 py-3 flex gap-3">
                          <ArrowRight className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium text-gray-900 dark:text-white text-sm">{f.feature}:</span>{' '}
                            <span className="text-sm text-gray-600 dark:text-gray-400">{f.description}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Instructor */}
                {(filteredInstructorFeatures.length > 0 || !searchLower) && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-green-200 dark:border-green-800 overflow-hidden">
                    <div className="px-5 py-3 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800 flex items-center gap-3">
                      <GraduationCap className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">Lead Instructor / Instructor</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Lab management, scheduling, scenarios, student tracking
                        </p>
                      </div>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {(filteredInstructorFeatures.length > 0 ? filteredInstructorFeatures : INSTRUCTOR_FEATURES).map((f) => (
                        <div key={f.feature} className="px-5 py-3 flex gap-3">
                          <ArrowRight className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium text-gray-900 dark:text-white text-sm">{f.feature}:</span>{' '}
                            <span className="text-sm text-gray-600 dark:text-gray-400">{f.description}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Student */}
                {(filteredStudentFeatures.length > 0 || !searchLower) && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-blue-200 dark:border-blue-800 overflow-hidden">
                    <div className="px-5 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 flex items-center gap-3">
                      <Award className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">Student</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          View progress, clinical hours, portfolio, skill sign-offs
                        </p>
                      </div>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {(filteredStudentFeatures.length > 0 ? filteredStudentFeatures : STUDENT_FEATURES).map((f) => (
                        <div key={f.feature} className="px-5 py-3 flex gap-3">
                          <ArrowRight className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium text-gray-900 dark:text-white text-sm">{f.feature}:</span>{' '}
                            <span className="text-sm text-gray-600 dark:text-gray-400">{f.description}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Role hierarchy note */}
                <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Role Hierarchy</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    {['superadmin', 'admin', 'lead_instructor', 'instructor', 'volunteer_instructor', 'student', 'guest'].map((role, i, arr) => (
                      <span key={role} className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 text-xs font-mono">
                          {role}
                        </span>
                        {i < arr.length - 1 && (
                          <ChevronRight className="w-3 h-3 text-gray-400" />
                        )}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Higher roles include all permissions of lower roles (except volunteer_instructor which has limited access).
                  </p>
                </div>
              </div>
            </section>

            {/* ── FAQ ── */}
            <section
              id="faq"
              ref={(el) => { sectionRefs.current['faq'] = el; }}
              className="scroll-mt-6"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <HelpCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Frequently Asked Questions
                </h2>
              </div>

              {Object.keys(faqByCategory).length === 0 ? (
                <div className="text-center py-10">
                  <HelpCircle className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No FAQ results for &ldquo;{searchQuery}&rdquo;</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(faqByCategory).map(([category, items]) => (
                    <div key={category}>
                      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                        {category}
                      </h3>
                      <div className="space-y-2">
                        {items.map(({ item, index }) => (
                          <FaqAccordion
                            key={index}
                            item={item}
                            isOpen={openFaqs.has(index)}
                            onToggle={() => toggleFaq(index)}
                            searchQuery={searchQuery}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Expand all shortcut */}
              {filteredFaqs.length > 0 && (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setOpenFaqs(new Set(filteredFaqs.map((f) => f.index)))}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Expand all
                  </button>
                  <span className="text-xs text-gray-300 dark:text-gray-600">|</span>
                  <button
                    onClick={() => setOpenFaqs(new Set())}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Collapse all
                  </button>
                </div>
              )}
            </section>

            {/* ── Keyboard Shortcuts ── */}
            <section
              id="shortcuts"
              ref={(el) => { sectionRefs.current['shortcuts'] = el; }}
              className="scroll-mt-6"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Keyboard className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Keyboard Shortcuts</h2>
              </div>

              {Object.keys(shortcutsByCategory).length === 0 ? (
                <div className="text-center py-10">
                  <Keyboard className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No shortcut results for &ldquo;{searchQuery}&rdquo;</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {Object.entries(shortcutsByCategory).map(([category, items]) => (
                    <div key={category} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{category}</h3>
                      </div>
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {items.map((shortcut, i) => (
                          <div key={i} className="flex items-center justify-between px-5 py-3">
                            <span className="text-sm text-gray-700 dark:text-gray-300">{shortcut.description}</span>
                            <div className="flex items-center gap-1.5 ml-4">
                              {shortcut.keys.map((key, j) => (
                                <span key={j} className="flex items-center gap-1">
                                  {j > 0 && (
                                    <span className="text-xs text-gray-400 dark:text-gray-500">/</span>
                                  )}
                                  <KbdKey>{key}</KbdKey>
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Note: On Mac, use <KbdKey>⌘</KbdKey> (Command) in place of <KbdKey>Ctrl</KbdKey> where applicable.
              </p>
            </section>

            {/* ── Video Tutorials ── */}
            <section
              id="videos"
              ref={(el) => { sectionRefs.current['videos'] = el; }}
              className="scroll-mt-6"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
                  <Video className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Video Tutorials</h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                Video walkthroughs are coming soon. The topics below are planned.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {VIDEO_PLACEHOLDERS.map((video) => (
                  <VideoCard key={video.title} video={video} />
                ))}
              </div>

              <div className="mt-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-rose-700 dark:text-rose-400">
                    Video tutorials are planned for a future release. In the meantime, use this Help page or
                    the Feedback button to ask questions. Suggestions for video topics are welcome.
                  </p>
                </div>
              </div>
            </section>

            {/* ── Report an Issue ── */}
            <section
              id="report"
              ref={(el) => { sectionRefs.current['report'] = el; }}
              className="scroll-mt-6"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                  <MessageSquare className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Report an Issue</h2>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {/* Feedback button */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-teal-200 dark:border-teal-800 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                      <MessageSquare className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white">Feedback Form</h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Use the blue Feedback button in the bottom-right corner of any page to report a bug, request a
                    feature, or share general feedback. You can attach a screenshot and the system automatically
                    captures your page URL and browser info.
                  </p>
                  <button
                    onClick={() => {
                      const feedbackBtn = document.querySelector<HTMLButtonElement>(
                        '[aria-label="Submit Feedback"]'
                      );
                      feedbackBtn?.click();
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Open Feedback Form
                  </button>
                </div>

                {/* What to include */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                  <h3 className="font-bold text-gray-900 dark:text-white mb-3">What to Include</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    For faster resolution, include the following when reporting a bug:
                  </p>
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <li className="flex gap-2">
                      <span className="text-teal-500 font-bold mt-0.5">1.</span>
                      <span>What you were trying to do</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-teal-500 font-bold mt-0.5">2.</span>
                      <span>What happened instead</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-teal-500 font-bold mt-0.5">3.</span>
                      <span>Steps to reproduce the problem</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-teal-500 font-bold mt-0.5">4.</span>
                      <span>A screenshot of the error (use the camera icon in the form)</span>
                    </li>
                  </ul>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                    Your page URL and browser are automatically captured.
                  </p>
                </div>
              </div>

              {/* Back to home */}
              <div className="mt-6 flex justify-center">
                <Link
                  href="/"
                  className="flex items-center gap-2 px-5 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
                >
                  <Home className="w-4 h-4" />
                  Back to Dashboard
                </Link>
              </div>
            </section>
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-8 py-6 text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
        <p>PMI Paramedic Tools &copy; {new Date().getFullYear()} &mdash; Help Center</p>
      </footer>
    </div>
  );
}
