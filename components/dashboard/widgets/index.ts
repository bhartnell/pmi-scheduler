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
} as const;

export type WidgetId = keyof typeof WIDGET_DEFINITIONS;

// Role-based default configurations
export const ROLE_DEFAULTS: Record<string, { widgets: string[]; quickLinks: string[] }> = {
  superadmin: {
    widgets: ['notifications', 'my_labs', 'quick_links', 'needs_attention', 'overview_stats', 'recent_feedback', 'quick_stats', 'recent_activity', 'overdue_tasks'],
    quickLinks: ['scenarios', 'students', 'schedule', 'emt_tracker', 'clinical', 'feedback', 'admin'],
  },
  admin: {
    widgets: ['notifications', 'my_labs', 'quick_links', 'needs_attention', 'overview_stats', 'recent_feedback', 'quick_stats', 'recent_activity', 'overdue_tasks'],
    quickLinks: ['scenarios', 'students', 'schedule', 'emt_tracker', 'clinical', 'feedback', 'admin'],
  },
  lead_instructor: {
    widgets: ['notifications', 'my_labs', 'quick_links', 'open_stations', 'overview_stats', 'quick_stats', 'overdue_tasks'],
    quickLinks: ['scenarios', 'students', 'schedule', 'emt_tracker', 'clinical'],
  },
  instructor: {
    widgets: ['notifications', 'onboarding', 'my_labs', 'quick_links', 'open_stations', 'overdue_tasks'],
    quickLinks: ['scenarios', 'students', 'schedule', 'my_certs', 'onboarding'],
  },
  guest: {
    widgets: ['notifications', 'quick_links'],
    quickLinks: ['scenarios', 'students'],
  },
};
