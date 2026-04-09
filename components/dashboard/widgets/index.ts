export { default as NotificationsWidget } from './NotificationsWidget';
export { default as MyLabsWidget } from './MyLabsWidget';
export { default as QuickLinksWidget, QUICK_LINK_DEFINITIONS } from './QuickLinksWidget';
export { default as NeedsAttentionWidget } from './NeedsAttentionWidget';
export { default as OverviewStatsWidget } from './OverviewStatsWidget';
export { default as OpenStationsWidget } from './OpenStationsWidget';
export { default as RecentFeedbackWidget } from './RecentFeedbackWidget';
export { default as OnboardingWidget } from './OnboardingWidget';
export { default as OverdueTasksWidget } from './OverdueTasksWidget';
export { default as RecentActivityWidget } from './RecentActivityWidget';
export { default as QuickStatsWidget } from './QuickStatsWidget';
export { default as MyTasksWidget } from './MyTasksWidget';
export { default as CertExpiryWidget } from './CertExpiryWidget';
export { default as AtRiskStudentsWidget } from './AtRiskStudentsWidget';
export { default as MyCohortWidget } from './MyCohortWidget';

// Widget configuration for the customize modal
export const WIDGET_DEFINITIONS = {
  notifications: {
    id: 'notifications',
    name: 'Notifications',
    description: 'Recent unread notifications',
    defaultFor: ['all'],
  },
  my_labs: {
    id: 'my_labs',
    name: 'My Upcoming Labs',
    description: 'Labs where you are assigned as instructor',
    defaultFor: ['all'],
  },
  quick_links: {
    id: 'quick_links',
    name: 'Quick Links',
    description: 'Customizable shortcuts to common pages',
    defaultFor: ['all'],
  },
  needs_attention: {
    id: 'needs_attention',
    name: 'Needs Attention',
    description: 'Alerts for items requiring action',
    defaultFor: ['admin', 'superadmin'],
  },
  overview_stats: {
    id: 'overview_stats',
    name: 'Overview Stats',
    description: 'Summary of students, labs, and feedback',
    defaultFor: ['admin', 'superadmin'],
  },
  open_stations: {
    id: 'open_stations',
    name: 'Open Stations',
    description: 'Stations that need instructors assigned',
    defaultFor: ['instructor', 'lead_instructor'],
  },
  recent_feedback: {
    id: 'recent_feedback',
    name: 'Recent Feedback',
    description: 'Latest bug reports and feature requests',
    defaultFor: ['admin', 'superadmin'],
  },
  onboarding: {
    id: 'onboarding',
    name: 'My Onboarding',
    description: 'Track your onboarding progress and tasks',
    defaultFor: ['instructor'],
    conditional: true, // Only shows if user has active onboarding assignment
  },
  overdue_tasks: {
    id: 'overdue_tasks',
    name: 'Overdue Tasks',
    description: 'Tasks past their due date requiring immediate attention',
    defaultFor: ['all'],
  },
  my_tasks: {
    id: 'my_tasks',
    name: 'My Tasks',
    description: 'Tasks assigned to you with quick mark-complete action',
    defaultFor: ['all'],
  },
  recent_activity: {
    id: 'recent_activity',
    name: 'Recent Activity',
    description: 'Latest system activity and updates',
    defaultFor: ['admin', 'superadmin'],
  },
  quick_stats: {
    id: 'quick_stats',
    name: 'Quick Stats',
    description: 'Key metrics at a glance: students, labs, tasks, and completion rate',
    defaultFor: ['admin', 'superadmin', 'lead_instructor'],
  },
  cert_expiry: {
    id: 'cert_expiry',
    name: 'Certification Alerts',
    description: 'Certifications expiring within 90 days',
    defaultFor: ['instructor', 'lead_instructor', 'admin', 'superadmin'],
  },
  at_risk_students: {
    id: 'at_risk_students',
    name: 'Attendance Alerts',
    description: 'Students with 2+ absences or 3+ consecutive missed labs',
    defaultFor: ['admin', 'superadmin', 'lead_instructor'],
  },
  my_cohort: {
    id: 'my_cohort',
    name: 'My Cohort',
    description: 'Quick access to your primary cohort students',
    defaultFor: ['instructor', 'lead_instructor'],
    conditional: true, // Only shows if user has a primary_cohort_id set
  },
} as const;

export type WidgetId = keyof typeof WIDGET_DEFINITIONS;

// ============================================
// Role-based widget whitelists
// Only widgets in this list can be enabled for each role.
// Guest/pending have NO customizable widgets.
// ============================================
export const WIDGET_WHITELIST: Record<string, string[]> = {
  superadmin: Object.keys(WIDGET_DEFINITIONS), // all widgets
  admin: Object.keys(WIDGET_DEFINITIONS),
  lead_instructor: Object.keys(WIDGET_DEFINITIONS),
  agency_liaison: ['notifications', 'quick_links'],
  instructor: ['my_labs', 'my_tasks', 'notifications', 'overdue_tasks', 'quick_links', 'open_stations', 'cert_expiry', 'onboarding', 'quick_stats', 'my_cohort'],
  volunteer_instructor: ['my_labs', 'notifications'],
  program_director: ['notifications'],
  agency_observer: ['notifications', 'quick_links'],
  student: ['my_labs', 'my_tasks'],
  guest: [],
  pending: [],
};

/**
 * Get the widget whitelist for a given role.
 * Returns empty array for unknown roles.
 */
export function getWidgetWhitelist(role: string): string[] {
  return WIDGET_WHITELIST[role] || [];
}

/**
 * Filter a widget list to only include widgets allowed for the given role.
 */
export function filterWidgetsByRole(widgets: string[], role: string): string[] {
  const whitelist = getWidgetWhitelist(role);
  return widgets.filter(w => whitelist.includes(w));
}

// Quick link whitelists per role
export const QUICK_LINK_WHITELIST: Record<string, string[]> = {
  superadmin: ['scenarios', 'students', 'schedule', 'emt_tracker', 'aemt_tracker', 'clinical', 'internships', 'admin', 'feedback', 'my_certs', 'learning_styles', 'cohorts', 'lab_days', 'skill_sheets', 'reports', 'onboarding', 'todays_labs', 'tasks', 'ekg_warmup', 'case_studies', 'lvfr_dashboard', 'lvfr_calendar', 'lvfr_scheduling', 'lvfr_pharm'],
  admin: ['scenarios', 'students', 'schedule', 'emt_tracker', 'aemt_tracker', 'clinical', 'internships', 'admin', 'feedback', 'my_certs', 'learning_styles', 'cohorts', 'lab_days', 'skill_sheets', 'reports', 'onboarding', 'todays_labs', 'tasks', 'ekg_warmup', 'case_studies', 'lvfr_dashboard', 'lvfr_calendar', 'lvfr_scheduling', 'lvfr_pharm'],
  lead_instructor: ['scenarios', 'students', 'schedule', 'emt_tracker', 'aemt_tracker', 'clinical', 'internships', 'my_certs', 'learning_styles', 'cohorts', 'lab_days', 'skill_sheets', 'reports', 'onboarding', 'todays_labs', 'tasks', 'ekg_warmup', 'case_studies', 'lvfr_dashboard', 'lvfr_calendar', 'lvfr_scheduling', 'lvfr_pharm'],
  agency_liaison: ['lvfr_dashboard', 'lvfr_calendar', 'lvfr_scheduling', 'lvfr_pharm'],
  instructor: ['scenarios', 'students', 'schedule', 'my_certs', 'onboarding', 'todays_labs', 'tasks', 'skill_sheets', 'ekg_warmup', 'case_studies', 'lvfr_dashboard', 'lvfr_calendar', 'lvfr_scheduling', 'lvfr_pharm'],
  volunteer_instructor: ['schedule', 'todays_labs'],
  program_director: ['clinical'],
  agency_observer: ['lvfr_dashboard', 'lvfr_calendar', 'lvfr_pharm'],
  student: ['case_studies'],
  guest: [],
  pending: [],
};

// Role-based default configurations
export const ROLE_DEFAULTS: Record<string, { widgets: string[]; quickLinks: string[] }> = {
  superadmin: {
    widgets: ['needs_attention', 'at_risk_students', 'overview_stats', 'my_tasks', 'quick_stats', 'my_labs', 'overdue_tasks', 'notifications', 'recent_activity', 'cert_expiry', 'recent_feedback', 'quick_links'],
    quickLinks: ['scenarios', 'students', 'schedule', 'emt_tracker', 'clinical', 'feedback', 'admin'],
  },
  admin: {
    widgets: ['needs_attention', 'at_risk_students', 'overview_stats', 'my_tasks', 'quick_stats', 'my_labs', 'overdue_tasks', 'notifications', 'recent_activity', 'cert_expiry', 'recent_feedback', 'quick_links'],
    quickLinks: ['scenarios', 'students', 'schedule', 'emt_tracker', 'clinical', 'feedback', 'admin'],
  },
  lead_instructor: {
    widgets: ['needs_attention', 'my_tasks', 'my_labs', 'at_risk_students', 'overview_stats', 'quick_stats', 'open_stations', 'overdue_tasks', 'cert_expiry', 'notifications', 'quick_links'],
    quickLinks: ['scenarios', 'students', 'schedule', 'emt_tracker', 'clinical'],
  },
  agency_liaison: {
    widgets: ['notifications', 'quick_links'],
    quickLinks: ['lvfr_dashboard', 'lvfr_calendar', 'lvfr_scheduling', 'lvfr_pharm'],
  },
  instructor: {
    widgets: ['my_cohort', 'my_tasks', 'my_labs', 'notifications', 'overdue_tasks', 'open_stations', 'cert_expiry', 'quick_links'],
    quickLinks: ['scenarios', 'students', 'schedule', 'my_certs', 'onboarding'],
  },
  volunteer_instructor: {
    widgets: ['my_labs', 'notifications'],
    quickLinks: ['schedule', 'todays_labs'],
  },
  program_director: {
    widgets: ['notifications'],
    quickLinks: ['clinical'],
  },
  agency_observer: {
    widgets: ['notifications', 'quick_links'],
    quickLinks: ['lvfr_dashboard', 'lvfr_calendar', 'lvfr_pharm'],
  },
  student: {
    widgets: ['my_labs', 'my_tasks'],
    quickLinks: [],
  },
  guest: {
    widgets: [],
    quickLinks: [],
  },
  pending: {
    widgets: [],
    quickLinks: [],
  },
};
