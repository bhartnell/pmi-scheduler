// Pure mapping from the /api/osce/scenario/[letter] response to what the
// grading page's scenario pane renders. No data is invented: every value
// shown comes straight from a real field of the response.

export interface ScenarioApi {
  scenario_letter?: string;
  title?: string;
  patient_name?: string | null;
  patient_age?: string | number | null;
  chief_complaint?: string | null;
  dispatch_text?: string | null;
  critical_actions?: unknown;
  vital_sign_progressions?: unknown;
  expected_interventions?: unknown;
  oral_board_domains?: unknown;
  full_content?: string | null;
  // Present on the signed-in /api/osce-scenarios response and, after this PR, the public one
  instructor_notes?: string | null;
  patient_gender?: string | null;
}

export const VITAL_COLUMN_ORDER = ['BP', 'HR', 'RR', 'SpO2', 'ETCO2', 'BGL', 'Temp'];

export interface VitalsRow {
  key: string;
  phaseLabel: string; // "Phase 2 - Treatment Decision" or "set 2"
  isSet: boolean;
  cells: Record<string, string>;
}

export interface VitalsTable {
  columns: string[];
  rows: VitalsRow[];
  hasMultiSet: boolean;
}

export interface PhaseSection {
  phase: number;
  title: string;
  actions: string[];
  cues: string;
}

export interface OralSection {
  heading: string | null;
  items: string[];
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return '-';
  const s = String(v).trim();
  return s === '' ? '-' : s;
}

export function parseCriticalActions(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];
}

export function buildVitalsTable(progressions: unknown): VitalsTable {
  const rows: VitalsRow[] = [];
  const keys = new Set<string>();
  if (Array.isArray(progressions)) {
    const sorted = progressions
      .filter(isObj)
      .map((p, idx) => ({ p, idx }))
      .sort((a, b) => (Number(a.p.phase) || a.idx + 1) - (Number(b.p.phase) || b.idx + 1));
    for (const { p, idx } of sorted) {
      const num = Number(p.phase) || idx + 1;
      const title = typeof p.title === 'string' ? p.title.trim() : '';
      const sets = Array.isArray(p.vitals) ? p.vitals.filter(isObj) : [];
      sets.forEach((set, i) => {
        Object.keys(set).forEach(k => keys.add(k));
        const first = i === 0;
        rows.push({
          key: `${num}-${i}`,
          phaseLabel: first
            ? `Phase ${num}${title ? ` - ${title}` : ''}${sets.length > 1 ? ' (set 1)' : ''}`
            : `set ${i + 1}`,
          isSet: !first,
          cells: Object.fromEntries(Object.entries(set).map(([k, val]) => [k, cellText(val)])),
        });
      });
    }
  }
  const extras = Array.from(keys).filter(k => !VITAL_COLUMN_ORDER.includes(k));
  const columns = [...VITAL_COLUMN_ORDER.filter(k => keys.has(k)), ...extras];
  return { columns, rows, hasMultiSet: rows.some(r => r.isSet) };
}

export function buildPhaseSections(expected: unknown, progressions: unknown): PhaseSection[] {
  if (!isObj(expected)) return [];
  const titles = new Map<number, string>();
  if (Array.isArray(progressions)) {
    progressions.filter(isObj).forEach((p, idx) => {
      const n = Number(p.phase) || idx + 1;
      if (typeof p.title === 'string') titles.set(n, p.title.trim());
    });
  }
  const map = new Map<number, PhaseSection>();
  const get = (n: number) => {
    let s = map.get(n);
    if (!s) {
      s = { phase: n, title: titles.get(n) || '', actions: [], cues: '' };
      map.set(n, s);
    }
    return s;
  };
  for (const [key, val] of Object.entries(expected)) {
    const cue = key.match(/^Phase\s+(\d+)\s+Instructor Cues\s*$/i);
    if (cue) {
      get(Number(cue[1])).cues = typeof val === 'string' ? val : '';
      continue;
    }
    const act = key.match(/^Phase\s+(\d+)\s*:\s*(.*)$/i);
    if (act) {
      const s = get(Number(act[1]));
      if (!s.title && act[2].trim()) s.title = act[2].trim();
      s.actions = Array.isArray(val) ? val.filter((x): x is string => typeof x === 'string') : [];
    }
  }
  return Array.from(map.values()).sort((a, b) => a.phase - b.phase);
}

export function buildOralSections(domains: unknown): OralSection[] {
  if (!domains) return [];
  if (Array.isArray(domains)) {
    const items = domains.map(d => {
      if (typeof d === 'string') return d;
      if (isObj(d)) return String(d.question || d.text || d.domain || JSON.stringify(d));
      return String(d);
    });
    return items.length ? [{ heading: null, items }] : [];
  }
  if (isObj(domains)) {
    return Object.entries(domains)
      .map(([heading, v]) => ({
        heading,
        items: Array.isArray(v) ? v.map(x => String(x)) : typeof v === 'string' && v.trim() ? [v] : [],
      }))
      .filter(s => s.items.length > 0);
  }
  return [];
}

export interface FullTextLine {
  text: string;
  heading: boolean;
}

// Keeps EVERY non-blank line in original order. Only blank lines are dropped.
export function buildFullTextLines(full: string | null | undefined): FullTextLine[] {
  if (!full) return [];
  return full
    .split(/\r?\n/)
    .filter(l => l.trim() !== '')
    .map(l => {
      const t = l.trim();
      const letters = t.replace(/[^A-Za-z]/g, '');
      const heading = t.length <= 60 && letters.length >= 4 && t === t.toUpperCase() && !/[a-z]/.test(t);
      return { text: l, heading };
    });
}

export function dispatchLines(dispatch: string | null | undefined): string {
  return (dispatch || '')
    .split(/\r?\n/)
    .filter(l => l.trim() !== '')
    .join('\n');
}

export interface DispatchPair {
  label: string | null;
  value: string;
}

// "Time:\n\n1045\n\nLocation:\n\n..." -> [{label:'Time', value:'1045'}, ...].
// A line ending in ":" is a label; following non-blank lines up to the next label are its value.
// Text before the first label is kept as an unlabelled entry. Nothing is dropped.
export function dispatchPairs(dispatch: string | null | undefined): DispatchPair[] {
  const lines = (dispatch || '').split(/\r?\n/).map(l => l.trim()).filter(l => l !== '');
  const out: DispatchPair[] = [];
  let cur: DispatchPair | null = null;
  for (const l of lines) {
    if (/^[^:]{1,40}:$/.test(l)) {
      cur = { label: l.slice(0, -1), value: '' };
      out.push(cur);
    } else if (cur) {
      cur.value = cur.value ? `${cur.value} ${l}` : l;
    } else {
      cur = { label: null, value: l };
      out.push(cur);
    }
  }
  return out;
}
