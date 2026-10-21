// Platoon chip + day tint classes, same palette as the master calendar
// (A = blue, B = red, C = green).
export type Platoon = 'A' | 'B' | 'C' | 'off';

export function platoonTint(p: Platoon): string {
  if (p === 'A') return 'bg-blue-50/70 dark:bg-blue-900/15';
  if (p === 'B') return 'bg-rose-50/70 dark:bg-rose-900/15';
  if (p === 'C') return 'bg-emerald-50/70 dark:bg-emerald-900/15';
  return '';
}

export function platoonBadge(p: Platoon): string {
  if (p === 'A') return 'bg-blue-600 text-white';
  if (p === 'B') return 'bg-rose-600 text-white';
  if (p === 'C') return 'bg-emerald-600 text-white';
  return 'bg-gray-300 text-gray-700';
}
