// Small display helpers shared by the NREMT hub pages (list + day).

export function todayLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function formatHubDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function formatHubTime(t: string | null | undefined): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`;
}

/**
 * Breadcrumb props for the Coordinator View and Skill Results of an NREMT testing day, so the
 * trail reads Labs > NREMT Hub > the day > page and every crumb goes through the hub. Fed to
 * BreadcrumbNames. The URLs of those pages are unchanged; only the crumbs' labels and links.
 */
export function nremtHubDayLabel(date: string | null | undefined): string {
  if (!date) return 'NREMT Testing Day';
  const [y, m, d] = date.split('-').map(Number);
  const short = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `NREMT Testing Day, ${short}`;
}

export function nremtHubCrumbs(labDayId: string, date: string | null | undefined, pageSegment: string, pageLabel: string) {
  return {
    entityTitle: nremtHubDayLabel(date),
    customSegments: {
      'labs/schedule': 'NREMT Hub',
      [`labs/schedule/${labDayId}/${pageSegment}`]: pageLabel,
    } as Record<string, string>,
    customHrefs: {
      'labs/schedule': '/labs/nremt-hub',
      [`labs/schedule/${labDayId}`]: `/labs/nremt-hub/${labDayId}`,
    } as Record<string, string>,
  };
}

/**
 * Date-only string (YYYY-MM-DD, or an ISO string starting with one) as a LOCAL calendar date.
 * new Date('2026-11-25') reads as UTC midnight and prints as the 24th in Pacific time.
 */
export function localCalendarDate(date: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!m) return new Date(date);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
