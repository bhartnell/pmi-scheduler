import {
  Calendar, CalendarDays, Users, UserCheck, CalendarOff, Truck, ClipboardList, Settings, RefreshCw,
  FlaskConical, BookOpen, FileText, Zap, Grid3x3, Timer, MessageSquare, Boxes, Target, ListChecks,
  Flag, FolderOpen, DoorOpen, Award, HeartPulse, Stethoscope, Eye, BarChart3, Hash, FileUp,
  Activity, PenLine, UserPlus, Layers,
  Shield, Wrench, Download, Upload, Webhook, Trash2, KeyRound, ScrollText, ClipboardCheck, Building2,
  GraduationCap, TrendingUp, LayoutDashboard, CalendarCheck, User, Bell, CheckSquare, LifeBuoy, Pill, MessageSquareWarning, CalendarRange,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/lib/permissions';

// TRIM 6/7b-2a: data for the section landings. Names, routes and one-line
// descriptions come from the approved mock (v4). Generic text only: no cohort
// names, no dates. Hyphens, never em dashes.

export interface LandingCard {
  name: string;
  href: string;
  description: string;
  icon: LucideIcon;
  /** Lowest role that can open the target page. Cards above the viewer's role are hidden. Default instructor. */
  minRole?: Role;
  /** Card opens a built-in action instead of navigating (href is ignored). */
  action?: 'view-as-student';
}

export interface LandingGroup {
  heading: string;
  cards: LandingCard[];
}

export interface Landing {
  /** Matches HOME_SECTIONS key (colour comes from there). */
  key: string;
  title: string;
  groups: LandingGroup[];
}

export const SCHEDULE_LANDING: Landing = {
  key: 'schedule',
  title: 'Schedule',
  groups: [
    {
      heading: 'This semester',
      cards: [
        { name: 'Master calendar', href: '/calendar', icon: CalendarDays, description: 'Every class, lab, clinical item and shift on one calendar; the home week and month read from here.' },
        { name: 'Lab days', href: '/labs/schedule', icon: FlaskConical, description: 'The lab schedule: every lab day by cohort, who is on it, open stations, Ready for Timer.' },
        { name: 'Instructor workload', href: '/reports/instructor-workload', icon: BarChart3, description: 'Per instructor: lab days, LVFR days, station types, last lab, most and least assigned.' },
      ],
    },
    {
      heading: 'Every semester',
      cards: [
        { name: 'Instructor availability', href: '/scheduling/availability', icon: UserCheck, description: 'Who is available when; full-timers default available minus their classes and labs.' },
        { name: 'Team availability', href: '/scheduling/team-availability', icon: Users, description: 'All instructors on one grid for a date range.' },
        { name: 'PTO and unavailability', href: '/scheduling/unavailability', icon: CalendarOff, description: 'Mark days off so the calendar and the default lab roster skip you.' },
        { name: 'LVFR AEMT calendar', href: '/lvfr-aemt/calendar', icon: Truck, description: 'The LVFR class days and who covers them.' },
      ],
    },
    {
      heading: 'Setup',
      cards: [
        { name: 'Semester planner', href: '/academics/planner', icon: ClipboardList, minRole: 'admin', description: "Builds the semester's class and lab blocks from templates; changes the published schedule." },
        { name: 'Default lab rosters', href: '/admin/program-rosters', icon: Users, minRole: 'admin', description: 'Which instructors are on every lab day by default, per program.' },
        { name: 'Calendar sync', href: '/admin/calendar-sync', icon: RefreshCw, minRole: 'admin', description: 'Google Calendar connections per instructor and the sync status.' },
      ],
    },
  ],
};

export const LABS_LANDING: Landing = {
  key: 'labs',
  title: 'Labs',
  groups: [
    {
      heading: 'This semester',
      cards: [
        { name: 'Lab days', href: '/labs/schedule', icon: Calendar, description: "Open a lab day: stations, instructors, Who's coming, Start Timer, grade." },
        { name: 'Scenarios', href: '/labs/scenarios', icon: BookOpen, description: 'One page: find a scenario, open and print it, create or edit one, see what ran recently. Audit and bulk import sit behind an Admin link on the same page.' },
        { name: 'Skill sheets', href: '/skill-sheets', icon: ClipboardList, description: 'NREMT and program skill sheets used at stations.' },
        { name: 'Skill drills', href: '/labs/skill-drills', icon: Zap, description: 'Short drills for S2 and S3 lab stations.' },
        { name: 'Groups', href: '/labs/groups', icon: Users, description: 'Lab groups per cohort and the team-lead rotation.' },
        { name: 'Seating charts', href: '/labs/seating/charts', icon: Grid3x3, minRole: 'lead_instructor', description: 'Seating by learning style and preference for a cohort.' },
        { name: 'Timer displays', href: '/admin/timer-displays', icon: Timer, minRole: 'admin', description: 'Station screens that follow the controller clock.' },
        { name: 'Debrief review', href: '/labs/debrief-review', icon: MessageSquare, description: 'Debrief notes from graded stations.' },
      ],
    },
    {
      heading: 'Every semester',
      cards: [
        { name: 'Station pool', href: '/labs/stations/pool', icon: Boxes, description: 'The reusable station definitions a lab day is built from.' },
        { name: 'Skills competencies', href: '/labs/skills/competencies', icon: Target, description: 'Which skills each student has been checked on, with the coverage report.' },
        { name: 'Protocol tracking', href: '/labs/protocol-tracking', icon: ListChecks, description: 'Which SNHD protocols the scenarios have covered.' },
        { name: 'Flags', href: '/labs/flags', icon: Flag, description: 'Students flagged for review from a grading sheet.' },
        { name: 'Cases', href: '/cases', icon: FolderOpen, description: 'Case files used by the station grader (leaderboard and sessions parked).' },
        { name: 'Open lab', href: '/open-lab', icon: DoorOpen, description: 'Weekly open lab sessions, signups and the QR flyer.' },
      ],
    },
    {
      heading: 'Setup',
      cards: [
        { name: 'Lab templates', href: '/labs/templates', icon: FileText, minRole: 'lead_instructor', description: 'Weekly lab day templates per program and semester; the planner loads from these.' },
        { name: 'LVFR AEMT', href: '/lvfr-aemt', icon: Truck, description: 'Its own hub: day plan, skills, grades, pharmacology practice, progress.' },
      ],
    },
  ],
};

export const TESTING_LANDING: Landing = {
  key: 'testing',
  title: 'Testing & certification',
  groups: [
    {
      heading: 'This semester',
      cards: [
        { name: 'AHA hub', href: '/labs/aha-hub', icon: Award, description: 'ACLS and PALS in one place: course days, team-lead counts, exports, blank forms.' },
        { name: 'PALS hub', href: '/labs/pals-hub', icon: Stethoscope, description: 'Course days, coordinator overview, practice grading, learning stations.' },
        { name: 'OSCE (coordinator)', href: '/admin/osce-events', icon: Layers, minRole: 'admin', description: 'The current OSCE event: blocks, evaluators, calendar events, student placement, results.' },
        { name: 'OSCE scoring', href: '/osce-scoring/enter', icon: PenLine, description: 'Enter scores at a station; the live scoring dashboard.' },
      ],
    },
    {
      heading: 'Every semester',
      cards: [
        { name: 'ACLS board', href: '/labs/acls-hub/board', icon: Activity, description: 'Live course board: groups, rotations, attendance, megacode readiness.' },
        { name: 'Megacode grading', href: '/labs/adv-cert/grade', icon: HeartPulse, description: 'ACLS megacode practice and testing grader.' },
        { name: 'Learning station watch', href: '/labs/adv-cert/learning-station', icon: Eye, description: 'What the instructor watches at an AHA learning station.' },
        { name: 'OSCE evaluator signup', href: '/osce-evaluator-signup', icon: UserPlus, description: 'The public page agency evaluators use to sign up (link to share).' },
        { name: 'OSCE results', href: '/admin/osce-results', icon: BarChart3, minRole: 'admin', description: 'Scores across all OSCE events.' },
        { name: 'AHA report', href: '/reports/aha', icon: FileText, description: 'Course completion and team-lead records for the AHA file.' },
      ],
    },
    {
      heading: 'Setup',
      cards: [
        { name: 'AHA course setup', href: '/admin/aha-courses', icon: Settings, minRole: 'admin', description: "Generate a cohort's ACLS or PALS days from the template." },
        { name: 'AHA credentials', href: '/settings/aha-credentials', icon: Hash, description: 'Instructor AHA numbers used on the signature line.' },
        { name: 'NREMT skill sheets', href: '/admin/skill-sheets/import', icon: FileUp, minRole: 'admin', description: 'Import and manage the NREMT sheets used on testing day.' },
      ],
    },
  ],
};

export const COHORTS_LANDING: Landing = {
  key: 'cohorts',
  title: 'Cohorts',
  groups: [
    {
      heading: 'This semester',
      cards: [
        { name: 'Cohorts', href: '/academics/cohorts', icon: Users, description: 'Every cohort by program and semester; open one for roster, progress and links.' },
        { name: 'Students', href: '/academics/students', icon: GraduationCap, description: 'All students; open one for their record, progress and portfolio.' },
        { name: 'Groups', href: '/labs/groups', icon: Layers, description: 'Lab groups and team-lead rotation per cohort.' },
        { name: 'Student progress', href: '/reports/student-progress', icon: TrendingUp, description: 'One student: scenarios, skills, trend against the cohort.' },
        { name: 'Cohort dashboard', href: '/reports/student-dashboard', icon: LayoutDashboard, description: 'One cohort: attendance, skills completed, clinical hours per student.' },
      ],
    },
    {
      heading: 'Every semester',
      cards: [
        { name: 'Graduate a cohort', href: '/academics/cohorts', icon: Award, description: 'On the cohort page: closes the cohort and completes its students; mark one student complete from their page.' },
        { name: 'Add students', href: '/academics/students/new', icon: UserPlus, description: 'New student or import a roster.' },
      ],
    },
    {
      heading: 'Setup',
      cards: [
        { name: 'Semesters', href: '/admin/semesters', icon: CalendarRange, minRole: 'admin', description: 'Semester dates per cohort (moves into the year setup wizard).' },
        { name: 'Program rosters', href: '/admin/program-rosters', icon: Users, minRole: 'admin', description: 'Default instructor roster per program.' },
      ],
    },
  ],
};

export const STUDENT_LANDING: Landing = {
  key: 'student',
  title: 'Student view',
  groups: [
    {
      heading: 'What a student sees',
      cards: [
        { name: 'Student home', href: '/student', icon: GraduationCap, minRole: 'student', description: 'Their schedule, their labs, what they owe.' },
        { name: 'My progress', href: '/student/my-progress', icon: TrendingUp, minRole: 'student', description: 'Skills checked, scenarios run, where they stand.' },
        { name: 'My labs', href: '/student/labs', icon: FlaskConical, minRole: 'student', description: 'Upcoming lab days and available open labs.' },
        { name: 'Pre-internship self-assessment', href: '/student/self-assessment', icon: CheckSquare, minRole: 'student', description: "Rae's ten behaviors, scenarios and reflections; opens per cohort with a due date." },
        { name: 'Final exam signup', href: '/exam-scheduling', icon: CalendarCheck, minRole: 'student', description: 'Internship-semester students pick their exam day (the student side of exam scheduling).' },
        { name: 'Skill sheets and evaluations', href: '/student/skill-sheets', icon: ClipboardList, minRole: 'student', description: 'Their sheets and recorded skill evaluations.' },
        { name: 'Profile', href: '/student/profile', icon: User, minRole: 'student', description: 'Name, cohort, contact.' },
      ],
    },
    {
      heading: 'For instructors',
      cards: [
        { name: 'View as a student', href: '/student', icon: Eye, minRole: 'admin', action: 'view-as-student', description: 'Open the student home as a chosen student would see it, read-only (admin).' },
      ],
    },
  ],
};

export const ME_LANDING: Landing = {
  key: 'me',
  title: 'Me',
  groups: [
    {
      heading: 'Mine',
      cards: [
        { name: 'My settings', href: '/settings', icon: Settings, minRole: 'student', description: 'Profile, theme, home layout (Customize), density.' },
        { name: 'Calendar setup', href: '/settings/calendar-setup', icon: CalendarDays, description: 'Connect Google Calendar; what syncs to it.' },
        { name: 'AHA credentials', href: '/settings/aha-credentials', icon: Hash, description: 'My AHA instructor numbers.' },
        { name: 'Notifications', href: '/notifications', icon: Bell, minRole: 'student', description: 'Everything addressed to me.' },
        { name: 'Tasks', href: '/tasks', icon: CheckSquare, description: 'My tasks.' },
        { name: 'My stats', href: '/instructor/my-stats', icon: BarChart3, description: 'My labs, stations and evaluations.' },
        { name: 'My feedback', href: '/feedback/my-submissions', icon: MessageSquareWarning, minRole: 'student', description: 'Reports I have filed and their status.' },
      ],
    },
    {
      heading: 'Help',
      cards: [
        { name: 'Help and wiki', href: '/help', icon: LifeBuoy, minRole: 'student', description: 'How-to pages and keyboard shortcuts.' },
        { name: 'Resources', href: '/resources', icon: Pill, description: 'Medication references and protocol links.' },
      ],
    },
  ],
};

export const REPORTS_LANDING: Landing = {
  key: 'reports',
  title: 'Reports',
  groups: [
    {
      heading: 'One student',
      cards: [
        { name: 'Student progress', href: '/reports/student-progress', icon: TrendingUp, description: 'Scenarios, skills, trend against the cohort.' },
      ],
    },
    {
      heading: 'One cohort',
      cards: [
        { name: 'Lab progress', href: '/reports/lab-progress', icon: FlaskConical, description: 'Average scenario scores, skills progress, attendance.' },
        { name: 'Cohort dashboard', href: '/reports/student-dashboard', icon: LayoutDashboard, description: 'Per-student table: attendance, skills, hours.' },
        { name: 'Team leads', href: '/reports/team-leads', icon: Users, description: 'Team-lead rotations: lab, ACLS, PALS counts per student.' },
      ],
    },
    {
      heading: 'Across cohorts and time',
      cards: [
        { name: 'Cohort comparison', href: '/reports/cohort-comparison', icon: BarChart3, description: 'Scenarios, skills and hours across cohorts.' },
        { name: 'Skill trends', href: '/reports/skill-trends', icon: TrendingUp, description: 'Skills improving or declining over time.' },
        { name: 'Scenario analytics', href: '/reports/scenario-analytics', icon: Target, description: 'Pass rates, hardest and easiest scenarios.' },
        { name: 'Scenario usage', href: '/reports/scenario-usage', icon: ListChecks, description: 'Which scenarios have run and when.' },
        { name: 'Program overview', href: '/reports/program-overview', icon: LayoutDashboard, description: 'The whole program at a glance.' },
      ],
    },
    {
      heading: 'Instructors',
      cards: [
        { name: 'Instructor workload', href: '/reports/instructor-workload', icon: BarChart3, description: 'Lab days, LVFR days, station types, last lab, most and least assigned.' },
        { name: 'Availability patterns', href: '/reports/availability-patterns', icon: UserCheck, description: 'When instructors tend to be available.' },
      ],
    },
    {
      heading: 'Clinical and AHA',
      cards: [
        { name: 'Clinical hours', href: '/reports/clinical-hours', icon: Activity, description: 'Hours by student and department.' },
        { name: 'Clinical placements', href: '/reports/clinical-placements', icon: Building2, description: 'Who is placed where.' },
        { name: 'Internship status', href: '/reports/internship-status', icon: ClipboardCheck, description: 'Internship progress across the cohort.' },
        { name: 'AHA report', href: '/reports/aha', icon: HeartPulse, description: 'Course completion records.' },
        { name: 'Onboarding status', href: '/reports/onboarding-status', icon: ClipboardList, description: 'Onboarding progress across the cohort.' },
        { name: 'Report builder', href: '/reports/builder', icon: FileText, description: 'Build a custom table.' },
      ],
    },
  ],
};

export const ADMIN_LANDING: Landing = {
  key: 'admin',
  title: 'Admin',
  groups: [
    {
      heading: 'Users and access',
      cards: [
        { name: 'Users and roles', href: '/admin/users', icon: Users, minRole: 'admin', description: 'Accounts, roles, program tags, part-time and volunteer flags.' },
        { name: 'Access and deletion requests', href: '/admin/access-requests', icon: KeyRound, minRole: 'admin', description: 'Approve volunteer self-signups and deletion requests.' },
        { name: 'Guest access', href: '/admin/guests', icon: UserPlus, minRole: 'admin', description: 'Temporary access for outside evaluators.' },
      ],
    },
    {
      heading: 'Templates and setup',
      cards: [
        { name: 'Year setup (coming)', href: '/admin/semesters', icon: CalendarRange, minRole: 'admin', description: 'Semester dates, program starts, cohort names, templates, high-priority days, holidays: one wizard.' },
        { name: 'Lab templates', href: '/admin/lab-templates', icon: Layers, minRole: 'admin', description: 'Weekly lab templates and import.' },
        { name: 'AHA course setup', href: '/admin/aha-courses', icon: HeartPulse, minRole: 'admin', description: 'Generate ACLS and PALS days.' },
        { name: 'Default lab rosters', href: '/admin/program-rosters', icon: Users, minRole: 'admin', description: 'Default instructors per program.' },
        { name: 'Scenario admin', href: '/labs/scenarios?admin=1', icon: BookOpen, minRole: 'admin', description: 'Audit and bulk import, on the Scenarios page.' },
        { name: 'Module settings', href: '/admin/module-flags', icon: Wrench, minRole: 'admin', description: 'Park or unpark a module (the TRIM switch).' },
        { name: 'Calendar sync', href: '/admin/calendar-sync', icon: RefreshCw, minRole: 'admin', description: 'Connections and sync status.' },
        { name: 'Timer displays', href: '/admin/timer-displays', icon: Timer, minRole: 'admin', description: 'Register station display screens.' },
      ],
    },
    {
      heading: 'Data and oversight',
      cards: [
        { name: 'Feedback', href: '/admin/feedback', icon: MessageSquareWarning, minRole: 'admin', description: 'Reports from the feedback button, triage status.' },
        { name: 'Audit log and user activity', href: '/admin/audit-log', icon: ScrollText, minRole: 'admin', description: 'Who changed what; who opened what.' },
        { name: 'Data export and import', href: '/admin/data-export', icon: Download, minRole: 'admin', description: 'CSV and JSON exports, scheduled exports, student import.' },
        { name: 'FERPA compliance', href: '/admin/ferpa-compliance', icon: Shield, minRole: 'admin', description: 'Student data handling record.' },
        { name: 'Settings and config', href: '/admin/settings', icon: Settings, minRole: 'admin', description: 'Site settings, webhooks, dashboard defaults.' },
      ],
    },
    {
      heading: 'More admin tools',
      cards: [
        { name: 'Roles', href: '/admin/roles', icon: Shield, minRole: 'admin', description: 'Role definitions and permissions.' },
        { name: 'Site config', href: '/admin/config', icon: Settings, minRole: 'admin', description: 'Configuration values.' },
        { name: 'Data import', href: '/admin/data-import', icon: Upload, minRole: 'admin', description: 'Import data files.' },
        { name: 'Scheduled exports', href: '/admin/scheduled-exports', icon: Download, minRole: 'admin', description: 'Exports that run on a schedule.' },
        { name: 'Deletion requests', href: '/admin/deletion-requests', icon: Trash2, minRole: 'admin', description: 'Requests waiting for superadmin approval.' },
        { name: 'User activity', href: '/admin/user-activity', icon: Activity, minRole: 'admin', description: 'Who opened what.' },
        { name: 'Exam sessions', href: '/admin/exam-sessions', icon: ClipboardCheck, minRole: 'admin', description: 'Exam session setup.' },
        { name: 'OSCE tokens', href: '/admin/osce-tokens', icon: KeyRound, minRole: 'admin', description: 'Access tokens for OSCE evaluators.' },
        { name: 'Open labs', href: '/admin/open-labs', icon: DoorOpen, minRole: 'admin', description: 'Open lab session setup.' },
        { name: 'Volunteer events', href: '/admin/volunteer-events', icon: Users, minRole: 'admin', description: 'Volunteer event setup.' },
        { name: 'Webhooks', href: '/admin/webhooks', icon: Webhook, minRole: 'admin', description: 'Outgoing webhooks.' },
        { name: 'Seed availability', href: '/admin/seed-availability', icon: UserCheck, minRole: 'admin', description: 'Seed default availability.' },
      ],
    },
  ],
};

export const LANDINGS: Record<string, Landing> = {
  schedule: SCHEDULE_LANDING,
  labs: LABS_LANDING,
  testing: TESTING_LANDING,
  cohorts: COHORTS_LANDING,
  student: STUDENT_LANDING,
  me: ME_LANDING,
  reports: REPORTS_LANDING,
  admin: ADMIN_LANDING,
};

