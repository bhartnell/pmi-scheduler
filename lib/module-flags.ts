// Module park flags: a flag's key is a route prefix; enabled=false means the module is parked.
export interface ModuleFlag {
  key: string;
  enabled: boolean;
  parked_at: string | null;
  note: string | null;
}

export function normalizeFlagKey(key: string): string {
  const k = key.trim().replace(/\/+$/, '');
  return k.startsWith('/') ? k : `/${k}`;
}

/**
 * Paths that stay live even when a parent module is parked. The LVFR pharmacology practice
 * page is student-facing, needs no login and only borrows the hosting (Ben, 2026-09-29), so
 * parking /lvfr-aemt (archive) must never take it down.
 */
export const PARK_EXEMPT_PATHS = ['/lvfr-aemt/pharm/practice'];

export function isParkExempt(pathname: string): boolean {
  return PARK_EXEMPT_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`));
}

/** Returns the parked flag covering this pathname (exact or prefix at a segment boundary), if any. */
export function findParkedFlag(pathname: string, flags: ModuleFlag[]): ModuleFlag | null {
  if (isParkExempt(pathname)) return null;
  let best: ModuleFlag | null = null;
  for (const f of flags) {
    if (f.enabled) continue;
    const k = normalizeFlagKey(f.key);
    if (pathname === k || pathname.startsWith(`${k}/`)) {
      if (!best || k.length > normalizeFlagKey(best.key).length) best = f;
    }
  }
  return best;
}

/** True when an href (nav link, home tile) points into a parked module. */
export function isHrefParked(href: string, flags: ModuleFlag[]): boolean {
  return findParkedFlag(href.split(/[?#]/)[0], flags) !== null;
}

/**
 * Section-level park: a flag keyed `/section/<page>/<name>` hides one section of a page.
 * Exact match only; a section with no parked flag stays visible, so a missing row or a
 * failed flag read can never hide content.
 */
export function isSectionParked(key: string, flags: ModuleFlag[]): boolean {
  const k = normalizeFlagKey(key);
  return flags.some(f => !f.enabled && normalizeFlagKey(f.key) === k);
}
