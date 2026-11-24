// Short labels for NREMT skills (card 4225cd1c, fix 4). One shared helper so the tracker header,
// the Run the day cards and the Stations tab group headings all read the same.
// Short label by nremt_code where the code is known; any other skill keeps its own name.

const SHORT_BY_CODE: Record<string, string> = {
  E201: 'Trauma',
  E202: 'Medical',
  E203: 'BVM',
  E204: 'O2 by NRB',
  E212: 'Supine spinal',
  E213: 'Bleeding / shock',
  E215: 'Cardiac arrest / AED',
};

/** Short label for a known NREMT code, else the skill's own name (long dashes made plain). */
export function shortSkillLabel(skillName: string | null | undefined, nremtCode?: string | null): string {
  const code = (nremtCode || '').trim().toUpperCase();
  if (code && SHORT_BY_CODE[code]) return SHORT_BY_CODE[code];
  return (skillName || '').replace(/[‒–—―−]/g, '-').replace(/\s+/g, ' ').trim();
}

/** True when the code has a short label (callers may keep old abbreviations otherwise). */
export function hasShortLabel(nremtCode?: string | null): boolean {
  return !!nremtCode && !!SHORT_BY_CODE[nremtCode.trim().toUpperCase()];
}
