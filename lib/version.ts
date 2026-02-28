// Application version constants
// Bump APP_VERSION when releasing new features; the WhatsNew modal
// will automatically show to users who haven't seen this version yet.

export const APP_VERSION = '1.4.0';
export const VERSION_DATE = '2026-02-28';

export interface VersionEntry {
  version: string;
  date: string;
  added?: string[];
  changed?: string[];
  fixed?: string[];
  removed?: string[];
}

/**
 * Subset of recent changes surfaced in the "What's New" modal.
 * Keep this list to the most impactful user-facing changes for the
 * current version only; the full history lives in CHANGELOG.md.
 */
export const WHATS_NEW_ITEMS: { icon: string; text: string }[] = [
  { icon: 'shield', text: 'Error boundaries now catch crashes gracefully on every page' },
  { icon: 'wifi-off', text: 'PWA offline support - the app continues working without internet' },
  { icon: 'loader', text: 'Skeleton loading states replace blank screens while data loads' },
  { icon: 'database', text: 'Database tools page for admins: health checks and query runner' },
  { icon: 'book-open', text: 'Full help documentation with FAQ, shortcuts, and role guides' },
  { icon: 'scroll', text: 'Changelog - full version history now available in Help' },
  { icon: 'check-square', text: 'Improved form validation with inline error messages' },
  { icon: 'map', text: 'Onboarding tour replays from Settings at any time' },
];
