// Safe "return to where I came from" support for pages reached from several
// places (e.g. grading opened from the ACLS board OR a lab day).
// Only same-site relative paths are accepted (no open redirects).
export function safeReturnTo(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null;
  return raw;
}

export function withReturnTo(href: string, returnTo: string): string {
  return `${href}${href.includes('?') ? '&' : '?'}returnTo=${encodeURIComponent(returnTo)}`;
}
