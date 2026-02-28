'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Circle,
  Printer,
  RotateCcw,
  Filter,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckSquare,
  User,
  Users,
  GraduationCap,
  UserX,
  Clock,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import { PageLoader } from '@/components/ui';
import type { CurrentUserMinimal } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Priority = 'Critical' | 'High' | 'Medium' | 'Low';
type Status = 'pass' | 'fail' | 'skip' | 'untested';

interface ChecklistItem {
  id: string;
  feature: string;
  steps: string;
  priority: Priority;
  status: Status;
  notes: string;
}

interface ChecklistGroup {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  items: ChecklistItem[];
  collapsed: boolean;
}

type FilterMode = 'all' | 'untested' | 'failed';

// ---------------------------------------------------------------------------
// Checklist data
// ---------------------------------------------------------------------------

const INITIAL_GROUPS: Omit<ChecklistGroup, 'collapsed'>[] = [
  {
    id: 'authentication',
    name: 'Authentication',
    icon: User,
    color: 'bg-indigo-500',
    items: [
      { id: 'auth-01', feature: 'Login flow', steps: 'Navigate to / when signed out. Click "Sign in with Google". Complete Google OAuth flow. Verify redirect to dashboard.', priority: 'Critical', status: 'untested', notes: '' },
      { id: 'auth-02', feature: '@pmi.edu domain restriction', steps: 'Attempt login with a non-@pmi.edu Google account. Verify access is denied with a clear error message.', priority: 'Critical', status: 'untested', notes: '' },
      { id: 'auth-03', feature: 'Role assignment', steps: 'Log in as a new user. Verify role defaults to "pending". Admin promotes user to instructor role. Re-login and verify correct access.', priority: 'Critical', status: 'untested', notes: '' },
      { id: 'auth-04', feature: 'Guest access login', steps: 'Use a guest access link or token. Verify guest can view allowed content and is blocked from restricted areas.', priority: 'High', status: 'untested', notes: '' },
      { id: 'auth-05', feature: 'Session timeout / sign out', steps: 'Click "Sign out" from user menu. Verify session is cleared and user is redirected to sign-in page. Attempt to navigate to a protected route — verify redirect.', priority: 'High', status: 'untested', notes: '' },
      { id: 'auth-06', feature: 'Pending approval state', steps: 'Log in as a user with "pending" role. Verify they see a pending approval message and cannot access protected features.', priority: 'High', status: 'untested', notes: '' },
    ],
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    icon: CheckSquare,
    color: 'bg-blue-500',
    items: [
      { id: 'dash-01', feature: 'Widget loading', steps: 'Navigate to /dashboard. Verify all widgets load without errors. Check for loading spinners during fetch.', priority: 'High', status: 'untested', notes: '' },
      { id: 'dash-02', feature: 'Quick stats accuracy', steps: 'Verify quick stats (e.g., upcoming labs, pending tasks) match actual data from other pages.', priority: 'Medium', status: 'untested', notes: '' },
      { id: 'dash-03', feature: 'Notifications bell', steps: 'Create a notification via admin or trigger an action. Verify bell icon shows unread count. Click bell to view notification list.', priority: 'Medium', status: 'untested', notes: '' },
      { id: 'dash-04', feature: 'Dashboard navigation links', steps: 'Click each nav link from the dashboard. Verify correct pages load. Test breadcrumb back-navigation.', priority: 'Medium', status: 'untested', notes: '' },
      { id: 'dash-05', feature: 'Dark mode toggle', steps: 'Toggle between light and dark mode from the header. Verify all dashboard widgets respect the theme. Refresh and confirm preference persists.', priority: 'Low', status: 'untested', notes: '' },
    ],
  },
  {
    id: 'lab-management',
    name: 'Lab Management',
    icon: ClipboardCheck,
    color: 'bg-purple-500',
    items: [
      { id: 'lab-01', feature: 'Create a lab day', steps: 'Go to Lab Management. Click "Create Lab Day". Fill required fields (date, cohort, location). Save. Verify lab day appears in list.', priority: 'Critical', status: 'untested', notes: '' },
      { id: 'lab-02', feature: 'Edit a lab day', steps: 'Open an existing lab day. Edit the title or date. Save. Verify changes persist after page refresh.', priority: 'High', status: 'untested', notes: '' },
      { id: 'lab-03', feature: 'Attendance tracking', steps: 'Open a lab day. Mark one student present, one absent. Save attendance. Reload the page and verify marks persist.', priority: 'Critical', status: 'untested', notes: '' },
      { id: 'lab-04', feature: 'Scenario management', steps: 'Navigate to Scenarios. Create a new scenario with all required fields. Edit the scenario. Verify changes are saved.', priority: 'High', status: 'untested', notes: '' },
      { id: 'lab-05', feature: 'Skill sign-offs', steps: 'Open a student record. Navigate to skill sign-offs. Sign off a skill as an instructor. Verify the sign-off appears with the correct date/instructor.', priority: 'High', status: 'untested', notes: '' },
      { id: 'lab-06', feature: 'Student portfolio', steps: 'Open a student portfolio view. Verify skill completion, scenario history, and attendance are all displayed accurately.', priority: 'Medium', status: 'untested', notes: '' },
      { id: 'lab-07', feature: 'Cohort management', steps: 'Navigate to cohort admin. Create a new cohort. Enroll a student. Verify the student appears in that cohort.', priority: 'High', status: 'untested', notes: '' },
      { id: 'lab-08', feature: 'Lab templates', steps: 'Navigate to Admin > Lab Template Library. Create a template. Apply the template to a new lab day. Verify stations and scenarios pre-populate.', priority: 'Medium', status: 'untested', notes: '' },
    ],
  },
  {
    id: 'clinical',
    name: 'Clinical',
    icon: CheckCircle2,
    color: 'bg-orange-500',
    items: [
      { id: 'clin-01', feature: 'Internship tracking', steps: 'Navigate to Clinical. Create a new internship for a student. Set site, preceptor, and dates. Verify it appears in the internship list.', priority: 'High', status: 'untested', notes: '' },
      { id: 'clin-02', feature: 'Clinical hours logging', steps: 'Add a clinical hours entry for a student. Verify total hours update. Check the hours appear in the student portfolio.', priority: 'High', status: 'untested', notes: '' },
      { id: 'clin-03', feature: 'Compliance tracker', steps: 'Open the compliance tracker. Verify students with missing hours or skills are flagged. Verify compliant students show green.', priority: 'High', status: 'untested', notes: '' },
      { id: 'clin-04', feature: 'Closeout process', steps: 'Complete all required steps for a student internship. Initiate closeout. Verify status changes to completed and cannot be reopened without admin.', priority: 'Medium', status: 'untested', notes: '' },
      { id: 'clin-05', feature: 'Program requirements configuration', steps: 'Navigate to Admin > Program Requirements. Edit required clinical hours for a program. Verify the compliance tracker reflects the updated requirement.', priority: 'Medium', status: 'untested', notes: '' },
    ],
  },
  {
    id: 'scheduling',
    name: 'Scheduling',
    icon: Clock,
    color: 'bg-teal-500',
    items: [
      { id: 'sched-01', feature: 'Create a shift', steps: 'Navigate to Scheduling. Create a new shift with date, time, location, and role. Save. Verify shift appears in the schedule.', priority: 'High', status: 'untested', notes: '' },
      { id: 'sched-02', feature: 'Repeat/recurring shifts', steps: 'Create a shift with recurrence (e.g., weekly for 4 weeks). Verify all 4 instances appear in the schedule.', priority: 'Medium', status: 'untested', notes: '' },
      { id: 'sched-03', feature: 'Availability submission', steps: 'As an instructor, submit availability for a scheduling poll. Verify submission is recorded. Admin can view responses.', priority: 'High', status: 'untested', notes: '' },
      { id: 'sched-04', feature: 'Shift sign-ups', steps: 'As a volunteer instructor, view open shifts and sign up for one. Verify the shift shows the instructor as assigned.', priority: 'High', status: 'untested', notes: '' },
      { id: 'sched-05', feature: 'Shift swap requests', steps: 'As an assigned instructor, request a swap for a shift. Another instructor accepts. Verify shift assignment updates.', priority: 'Medium', status: 'untested', notes: '' },
    ],
  },
  {
    id: 'tasks',
    name: 'Tasks',
    icon: CheckSquare,
    color: 'bg-yellow-500',
    items: [
      { id: 'task-01', feature: 'Create a task', steps: 'Navigate to Tasks. Create a new task with title, due date, and assignee. Save. Verify task appears in the list for the assignee.', priority: 'High', status: 'untested', notes: '' },
      { id: 'task-02', feature: 'Assign a task', steps: 'Edit an existing task. Change the assignee to another user. Save. Verify the task appears in the new assignee\'s list.', priority: 'Medium', status: 'untested', notes: '' },
      { id: 'task-03', feature: 'Complete a task', steps: 'Mark a task as complete. Verify it moves to the completed section. Check the timestamp is recorded.', priority: 'High', status: 'untested', notes: '' },
      { id: 'task-04', feature: 'Task comments', steps: 'Open a task and add a comment. Refresh the page. Verify the comment persists and shows the correct author.', priority: 'Medium', status: 'untested', notes: '' },
      { id: 'task-05', feature: 'Bulk task operations', steps: 'Select multiple tasks. Use bulk "Mark complete" or bulk delete. Verify all selected tasks are updated.', priority: 'Low', status: 'untested', notes: '' },
    ],
  },
  {
    id: 'notifications',
    name: 'Notifications',
    icon: AlertCircle,
    color: 'bg-sky-500',
    items: [
      { id: 'notif-01', feature: 'In-app notifications', steps: 'Trigger an action that generates a notification (e.g., task assignment). Navigate to notifications. Verify the new notification appears and is marked unread.', priority: 'High', status: 'untested', notes: '' },
      { id: 'notif-02', feature: 'Mark notifications as read', steps: 'Click "Mark all as read". Verify unread count resets to 0. Verify individual notifications can also be marked read.', priority: 'Medium', status: 'untested', notes: '' },
      { id: 'notif-03', feature: 'Email notifications', steps: 'Trigger a notification that sends email. Check the recipient\'s inbox. Verify email is received with correct subject and content.', priority: 'High', status: 'untested', notes: '' },
      { id: 'notif-04', feature: 'Quiet hours setting', steps: 'Configure quiet hours in Settings > Notifications. Trigger a notification during quiet hours. Verify no email is sent during that window.', priority: 'Medium', status: 'untested', notes: '' },
      { id: 'notif-05', feature: 'Notification preferences', steps: 'Go to Settings > Notification Preferences. Disable a notification type. Trigger that notification type. Verify no notification is created.', priority: 'Medium', status: 'untested', notes: '' },
    ],
  },
  {
    id: 'reports',
    name: 'Reports',
    icon: ClipboardCheck,
    color: 'bg-emerald-500',
    items: [
      { id: 'rep-01', feature: 'Attendance reports', steps: 'Navigate to Reports. Generate an attendance report for a cohort. Verify all students and attendance marks are listed. Export as Excel.', priority: 'High', status: 'untested', notes: '' },
      { id: 'rep-02', feature: 'Scenario analytics', steps: 'View scenario analytics. Verify counts per scenario type match manual counts. Check pass/fail breakdown is accurate.', priority: 'Medium', status: 'untested', notes: '' },
      { id: 'rep-03', feature: 'Cohort comparison', steps: 'Select two cohorts in the comparison view. Verify metrics are shown side-by-side. Verify data is specific to each cohort.', priority: 'Medium', status: 'untested', notes: '' },
      { id: 'rep-04', feature: 'PDF export', steps: 'Generate a report and click "Export as PDF". Verify a PDF is downloaded with correct formatting and all data visible.', priority: 'High', status: 'untested', notes: '' },
      { id: 'rep-05', feature: 'Excel export', steps: 'Generate a report and click "Export as Excel". Open the downloaded .xlsx file and verify all columns and data are present.', priority: 'High', status: 'untested', notes: '' },
    ],
  },
  {
    id: 'admin',
    name: 'Admin Panel',
    icon: User,
    color: 'bg-red-500',
    items: [
      { id: 'adm-01', feature: 'User management', steps: 'Navigate to Admin > User Management. Promote a pending user to instructor. Demote/disable a user. Verify changes are reflected immediately.', priority: 'Critical', status: 'untested', notes: '' },
      { id: 'adm-02', feature: 'Data export', steps: 'Navigate to Admin > Data Export. Export students as CSV. Export full backup as JSON. Verify both files download correctly with accurate data.', priority: 'High', status: 'untested', notes: '' },
      { id: 'adm-03', feature: 'System alerts', steps: 'Navigate to Admin > System Alerts. Verify active alerts display. Resolve an alert. Verify it moves to resolved list.', priority: 'Medium', status: 'untested', notes: '' },
      { id: 'adm-04', feature: 'Database tools', steps: 'Navigate to Admin > Database Cleanup Utilities. Review available tools. Run a safe tool (e.g., view statistics). Verify no data is accidentally destroyed.', priority: 'High', status: 'untested', notes: '' },
      { id: 'adm-05', feature: 'FERPA audit log', steps: 'Navigate to Admin > Audit Log. Perform a protected action (view student record). Return to audit log and verify the access was logged with correct user/action.', priority: 'Critical', status: 'untested', notes: '' },
      { id: 'adm-06', feature: 'Announcements', steps: 'Create a new announcement. Set the expiry date. Log in as another user and verify the announcement appears on the dashboard.', priority: 'Medium', status: 'untested', notes: '' },
      { id: 'adm-07', feature: 'Access requests', steps: 'Simulate a new volunteer instructor submitting an access request. Navigate to Admin > Access Requests. Approve the request. Verify user receives access.', priority: 'High', status: 'untested', notes: '' },
    ],
  },
  {
    id: 'student-portal',
    name: 'Student Portal',
    icon: GraduationCap,
    color: 'bg-cyan-500',
    items: [
      { id: 'stu-01', feature: 'My Progress view', steps: 'Log in as a student. Navigate to the student portal. Verify skill completion percentages match actual sign-offs in admin.', priority: 'High', status: 'untested', notes: '' },
      { id: 'stu-02', feature: 'Student portfolio view', steps: 'As a student, view own portfolio. Verify all completed scenarios, skills, and attendance data is visible and accurate.', priority: 'High', status: 'untested', notes: '' },
      { id: 'stu-03', feature: 'Clinical hours view', steps: 'As a student, navigate to clinical hours. Verify all logged hours are displayed. Verify the hours total matches admin view.', priority: 'High', status: 'untested', notes: '' },
      { id: 'stu-04', feature: 'Student access restrictions', steps: 'As a student, attempt to navigate to /admin, /lab-management/admin, or other restricted pages. Verify access is denied and user is redirected.', priority: 'Critical', status: 'untested', notes: '' },
    ],
  },
  {
    id: 'settings',
    name: 'Settings',
    icon: User,
    color: 'bg-gray-500',
    items: [
      { id: 'set-01', feature: 'Profile settings', steps: 'Navigate to Settings > Profile. Update display name or phone number. Save. Verify changes persist after page reload.', priority: 'Medium', status: 'untested', notes: '' },
      { id: 'set-02', feature: 'Notification preferences', steps: 'Navigate to Settings > Notifications. Toggle off specific notification types. Trigger those notification types. Verify preferences are respected.', priority: 'Medium', status: 'untested', notes: '' },
      { id: 'set-03', feature: 'Onboarding tour replay', steps: 'Navigate to Settings. Find the "Replay onboarding tour" option. Click it. Verify the tour restarts from the beginning.', priority: 'Low', status: 'untested', notes: '' },
    ],
  },
  {
    id: 'search',
    name: 'Search',
    icon: Filter,
    color: 'bg-violet-500',
    items: [
      { id: 'srch-01', feature: 'Cmd+K / Ctrl+K search shortcut', steps: 'Press Cmd+K (Mac) or Ctrl+K (Windows). Verify the global search modal opens.', priority: 'Medium', status: 'untested', notes: '' },
      { id: 'srch-02', feature: 'Search by student name', steps: 'Open search. Type a student\'s first or last name. Verify the correct student result appears. Click result and verify navigation to student record.', priority: 'High', status: 'untested', notes: '' },
      { id: 'srch-03', feature: 'Search by scenario name', steps: 'Open search. Type a scenario name. Verify matching scenarios appear. Click a result and verify navigation.', priority: 'Medium', status: 'untested', notes: '' },
      { id: 'srch-04', feature: 'Search by lab day / date', steps: 'Open search. Type a date or lab day title. Verify correct lab days appear in results.', priority: 'Medium', status: 'untested', notes: '' },
      { id: 'srch-05', feature: 'Search by instructor name', steps: 'Open search. Type an instructor\'s name. Verify the correct instructor result appears with their role badge.', priority: 'Medium', status: 'untested', notes: '' },
    ],
  },
  {
    id: 'accessibility',
    name: 'Accessibility',
    icon: Users,
    color: 'bg-pink-500',
    items: [
      { id: 'a11y-01', feature: 'Keyboard navigation', steps: 'Use only Tab/Shift+Tab/Enter/Escape to navigate the entire dashboard and complete a common task (e.g., open a lab day and take attendance). No mouse required.', priority: 'High', status: 'untested', notes: '' },
      { id: 'a11y-02', feature: 'Skip to content link', steps: 'On a page with navigation, press Tab once. Verify a "Skip to content" link appears. Press Enter. Verify focus jumps to the main content area.', priority: 'Medium', status: 'untested', notes: '' },
      { id: 'a11y-03', feature: 'Focus indicators', steps: 'Tab through interactive elements on any page. Verify a visible focus ring appears on all buttons, links, and inputs.', priority: 'High', status: 'untested', notes: '' },
      { id: 'a11y-04', feature: 'Screen reader compatibility', steps: 'Enable VoiceOver (Mac) or NVDA (Windows). Navigate the dashboard. Verify headings, buttons, and form labels are announced correctly.', priority: 'Medium', status: 'untested', notes: '' },
      { id: 'a11y-05', feature: 'Color contrast', steps: 'In Chrome DevTools, run a Lighthouse Accessibility audit. Verify no color contrast failures. Check text on colored badge/button backgrounds specifically.', priority: 'Medium', status: 'untested', notes: '' },
    ],
  },
  {
    id: 'offline-pwa',
    name: 'Offline / PWA',
    icon: AlertTriangle,
    color: 'bg-rose-500',
    items: [
      { id: 'pwa-01', feature: 'Offline banner', steps: 'Disconnect from the internet (DevTools > Network > Offline). Wait or interact with the page. Verify an offline warning banner appears.', priority: 'Medium', status: 'untested', notes: '' },
      { id: 'pwa-02', feature: 'Service worker registration', steps: 'Navigate to DevTools > Application > Service Workers. Verify the service worker is registered and active.', priority: 'Low', status: 'untested', notes: '' },
      { id: 'pwa-03', feature: 'Offline fallback page', steps: 'Go offline. Attempt to navigate to a page not in the cache. Verify a friendly offline fallback page is shown instead of a browser error.', priority: 'Medium', status: 'untested', notes: '' },
      { id: 'pwa-04', feature: 'Online reconnect behavior', steps: 'Go offline, then reconnect. Verify the offline banner disappears. Verify data refreshes automatically or a "Refresh" prompt appears.', priority: 'Low', status: 'untested', notes: '' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Role-based test scenarios
// ---------------------------------------------------------------------------

const ROLE_SCENARIOS = [
  {
    role: 'Admin',
    icon: User,
    color: 'bg-red-500',
    path: [
      'Sign in with admin @pmi.edu account',
      'Navigate to Admin panel — verify all admin cards are visible',
      'Create a lab day and take attendance',
      'Manage users: promote one pending user',
      'Generate and download a student data export',
      'View and resolve a system alert',
      'Check FERPA audit log for recent entries',
    ],
  },
  {
    role: 'Instructor',
    icon: Users,
    color: 'bg-green-600',
    path: [
      'Sign in with instructor @pmi.edu account',
      'View lab schedule and open a lab day',
      'Take attendance for a student',
      'Sign off a skill for a student',
      'Submit scheduling availability for an upcoming poll',
      'Create or complete a task',
      'View notifications — mark all as read',
    ],
  },
  {
    role: 'Student',
    icon: GraduationCap,
    color: 'bg-cyan-600',
    path: [
      'Sign in with student @pmi.edu account',
      'Navigate to student portal',
      'View My Progress — verify skill completion %',
      'View clinical hours — verify hours total',
      'View portfolio — check scenario history',
      'Attempt to access /admin — verify redirect',
      'Check profile settings — update display name',
    ],
  },
  {
    role: 'Guest',
    icon: UserX,
    color: 'bg-gray-500',
    path: [
      'Use a guest access token/link to log in',
      'Verify limited navigation options are shown',
      'Attempt to access lab schedule (read-only expected)',
      'Attempt to access student records — verify blocked',
      'Attempt to access admin panel — verify blocked',
      'Verify no ability to modify any data',
    ],
  },
];

// ---------------------------------------------------------------------------
// Priority config
// ---------------------------------------------------------------------------

const PRIORITY_CONFIG: Record<Priority, { label: string; classes: string; dot: string }> = {
  Critical: {
    label: 'Critical',
    classes: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    dot: 'bg-red-500',
  },
  High: {
    label: 'High',
    classes: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
    dot: 'bg-orange-500',
  },
  Medium: {
    label: 'Medium',
    classes: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    dot: 'bg-yellow-500',
  },
  Low: {
    label: 'Low',
    classes: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    dot: 'bg-gray-400',
  },
};

const STATUS_CONFIG: Record<Status, { label: string; icon: React.ComponentType<{ className?: string }>; classes: string }> = {
  pass: { label: 'Pass', icon: CheckCircle2, classes: 'text-green-600 dark:text-green-400' },
  fail: { label: 'Fail', icon: XCircle, classes: 'text-red-600 dark:text-red-400' },
  skip: { label: 'Skip', icon: MinusCircle, classes: 'text-gray-500 dark:text-gray-400' },
  untested: { label: 'Not Tested', icon: Circle, classes: 'text-gray-400 dark:text-gray-500' },
};

// ---------------------------------------------------------------------------
// LocalStorage key
// ---------------------------------------------------------------------------

const LS_KEY = 'pmi_qa_checklist_v1';
const LS_TIMESTAMP_KEY = 'pmi_qa_checklist_updated_v1';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildInitialGroups(): ChecklistGroup[] {
  return INITIAL_GROUPS.map((g) => ({ ...g, collapsed: false }));
}

function loadFromStorage(): { groups: ChecklistGroup[]; timestamp: string | null } {
  if (typeof window === 'undefined') return { groups: buildInitialGroups(), timestamp: null };
  try {
    const raw = localStorage.getItem(LS_KEY);
    const ts = localStorage.getItem(LS_TIMESTAMP_KEY);
    if (!raw) return { groups: buildInitialGroups(), timestamp: null };
    const saved: Record<string, { status: Status; notes: string }> = JSON.parse(raw);
    const groups = buildInitialGroups().map((g) => ({
      ...g,
      items: g.items.map((item) => ({
        ...item,
        status: saved[item.id]?.status ?? item.status,
        notes: saved[item.id]?.notes ?? item.notes,
      })),
    }));
    return { groups, timestamp: ts };
  } catch {
    return { groups: buildInitialGroups(), timestamp: null };
  }
}

function saveToStorage(groups: ChecklistGroup[]) {
  if (typeof window === 'undefined') return;
  const flat: Record<string, { status: Status; notes: string }> = {};
  groups.forEach((g) => g.items.forEach((item) => {
    flat[item.id] = { status: item.status, notes: item.notes };
  }));
  localStorage.setItem(LS_KEY, JSON.stringify(flat));
  const ts = new Date().toISOString();
  localStorage.setItem(LS_TIMESTAMP_KEY, ts);
  return ts;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PriorityBadge({ priority }: { priority: Priority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.classes}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function StatusIcon({ status }: { status: Status }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return <Icon className={`w-5 h-5 ${cfg.classes}`} />;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function QAChecklistPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUserMinimal | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [groups, setGroups] = useState<ChecklistGroup[]>(buildInitialGroups());
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

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
        if (!canAccessAdmin(data.user.role)) {
          router.push('/');
          return;
        }
        setCurrentUser(data.user);
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    }
    setAuthLoading(false);
  };

  // ---------------------------------------------------------------------------
  // Load from localStorage on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const { groups: loaded, timestamp } = loadFromStorage();
    setGroups(loaded);
    setLastUpdated(timestamp);
  }, []);

  // ---------------------------------------------------------------------------
  // Mutations — always save to localStorage
  // ---------------------------------------------------------------------------

  const updateItem = useCallback((groupId: string, itemId: string, field: 'status' | 'notes', value: string) => {
    setGroups((prev) => {
      const next = prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          items: g.items.map((item) =>
            item.id !== itemId ? item : { ...item, [field]: value }
          ),
        };
      });
      const ts = saveToStorage(next);
      if (ts) setLastUpdated(ts);
      return next;
    });
  }, []);

  const toggleGroup = useCallback((groupId: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, collapsed: !g.collapsed } : g))
    );
  }, []);

  const markGroupAllPassed = useCallback((groupId: string) => {
    setGroups((prev) => {
      const next = prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          items: g.items.map((item) => ({ ...item, status: 'pass' as Status })),
        };
      });
      const ts = saveToStorage(next);
      if (ts) setLastUpdated(ts);
      return next;
    });
  }, []);

  const resetChecklist = useCallback(() => {
    const fresh = buildInitialGroups();
    setGroups(fresh);
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_TIMESTAMP_KEY);
    setLastUpdated(null);
    setShowResetConfirm(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  const allItems = groups.flatMap((g) => g.items);
  const total = allItems.length;
  const passed = allItems.filter((i) => i.status === 'pass').length;
  const failed = allItems.filter((i) => i.status === 'fail').length;
  const skipped = allItems.filter((i) => i.status === 'skip').length;
  const untested = allItems.filter((i) => i.status === 'untested').length;
  const tested = total - untested;
  const progressPct = total > 0 ? Math.round((tested / total) * 100) : 0;

  // ---------------------------------------------------------------------------
  // Filter logic
  // ---------------------------------------------------------------------------

  const filteredGroups = groups.map((g) => ({
    ...g,
    items: filterMode === 'all'
      ? g.items
      : filterMode === 'untested'
        ? g.items.filter((i) => i.status === 'untested')
        : g.items.filter((i) => i.status === 'fail'),
  })).filter((g) => g.items.length > 0 || filterMode === 'all');

  // ---------------------------------------------------------------------------
  // Render guards
  // ---------------------------------------------------------------------------

  if (status === 'loading' || authLoading) return <PageLoader />;
  if (!session || !currentUser) return null;

  // ---------------------------------------------------------------------------
  // JSX
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
          body { background: white !important; }
          .print-card { box-shadow: none !important; border: 1px solid #e5e7eb !important; }
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">

        {/* Header */}
        <div className="bg-white dark:bg-gray-800 shadow-sm no-print">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
              <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
                <Home className="w-3 h-3" />
                Home
              </Link>
              <ChevronRight className="w-4 h-4" />
              <Link href="/admin" className="hover:text-blue-600 dark:hover:text-blue-400">
                Admin
              </Link>
              <ChevronRight className="w-4 h-4" />
              <span className="text-gray-900 dark:text-white">QA Checklist</span>
            </div>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <ClipboardCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">QA Checklist Generator</h1>
                  <p className="text-gray-600 dark:text-gray-400">
                    Comprehensive quality assurance checklist for all major features
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Print / PDF
                </button>
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 text-sm font-medium transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">

          {/* Print header (only visible when printing) */}
          <div className="hidden print:block mb-4">
            <h1 className="text-3xl font-bold text-gray-900">PMI EMS Scheduler — QA Checklist</h1>
            <p className="text-gray-600 mt-1">Generated: {new Date().toLocaleString()}</p>
          </div>

          {/* Reset confirm */}
          {showResetConfirm && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 flex items-start gap-3 no-print">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-900 dark:text-red-100">Reset checklist?</p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-0.5">
                  This will clear all test results, statuses, and notes. This cannot be undone.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={resetChecklist}
                    className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Yes, reset all
                  </button>
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="px-4 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Summary / Progress */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow p-5 print-card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 dark:text-white text-lg">Progress Summary</h2>
              {lastUpdated && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Last updated: {new Date(lastUpdated).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">{tested} of {total} tested</span>
                <span className="font-semibold text-gray-900 dark:text-white">{progressPct}%</span>
              </div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{passed}</p>
                <p className="text-xs text-green-600 dark:text-green-500 mt-0.5 font-medium">Passed</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-700 dark:text-red-400">{failed}</p>
                <p className="text-xs text-red-600 dark:text-red-500 mt-0.5 font-medium">Failed</p>
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{skipped}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium">Skipped</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{untested}</p>
                <p className="text-xs text-blue-600 dark:text-blue-500 mt-0.5 font-medium">Not Tested</p>
              </div>
            </div>
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-3 flex-wrap no-print">
            <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Show:</span>
            {(['all', 'untested', 'failed'] as FilterMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {mode === 'all' ? 'All items' : mode === 'untested' ? `Untested (${untested})` : `Failed (${failed})`}
              </button>
            ))}
          </div>

          {/* Checklist groups */}
          <div className="space-y-4">
            {filteredGroups.map((group) => {
              const groupItems = group.items;
              const groupPassed = groupItems.filter((i) => i.status === 'pass').length;
              const groupFailed = groupItems.filter((i) => i.status === 'fail').length;
              const GroupIcon = group.icon;

              return (
                <div
                  key={group.id}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow overflow-hidden print-card"
                >
                  {/* Group header */}
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className={`p-2 rounded-lg ${group.color} flex-shrink-0`}>
                      <GroupIcon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{group.name}</h3>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {groupPassed}/{groupItems.length} passed
                        </span>
                        {groupFailed > 0 && (
                          <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full font-semibold">
                            {groupFailed} failed
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 no-print">
                      <button
                        onClick={() => markGroupAllPassed(group.id)}
                        className="text-xs px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors font-medium"
                      >
                        Mark all passed
                      </button>
                      <button
                        onClick={() => toggleGroup(group.id)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        aria-label={group.collapsed ? 'Expand group' : 'Collapse group'}
                      >
                        {group.collapsed ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronUp className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Group items */}
                  {!group.collapsed && (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {groupItems.map((item) => {
                        const isTested = item.status !== 'untested';
                        return (
                          <div
                            key={item.id}
                            className={`px-5 py-4 transition-colors ${
                              item.status === 'fail'
                                ? 'bg-red-50/50 dark:bg-red-900/10'
                                : item.status === 'pass'
                                  ? 'bg-green-50/30 dark:bg-green-900/5'
                                  : ''
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {/* Checkbox / status icon */}
                              <div className="flex-shrink-0 mt-0.5">
                                <StatusIcon status={item.status} />
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`font-medium text-sm ${isTested ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                                      {item.feature}
                                    </span>
                                    <PriorityBadge priority={item.priority} />
                                  </div>

                                  {/* Status selector */}
                                  <div className="flex items-center gap-1 flex-shrink-0 no-print">
                                    {(['pass', 'fail', 'skip', 'untested'] as Status[]).map((s) => {
                                      const cfg = STATUS_CONFIG[s];
                                      const Icon = cfg.icon;
                                      const isActive = item.status === s;
                                      return (
                                        <button
                                          key={s}
                                          title={cfg.label}
                                          onClick={() => updateItem(group.id, item.id, 'status', s)}
                                          className={`p-1 rounded transition-colors ${
                                            isActive
                                              ? 'bg-gray-200 dark:bg-gray-600'
                                              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                          }`}
                                        >
                                          <Icon className={`w-4 h-4 ${isActive ? cfg.classes : 'text-gray-300 dark:text-gray-600'}`} />
                                        </button>
                                      );
                                    })}
                                  </div>

                                  {/* Print-only status */}
                                  <div className="hidden print:flex items-center gap-1">
                                    <StatusIcon status={item.status} />
                                    <span className="text-xs text-gray-500">{STATUS_CONFIG[item.status].label}</span>
                                  </div>
                                </div>

                                {/* Test steps */}
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                                  {item.steps}
                                </p>

                                {/* Notes field */}
                                <div className="mt-2">
                                  <textarea
                                    value={item.notes}
                                    onChange={(e) => updateItem(group.id, item.id, 'notes', e.target.value)}
                                    placeholder="Notes / issues found..."
                                    rows={item.notes ? Math.min(4, item.notes.split('\n').length + 1) : 1}
                                    className="w-full text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 dark:placeholder:text-gray-500 no-print"
                                  />
                                  {item.notes && (
                                    <p className="hidden print:block text-xs text-gray-600 mt-1 italic">{item.notes}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* No results for filter */}
          {filteredGroups.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
              <p className="font-semibold text-gray-900 dark:text-white">
                {filterMode === 'untested' ? 'No untested items remaining!' : 'No failed items found.'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {filterMode === 'untested' ? 'All items have been reviewed.' : 'All tested items have passed or been skipped.'}
              </p>
              <button
                onClick={() => setFilterMode('all')}
                className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Show all items
              </button>
            </div>
          )}

          {/* Role-based test scenarios */}
          <div className="print-break">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-500" />
              Role-Based Test Scenarios
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {ROLE_SCENARIOS.map((scenario) => {
                const Icon = scenario.icon;
                return (
                  <div
                    key={scenario.role}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow p-5 print-card"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 rounded-lg ${scenario.color} flex-shrink-0`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{scenario.role} Test Path</h3>
                    </div>
                    <ol className="space-y-1.5">
                      {scenario.path.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-xs font-bold text-gray-400 dark:text-gray-500 mt-0.5 w-4 flex-shrink-0">{idx + 1}.</span>
                          <span className="text-sm text-gray-700 dark:text-gray-300">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Info note */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 no-print">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-900 dark:text-blue-100">About this checklist</h3>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Checklist state (statuses and notes) is automatically saved to your browser&apos;s localStorage.
                  It persists across page reloads but is device-specific. Use the Print button to generate a PDF report.
                  Use Reset to clear all results and start a fresh QA cycle.
                </p>
              </div>
            </div>
          </div>

        </main>
      </div>
    </>
  );
}
