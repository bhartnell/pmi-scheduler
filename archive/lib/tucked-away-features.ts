/**
 * Mirrors the "Tucked away" rows of the Feature Register (Notion, Agent Ops Hub).
 * Adding a feature here is the one edit needed to surface it on /admin/tools —
 * see the Feature Register for the source of truth and Ben's Decision/Ben Note per row.
 *
 * Only add a row here after Ben sets Decision = "Tucked away" on the register.
 * This file does not decide anything; it only renders what's already decided.
 */

export interface TuckedAwayFeature {
  feature: string;
  area: string;
  href: string;
  description: string;
}

export const TUCKED_AWAY_FEATURES: TuckedAwayFeature[] = [
  {
    feature: 'Instructor Onboarding',
    area: 'Onboarding',
    href: '/onboarding',
    description: 'Assign onboarding templates to new instructors and track mentor/mentee task progress.',
  },
  {
    feature: 'OSCE Admin',
    area: 'OSCE',
    href: '/admin/osce-events',
    description: 'Create OSCE events, manage evaluator observers and guest tokens, and view results.',
  },
  {
    feature: 'Report Generator',
    area: 'Admin tools',
    href: '/reports/builder',
    description: 'Build custom reports with flexible queries and saved templates.',
  },
];
