// Pre-Internship Self-Assessment: instructor-side scoring and output (Rae's app.js, RAE R3/3).
// Ported as written: scoring, gap labels, calibration thresholds and summary-drafting
// rules are Rae's and must not drift. Pure functions, no DOM and no network, so the
// page and the tests share one implementation.
//
// Agency output only ever reads reflection r3. r1 and r2 are instructor-only and are
// never read by anything in the summary, plain-text or CSV builders below.
import { SA_DOMAINS, SA_LEVELS, SA_PREFS, SA_SCENARIOS } from './preinternship-content.ts';

export interface SaRecord {
  ratings?: Record<string, number>;
  scenarios?: Record<string, string>;
  reflections?: Record<string, string>;
  prefs?: { learn?: number | null; feedback?: number | null; autonomy?: number | null; challenges?: number[] };
  name?: string;
  cohort?: string;
  email?: string;
  submittedAt?: string;
}

export interface SaEdit {
  instr: Record<string, number>;
  academic: { cog?: string; skills?: string };
  summary: { strengths?: string; growth?: string; match?: string; comments?: string };
  preparedBy?: string;
  updatedAt?: string;
}

export type Tone = 'bad' | 'warn' | 'ok' | 'info' | '';

const DNAME: Record<string, string> = Object.fromEntries(SA_DOMAINS.map((d) => [d.id, d.name]));

export const blankEdit = (): SaEdit => ({
  instr: {},
  academic: { cog: '', skills: '' },
  summary: { strengths: '', growth: '', match: '', comments: '' },
  preparedBy: '',
});

export function scenarioScore(rec: SaRecord) {
  let total = 0;
  const items = SA_SCENARIOS.map((s) => {
    const k = rec.scenarios?.[s.id];
    const o = s.options.find((x) => x.k === k);
    const sc = o ? o.s : null;
    if (sc != null) total += sc;
    return { s, o, sc };
  });
  return { total, max: SA_SCENARIOS.length * 2, items };
}

export function gapInfo(self?: number, ins?: number): { d: number | null; cls: Tone; label: string } {
  if (!self || !ins) return { d: null, cls: '', label: ins ? '' : 'Not rated' };
  const d = self - ins;
  if (d >= 2) return { d, cls: 'bad', label: 'Self much higher' };
  if (d === 1) return { d, cls: 'warn', label: 'Self slightly higher' };
  if (d === 0) return { d, cls: 'ok', label: 'Aligned' };
  if (d === -1) return { d, cls: 'info', label: 'Self slightly lower' };
  return { d, cls: 'info', label: 'Self much lower' };
}

export function calibration(rec: SaRecord, edit?: SaEdit | null): { mean: number; cls: Tone; label: string } | null {
  const ds = SA_DOMAINS.map((d) => [rec.ratings?.[d.id], edit?.instr?.[d.id]] as const)
    .filter((p): p is readonly [number, number] => !!p[0] && !!p[1]);
  if (!ds.length) return null;
  const mean = ds.reduce((t, [a, b]) => t + (a - b), 0) / ds.length;
  if (mean > 0.5) return { mean, cls: 'warn', label: 'Rates self higher' };
  if (mean < -0.5) return { mean, cls: 'info', label: 'Rates self lower' };
  return { mean, cls: 'ok', label: 'Well calibrated' };
}

export const isFullyRated = (edit?: SaEdit | null) => !!edit && SA_DOMAINS.every((d) => edit.instr?.[d.id]);

export function autoSummary(rec: SaRecord, edit: SaEdit) {
  const eff = (d: { id: string }) => edit.instr?.[d.id] || rec.ratings?.[d.id] || 0;
  const strengths = SA_DOMAINS.filter((d) => eff(d) >= 3).sort((a, b) => eff(b) - eff(a)).slice(0, 3).map((d) => d.name);
  const over = SA_DOMAINS.filter((d) => rec.ratings?.[d.id] && edit.instr?.[d.id] && rec.ratings[d.id] - edit.instr[d.id] >= 2);
  const growthSet = [...SA_DOMAINS.filter((d) => eff(d) && eff(d) <= 2).sort((a, b) => eff(a) - eff(b)), ...over];
  const growth = [...new Set(growthSet.map((d) => d.name))].slice(0, 3);
  const sc = scenarioScore(rec);
  const missed = sc.items.filter((i) => i.sc === 0).map((i) => DNAME[i.s.domain]);
  const cal = calibration(rec, edit);
  const p = rec.prefs || {};
  const lines: string[] = [];
  if (p.learn != null) lines.push(SA_PREFS.learn.match![p.learn]);
  if (p.feedback != null) lines.push(SA_PREFS.feedback.match![p.feedback]);
  const leadOver = over.some((d) => d.id === 'lead');
  if (p.autonomy === 0) {
    lines.push(leadOver
      ? 'Wants early autonomy, but rates their scene leadership higher than instructors do. A preceptor who sets clear expectations on day one and corrects directly in the moment is a good fit.'
      : 'Ready for early autonomy. A preceptor comfortable letting the student run calls and debriefing afterward is a good fit.');
  } else if (p.autonomy === 1) {
    lines.push('Prefers graduated autonomy, leading lower-acuity calls first.');
  } else if (p.autonomy === 2) {
    lines.push(cal && cal.mean < -0.5
      ? 'Prefers to observe first and tends to underrate their own ability. A preceptor who hands off calls on a clear timeline and names what the student does well will build confidence.'
      : "Prefers to observe for the first few shifts. Set a clear point at which the student takes the lead so the observation period doesn't stretch out.");
  }
  if (cal && cal.mean > 0.5 && !leadOver) {
    lines.push('Self-ratings run higher than instructor ratings overall. Frequent, specific feedback early in the internship is recommended.');
  }
  if (p.challenges?.length) {
    lines.push('Self-identified stressors: ' + p.challenges.map((i) => SA_PREFS.challenges.options[i].toLowerCase()).join('; ') + '.');
  }
  if (missed.length) {
    lines.push('Scenario choices suggest coaching in ' + [...new Set(missed)].map((x) => x.toLowerCase()).join(' and ') + '.');
  }
  return { strengths: strengths.join('\n'), growth: growth.join('\n'), match: lines.join(' ') };
}

export const listItems = (text?: string) => (text || '').split(/\n+/).map((s) => s.trim()).filter(Boolean);

export const slug = (s?: string) => (s || 'student').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'student';

export const fmtDate = (iso?: string) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return iso; }
};

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);

/** The only student-written text allowed into agency output. */
const agencyNote = (rec: SaRecord) => (rec.reflections?.r3 || '').trim();

/** One-page agency summary as a standalone HTML document (download). */
export function summaryStandalone(rec: SaRecord, edit: SaEdit): string {
  const sc = scenarioScore(rec);
  const s = edit.summary || {};
  const rows = SA_DOMAINS.map((d) => {
    const a = rec.ratings?.[d.id];
    const b = edit.instr?.[d.id];
    const g = gapInfo(a, b);
    return `<tr><td>${esc(d.name)}</td><td class="num">${a || '-'}</td><td class="num">${b || '-'}</td><td>${g.label ? `<span class="tag ${g.cls}">${esc(g.label)}</span>` : ''}</td></tr>`;
  }).join('');
  const li = (t?: string) => {
    const xs = listItems(t);
    return xs.length ? `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="muted">Not yet written.</p>';
  };
  const note = agencyNote(rec);
  const body = `<div class="sh-head"><div><div class="eyebrow">Pre-internship student profile</div><h2>${esc(rec.name || 'Student')}</h2>
<div class="muted">${esc(rec.cohort || '')}</div></div>
<div class="muted" style="text-align:right">PMI Las Vegas - Paramedic Program<br>${edit.preparedBy ? `Prepared by ${esc(edit.preparedBy)} - ` : ''}${esc(fmtDate(edit.updatedAt || new Date().toISOString()))}</div></div>
${(edit.academic?.cog || edit.academic?.skills) ? `<div class="two">
${edit.academic?.cog ? `<div><h4>Cognitive standing</h4><p>${esc(edit.academic.cog)}</p></div>` : ''}
${edit.academic?.skills ? `<div><h4>Psychomotor / skills</h4><p>${esc(edit.academic.skills)}</p></div>` : ''}</div>` : ''}
<div class="two"><div><h4>Strengths</h4>${li(s.strengths)}</div><div><h4>Growth areas</h4>${li(s.growth)}</div></div>
<div><h4>Preceptor match</h4>${s.match ? `<p>${esc(s.match)}</p>` : '<p class="muted">Not yet written.</p>'}</div>
<div><h4>Professional behaviors, self vs. instructor (1-4)</h4><table>
<thead><tr><th>Behavior</th><th>Self</th><th>Instr.</th><th>Comparison</th></tr></thead><tbody>${rows}</tbody></table>
<p class="muted">Scale: 1 Needs direction, 2 Developing, 3 Consistent, 4 Leads. Scenario judgment: ${sc.total}/${sc.max}.</p></div>
${s.comments ? `<div><h4>Instructor comments</h4><p style="white-space:pre-wrap">${esc(s.comments)}</p></div>` : ''}
${note ? `<div><h4>From the student</h4><p class="quote">${esc(note)}</p></div>` : ''}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(rec.name)} - Pre-Internship Profile</title>
<style>body{font-family:Arial,Helvetica,sans-serif;color:#16212B;max-width:760px;margin:32px auto;padding:0 20px;line-height:1.45;font-size:14px}
h2{margin:0;font-size:24px}.eyebrow,h4{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#5A6774;margin:0 0 4px}
.sh-head{display:flex;justify-content:space-between;gap:10px;border-bottom:2px solid #16212B;padding-bottom:10px;margin-bottom:14px}
.muted{color:#5A6774}.two{display:flex;gap:24px}.two>div{flex:1}div{margin-bottom:12px}ul{margin:0;padding-left:18px}
table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #D6DEE6;padding:6px 8px;text-align:left}td.num{text-align:center}
th{font-size:11px;text-transform:uppercase;color:#5A6774}.tag{font-size:11px;padding:1px 6px;border:1px solid #D6DEE6;border-radius:9px}
.tag.bad{color:#A8261D;border-color:#A8261D}.tag.warn{color:#9A5B00;border-color:#9A5B00}.tag.ok{color:#276B44;border-color:#276B44}.tag.info{color:#1D5FA6;border-color:#1D5FA6}
.quote{border-left:3px solid #D6DEE6;padding-left:10px;white-space:pre-wrap}@media print{body{margin:0}}</style></head><body>${body}</body></html>`;
}

/** One-page agency summary as plain text (copy). */
export function summaryPlain(rec: SaRecord, edit: SaEdit): string {
  const s = edit.summary || {};
  const L = ['PRE-INTERNSHIP STUDENT PROFILE', `${rec.name} (${rec.cohort})`,
    `PMI Las Vegas Paramedic Program${edit.preparedBy ? ` - Prepared by ${edit.preparedBy}` : ''}`, ''];
  if (edit.academic?.cog) L.push(`Cognitive standing: ${edit.academic.cog}`);
  if (edit.academic?.skills) L.push(`Psychomotor / skills: ${edit.academic.skills}`);
  L.push('', 'STRENGTHS', ...listItems(s.strengths).map((x) => '- ' + x), '', 'GROWTH AREAS',
    ...listItems(s.growth).map((x) => '- ' + x), '', 'PRECEPTOR MATCH', s.match || '', '', 'SELF vs INSTRUCTOR (1-4)');
  SA_DOMAINS.forEach((d) => {
    const a = rec.ratings?.[d.id];
    const b = edit.instr?.[d.id];
    L.push(`- ${d.name}: self ${a || '-'}, instructor ${b || '-'}${a && b ? ` (${gapInfo(a, b).label})` : ''}`);
  });
  const sc = scenarioScore(rec);
  L.push(`Scenario judgment: ${sc.total}/${sc.max}`);
  if (s.comments) L.push('', 'INSTRUCTOR COMMENTS', s.comments);
  const note = agencyNote(rec);
  if (note) L.push('', 'FROM THE STUDENT', note);
  return L.join('\n');
}

/** Cohort CSV, one row per student. UTF-8 BOM so Excel opens it cleanly. */
export function buildCsv(rows: { rec: SaRecord; edit: SaEdit | null }[]): string {
  const head = ['Name', 'Cohort', 'Email', 'Submitted',
    ...SA_DOMAINS.flatMap((d) => [`${d.name} (self)`, `${d.name} (instructor)`]),
    'Mean gap (self - instr)', 'Scenario score', ...SA_SCENARIOS.map((_, i) => `Call ${i + 1} choice`),
    'Learns best', 'Feedback preference', 'Autonomy', 'Stressors', 'Strengths', 'Growth areas', 'Preceptor match'];
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = rows.map(({ rec, edit }) => {
    const e = edit || blankEdit();
    const cal = calibration(rec, e);
    const p = rec.prefs || {};
    return [rec.name, rec.cohort, rec.email, rec.submittedAt,
      ...SA_DOMAINS.flatMap((d) => [rec.ratings?.[d.id] || '', e.instr?.[d.id] || '']),
      cal ? cal.mean.toFixed(2) : '', scenarioScore(rec).total,
      ...SA_SCENARIOS.map((s) => rec.scenarios?.[s.id] || ''),
      p.learn != null ? SA_PREFS.learn.options[p.learn] : '',
      p.feedback != null ? SA_PREFS.feedback.options[p.feedback] : '',
      p.autonomy != null ? SA_PREFS.autonomy.options[p.autonomy] : '',
      (p.challenges || []).map((i) => SA_PREFS.challenges.options[i]).join('; '),
      listItems(e.summary?.strengths).join('; '), listItems(e.summary?.growth).join('; '), e.summary?.match || '',
    ].map(q).join(',');
  });
  return '﻿' + [head.map(q).join(','), ...lines].join('\r\n');
}

export { SA_LEVELS };
