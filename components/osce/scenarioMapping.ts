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

// ---- Map an OSCE case into the permissive shape ScenarioFullDisplay reads ----
// Only real fields are mapped. Primary assessment, history, SAMPLE and OPQRST
// are NOT parsed out of full_content (the OSCE row has no structured form of
// them), so ScenarioFullDisplay's hideEmpty hides those sections.

const VITAL_KEY_MAP: Record<string, string> = {
  BP: 'bp', HR: 'hr', RR: 'rr', SpO2: 'spo2', ETCO2: 'etco2', BGL: 'bgl', Temp: 'temp', GCS: 'gcs',
};

function mapVitalSet(set: Record<string, unknown>): { vitals: Record<string, string>; other: string[] } {
  const vitals: Record<string, string> = {};
  const other: string[] = [];
  for (const [k, v] of Object.entries(set)) {
    const t = cellText(v);
    if (t === '-') continue;
    const mapped = VITAL_KEY_MAP[k];
    if (mapped) vitals[mapped] = t;
    else other.push(`${k}: ${t}`); // unknown key: never dropped, shown as text
  }
  return { vitals, other };
}

export function mapOsceToScenario(s: ScenarioApi): Record<string, unknown> {
  const progressions = Array.isArray(s.vital_sign_progressions) ? s.vital_sign_progressions.filter(isObj) : [];
  const sections = buildPhaseSections(s.expected_interventions, s.vital_sign_progressions);
  const nums = new Set<number>();
  progressions.forEach((p, idx) => nums.add(Number(p.phase) || idx + 1));
  sections.forEach(x => nums.add(x.phase));

  const phases = Array.from(nums).sort((a, b) => a - b).map(n => {
    const idx = progressions.findIndex((p, i) => (Number(p.phase) || i + 1) === n);
    const prog = idx >= 0 ? progressions[idx] : null;
    const sec = sections.find(x => x.phase === n);
    const sets = prog && Array.isArray(prog.vitals) ? prog.vitals.filter(isObj).map(mapVitalSet) : [];
    const title = (prog && typeof prog.title === 'string' ? prog.title.trim() : '') || sec?.title || '';
    const other = sets.flatMap(x => x.other);
    return {
      name: title || `Phase ${n}`,
      vitals: sets.length > 0 && Object.keys(sets[0].vitals).length > 0 ? sets[0].vitals : null,
      // Additive optional field read by ScenarioFullDisplay: second and later vitals sets.
      vitals_extra_sets: sets.slice(1).map(x => x.vitals),
      presentation_notes: other.length ? other.join(' | ') : null,
      expected_actions: sec?.actions ?? [],
      instructor_cues: sec?.cues ? [sec.cues] : [],
    };
  });

  const dispatch = dispatchPairs(s.dispatch_text);
  let dispatch_time: string | undefined;
  let dispatch_location: string | undefined;
  const notes: string[] = [];
  const normCC = (v: string | null | undefined) => (v || '').trim().replace(/\s+/g, ' ').toLowerCase();
  for (const d of dispatch) {
    const l = (d.label || '').toLowerCase();
    if (l === 'time' && !dispatch_time) dispatch_time = d.value;
    else if (l === 'location' && !dispatch_location) dispatch_location = d.value;
    // Same chief complaint already shown under Patient Information: leave it out of the notes.
    else if (l === 'chief complaint' && normCC(d.value) === normCC(s.chief_complaint)) continue;
    // Dispatch notes text is shown without its label; any other label is kept.
    else notes.push(d.label && l !== 'dispatch notes' ? `${d.label}: ${d.value}` : d.value);
  }

  const debrief: string[] = [];
  for (const sec of buildOralSections(s.oral_board_domains)) {
    // Section is already titled "Debrief Discussion Points": drop a repeated prefix, keep any other heading.
    const repeats = !!sec.heading && /^debrief discussion points$/i.test(sec.heading.trim());
    for (const item of sec.items) debrief.push(sec.heading && !repeats ? `${sec.heading}: ${item}` : item);
  }

  const ageText = s.patient_age === null || s.patient_age === undefined ? '' : String(s.patient_age).replace(/\s*years?\s*$/i, '').trim();
  const sex = s.patient_gender === 'M' ? 'Male' : s.patient_gender === 'F' ? 'Female' : s.patient_gender || undefined;

  return {
    // no id on purpose: ScenarioFullDisplay's feedback hook then does nothing
    title: s.title,
    chief_complaint: s.chief_complaint || undefined,
    patient_name: s.patient_name || undefined,
    patient_age: ageText || undefined,
    patient_sex: sex,
    instructor_notes: s.instructor_notes || undefined,
    dispatch_time,
    dispatch_location,
    dispatch_notes: notes.length ? notes.join(' | ') : undefined,
    critical_actions: parseCriticalActions(s.critical_actions),
    phases,
    debrief_points: debrief,
  };
}
