/**
 * Format instructor name as "B. Hartnell" (first initial + last name).
 * Used in space-constrained UI like calendar blocks, station assignments, etc.
 * Use full names in edit modals and detailed views where there's room.
 */
export function formatInstructorName(name: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  const firstInitial = parts[0][0].toUpperCase();
  const lastName = parts[parts.length - 1];
  return `${firstInitial}. ${lastName}`;
}

/**
 * Format for dropdowns: "B. Hartnell (Ben Hartnell)"
 * Shows abbreviated name with full name in parentheses for disambiguation.
 */
export function formatInstructorDropdown(name: string): string {
  if (!name) return '';
  const short = formatInstructorName(name);
  if (short === name) return name; // single-word name, no abbreviation
  return `${short} (${name})`;
}
