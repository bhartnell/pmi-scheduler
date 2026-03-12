/**
 * Shared LVFR AEMT utility functions
 */

/** Derive display initials from a full name (e.g. "Benjamin Hartnell" → "BH") */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/** Derive a stable hue (0-360) from an email string for consistent avatar colours */
export function emailToHue(email: string | null | undefined): number {
  if (!email) return 200;
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

/** Determine instructor availability level for a day based on 4 time blocks */
export type AvailabilityLevel = 'full' | 'partial' | 'unavailable';

export function getAvailabilityLevel(
  blocks: { am1: boolean; mid: boolean; pm1: boolean; pm2: boolean } | undefined | null
): AvailabilityLevel {
  if (!blocks) return 'unavailable';
  const count = [blocks.am1, blocks.mid, blocks.pm1, blocks.pm2].filter(Boolean).length;
  if (count === 4) return 'full';
  if (count > 0) return 'partial';
  return 'unavailable';
}

/** Get Tailwind background class for a coverage status bar */
export function coverageStatusColor(available: number, required: number): string {
  if (available >= required) return 'bg-green-500';
  if (available > 0) return 'bg-yellow-500';
  return 'bg-red-500';
}
