// Agency normalisation for OSCE evaluator preferences. students.agency is free
// text (AMR vs AMR Las Vegas, MWA vs MedicWest Ambulance, ...); the alias map in
// agency_aliases (Ben-editable) maps each spelling to a canonical name. Read-only:
// nothing here rewrites students.agency.

export const AGENCY_NONE = 'None';
export const AGENCY_DUAL = 'AMR/MedicWest';

export interface AgencyAlias { alias: string; canonical: string }

const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Canonical name for a raw students.agency value, or null when it is not in the map (never guessed). Blank = None. */
export function canonicalAgency(raw: string | null | undefined, aliases: AgencyAlias[]): string | null {
  if (raw == null || !raw.trim()) return AGENCY_NONE;
  const hit = aliases.find(a => key(a.alias) === key(raw));
  return hit ? hit.canonical : null;
}

/** Individual agencies a canonical name stands for (dual-employed counts as both). */
export function agencyParts(canonical: string | null): string[] {
  if (!canonical || canonical === AGENCY_NONE) return [];
  return canonical.split('/').map(p => p.trim()).filter(Boolean);
}

/** True when an evaluator's preferred canonical agency matches a student's canonical agency. */
export function agencyMatches(preferred: string, studentCanonical: string | null): boolean {
  return agencyParts(studentCanonical).some(p => key(p) === key(preferred));
}

/** Canonical agencies an evaluator can pick at signup (excludes dual and None). */
export function selectableAgencies(aliases: AgencyAlias[]): string[] {
  const set = new Set<string>();
  for (const a of aliases) {
    if (a.canonical !== AGENCY_NONE) agencyParts(a.canonical).forEach(p => set.add(p));
  }
  return Array.from(set).sort();
}

/** Checks a submitted preference against the selectable list; anything else is dropped, not stored. */
export function validPreferredAgency(raw: unknown, aliases: AgencyAlias[]): string | null {
  if (typeof raw !== 'string') return null;
  const hit = selectableAgencies(aliases).find(a => key(a) === key(raw));
  return hit ?? null;
}

/** agency_preference_note text that records what the evaluator actually asked for (not a bare boolean). */
export function buildPreferenceNote(agency: string | null, student: string | null, freeText: string | null | undefined): string | null {
  const parts: string[] = [];
  if (agency) parts.push(`Requested agency: ${agency}`);
  if (student) parts.push(`Requested student: ${student}`);
  if (freeText && freeText.trim()) parts.push(freeText.trim());
  return parts.length ? parts.join('. ') : null;
}
