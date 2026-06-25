/**
 * AHA Megacode Testing Checklist — HTML recreation of the official 2025 form.
 *
 * Item text is transcribed verbatim from the official PDF (pdftotext). Each
 * official item carries a `dataIndex` into the matching recorded segment's
 * criteria (our seed was authored FROM these checklists, so sections align 1:1
 * — EXCEPT Tachycardia, where the official "Recognizes symptoms due to
 * tachycardia" has no recorded counterpart → dataIndex null, rendered unchecked
 * and surfaced as a "not auto-scored" note). Filled from the Checkpoint-1
 * best-attempt data; PASS/NR from overall_result. Renders to a print-to-PDF
 * styled document (NREMT pattern).
 */
import type { MegacodeReport, MegacodeReportRow, MegacodeAttempt } from '@/lib/reports/aha/megacode';
import { chainToVariant } from '@/lib/reports/aha/megacode';

export interface SignoffInstructor { name: string; ahaNumber: string | null; signatureData: string | null; signatureKind: string | null; }

interface FormItem { text: string; dataIndex: number; fill?: string } // fill = numeric fill-in (default passing value), not a checkbox
interface FormSection { key: string; heading: string; items: FormItem[]; isCprGrid?: boolean; }

const idx = (n: number): number => n;

/** Official item library keyed by our segment algorithm_type. */
const SECTIONS: Record<string, FormSection> = {
  team_leader: { key: 'team_leader', heading: 'Team Leader/Team Members', items: [
    { text: 'Team Leader assigns team member roles', dataIndex: idx(0) },
    { text: 'Team Leader ensures that team members communicate well', dataIndex: idx(1) },
  ] },
  cpr_quality: { key: 'cpr_quality', heading: 'Ensures high-quality CPR at all times', isCprGrid: true, items: [
    { text: 'Compression rate 100-120/min', dataIndex: idx(0) },
    { text: 'Compression depth of 2 inches', dataIndex: idx(1) },
    { text: 'Chest compression fraction', dataIndex: idx(2), fill: '>80%' }, // official: ___% fill-in
    { text: 'Chest recoil', dataIndex: idx(3) },
    { text: 'Ventilation rate', dataIndex: idx(4), fill: '10/min' }, // official: ___ fill-in (passing default)
  ] },
  bradycardia: { key: 'bradycardia', heading: 'Bradycardia Management', items: [
    { text: 'Starts oxygen if needed, places monitor, starts IV', dataIndex: idx(0) },
    { text: 'Places monitor leads in proper position', dataIndex: idx(1) },
    { text: 'Recognizes symptomatic/unstable bradycardia', dataIndex: idx(2) },
    { text: 'Administers correct treatment', dataIndex: idx(3) },
    { text: 'Prepares for second-line treatment', dataIndex: idx(4) },
  ] },
  tachycardia: { key: 'tachycardia', heading: 'Tachycardia Management', items: [
    { text: 'Starts oxygen if needed, places monitor, starts IV', dataIndex: idx(0) },
    { text: 'Places monitor leads in proper position', dataIndex: idx(1) },
    { text: 'Recognizes unstable tachycardia', dataIndex: idx(2) },
    { text: 'Recognizes symptoms due to tachycardia', dataIndex: idx(3) },
    { text: 'Performs immediate synchronized cardioversion', dataIndex: idx(4) },
  ] },
  pvt: { key: 'pvt', heading: 'Pulseless VT Management', items: [
    { text: 'Recognizes pVT', dataIndex: idx(0) },
    { text: 'Clears before analyze and shock', dataIndex: idx(1) },
    { text: 'Immediately resumes CPR after shocks', dataIndex: idx(2) },
    { text: 'Appropriate airway management', dataIndex: idx(3) },
    { text: 'Appropriate cycles of drug–rhythm check/shock–CPR', dataIndex: idx(4) },
    { text: 'Administers appropriate drug(s) and doses', dataIndex: idx(5) },
  ] },
  vf: { key: 'vf', heading: 'VF Management', items: [
    { text: 'Recognizes VF', dataIndex: idx(0) },
    { text: 'Clears before analyze and shock', dataIndex: idx(1) },
    { text: 'Immediately resumes CPR after shocks', dataIndex: idx(2) },
    { text: 'Appropriate airway management', dataIndex: idx(3) },
    { text: 'Appropriate cycles of drug–rhythm check/shock–CPR', dataIndex: idx(4) },
    { text: 'Administers appropriate drug(s) and doses', dataIndex: idx(5) },
  ] },
  pea: { key: 'pea', heading: 'PEA Management', items: [
    { text: 'Recognizes PEA', dataIndex: idx(0) },
    { text: "Verbalizes potential reversible causes of PEA (H's and T's)", dataIndex: idx(1) },
    { text: 'Administers appropriate drug(s) and doses', dataIndex: idx(2) },
    { text: 'Immediately resumes CPR after rhythm checks', dataIndex: idx(3) },
  ] },
  asystole: { key: 'asystole', heading: 'Asystole Management', items: [
    { text: 'Recognizes asystole', dataIndex: idx(0) },
    { text: "Verbalizes potential reversible causes of asystole (H's and T's)", dataIndex: idx(1) },
    { text: 'Administers appropriate drug(s) and doses', dataIndex: idx(2) },
    { text: 'Immediately resumes CPR after rhythm checks', dataIndex: idx(3) },
  ] },
  pcac: { key: 'pcac', heading: 'Post–Cardiac Arrest Care', items: [
    { text: 'Identifies ROSC', dataIndex: idx(0) },
    { text: 'Verbalizes need for endotracheal intubation and continuous waveform capnography, ensures BP and 12-lead ECG are performed and O2 saturation is monitored, and orders laboratory test', dataIndex: idx(1) },
    { text: 'Considers temperature control', dataIndex: idx(2) },
  ] },
};

const esc = (s: string): string => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const box = (checked: boolean): string => `<span class="bx">${checked ? '✓' : ''}</span>`;
const blank = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
function fmtDate(d: string | null): string {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  return y ? `${m}/${day}/${y}` : d;
}

type CritStatus = 'met' | 'notmet' | 'needs';
/** Status of a section's criterion by index. 'needs' = the attempt has no recorded
 *  result for it (e.g. a criterion added to the rubric after this attempt was
 *  graded) → mark manually; never shown as a false miss or a fabricated pass. */
function statusAt(attempt: MegacodeAttempt, algorithmType: string, dataIndex: number): CritStatus {
  const seg = attempt.segments.find((s) => s.algorithmType === algorithmType);
  const crit = Array.isArray(seg?.criteria) ? seg.criteria[dataIndex] : undefined;
  if (!crit || !crit.recorded) return 'needs';
  return crit.met ? 'met' : 'notmet';
}

function renderSection(sec: FormSection, attempt: MegacodeAttempt): { html: string; needs: boolean } {
  let needs = false;
  const rows = sec.items.map((it) => {
    // Numeric fill-in fields (official form has a write-in blank, not a checkbox):
    // render the passing default as an editable value, never a checkbox.
    if (it.fill !== undefined) {
      return `<tr><td class="step">${esc(it.text)}</td><td class="chk"><span class="fillval">${esc(it.fill)}</span></td></tr>`;
    }
    const st = statusAt(attempt, sec.key, it.dataIndex);
    if (st === 'needs') needs = true;
    const mark = st === 'met' ? box(true)
      : st === 'notmet' ? box(false)
      : '<span class="bx na" title="added after this attempt was graded — mark manually">▢</span>';
    return `<tr><td class="step">${esc(it.text)}${st === 'needs' ? '<sup class="na-note">†</sup>' : ''}</td><td class="chk">${mark}</td></tr>`;
  }).join('');
  return { html: `<tr class="sec"><td colspan="2">${esc(sec.heading)}</td></tr>${rows}`, needs };
}

/** Ordered section keys for an attempt: team_leader, cpr, [rhythm segments in order], pcac. */
function orderedKeys(attempt: MegacodeAttempt): string[] {
  const rhythm = attempt.segments
    .map((s) => s.algorithmType)
    .filter((a) => !['team_leader', 'cpr_quality', 'pcac'].includes(a) && SECTIONS[a]);
  return ['team_leader', 'cpr_quality', ...rhythm, 'pcac'];
}

export function renderMegacodeStudentForm(row: MegacodeReportRow & { instructor?: SignoffInstructor | null }): string {
  const a = row.best;
  const student = `${row.student.lastName}, ${row.student.firstName}`;
  if (!a) {
    return `<section class="form"><h2>Megacode Testing Checklist</h2>
      <p class="hdr">Student Name <u>${esc(student)}</u> &nbsp; Date of Test <u>&nbsp;</u></p>
      <p class="excused">No scorable megacode attempt on file — student excused / certifying separately. No form generated.</p></section>`;
  }
  const variant = row.variant ?? chainToVariant(a.chain);
  const RH: Record<string, string> = { bradycardia: 'Bradycardia', tachycardia: 'Tachycardia', pvt: 'pVT', vf: 'VF', pea: 'PEA', asystole: 'Asystole' };
  const chainLabel = `${a.chain.map((r) => RH[r] ?? r).join(' → ')} → PCAC`;
  const title = variant
    ? `Megacode Testing Checklist: Scenarios ${variant.code}`
    : `Megacode Testing Checklist`;
  const subtitle = variant ? variant.label : chainLabel;
  // Practice scenarios are AHA-permitted as testing cases; sections use the same
  // shared criteria, so the form populates validly section-by-section.
  const sourceNote = variant
    ? ''
    : `<p class="srcnote">Practice case ${esc(a.caseCode ?? '')} used as testing scenario (AHA-permitted) — scored by rhythm section.</p>`;
  const keys = orderedKeys(a);
  const rendered = keys.map((k) => SECTIONS[k] ? renderSection(SECTIONS[k], a) : { html: '', needs: false });
  const sectionsHtml = rendered.map((r) => r.html).join('');
  const hasNa = rendered.some((r) => r.needs);
  const pass = a.result === 'pass';
  const flagNote = row.flags.length ? `<p class="flag">⚠ ${row.flags.map(esc).join(' · ')}</p>` : '';
  const dateStr = fmtDate(a.stationDate); // test date = sign date = station date

  return `<section class="form">
    <h2>${esc(title)}</h2>
    <p class="sub">${esc(subtitle)}</p>
    ${sourceNote}
    <p class="hdr">Student Name <u>${esc(student)}</u> &nbsp;&nbsp; Date of Test <u>${dateStr ? esc(dateStr) : blank}</u></p>
    ${flagNote}
    <table class="ck">
      <thead><tr><th>Critical Performance Steps</th><th class="chk">Done<br>correctly</th></tr></thead>
      <tbody>${sectionsHtml}</tbody>
    </table>
    <p class="stop">STOP TEST</p>
    <p class="result">Test Results — check PASS or NR:
      <span class="pn ${pass ? 'on' : ''}">${box(pass)} PASS</span>
      <span class="pn ${!pass ? 'on' : ''}">${box(!pass)} NR</span>
    </p>
    ${hasNa ? '<p class="na-foot">† Added to the checklist after this attempt was graded — verify and mark manually.</p>' : ''}
    ${renderSignoff(row, dateStr)}
    <div class="lsc"><strong>Learning Station Competency</strong>
      <span class="lscitem">${box(true)} Bradycardia</span>
      <span class="lscitem">${box(true)} Tachycardia</span>
      <span class="lscitem">${box(true)} Cardiac Arrest/Post–Cardiac Arrest Care</span>
      <span class="lscitem">${box(true)} Megacode Practice</span>
    </div>
  </section>`;
}

function renderSignoff(row: MegacodeReportRow & { instructor?: SignoffInstructor | null }, dateStr: string): string {
  const ins = row.instructor ?? null;
  let sig = `<u>${blank}</u>`;
  if (ins) {
    if (ins.signatureData) sig = `<img class="sig" src="${ins.signatureData}" alt="signature" />`;
    else sig = `<span class="sigscript">${esc(ins.name)}</span>`;
  }
  const initials = ins ? esc(ins.name) : '<u>&nbsp;&nbsp;&nbsp;</u>';
  const num = ins?.ahaNumber ? esc(ins.ahaNumber) : '<u>&nbsp;&nbsp;&nbsp;&nbsp;</u>';
  const date = dateStr ? esc(dateStr) : '<u>&nbsp;&nbsp;&nbsp;&nbsp;</u>';
  return `<p class="signoff">Instructor ${sig} &nbsp; Initials ${initials} &nbsp; Instructor Number ${num} &nbsp; Date ${date}</p>`;
}

const STYLE = `
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; padding: 0; }
  .toolbar { position: sticky; top: 0; background: #f3f4f6; border-bottom: 1px solid #ccc; padding: 8px 12px; }
  .toolbar button { font-size: 13px; padding: 6px 14px; cursor: pointer; }
  .doc { padding: 16px; }
  .form { page-break-after: always; max-width: 7.5in; margin: 0 auto 24px; }
  h2 { font-size: 15px; margin: 0 0 2px; }
  .sub { font-size: 12px; font-weight: bold; margin: 0 0 8px; color: #333; }
  .hdr { font-size: 12px; margin: 6px 0; }
  .hdr u, .signoff u { text-decoration: none; border-bottom: 1px solid #111; padding: 0 18px; }
  table.ck { width: 100%; border-collapse: collapse; font-size: 11px; }
  table.ck th, table.ck td { border: 1px solid #444; padding: 3px 6px; text-align: left; vertical-align: top; }
  table.ck th.chk, table.ck td.chk { width: 64px; text-align: center; }
  tr.sec td { background: #ca171e; color: #fff; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  table.ck td.step { background: #efe8d5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .fillval { display: inline-block; min-width: 40px; border-bottom: 1px solid #111; font-weight: bold; }
  .lsc { margin-top: 10px; border-top: 1px solid #999; padding-top: 5px; font-size: 11px; }
  .lsc .lscitem { margin-right: 12px; white-space: nowrap; }
  .bx { display: inline-block; min-width: 16px; font-weight: bold; }
  .bx.na { color: #888; }
  .na-note { color: #b45309; }
  .stop { text-align: center; font-weight: bold; letter-spacing: 1px; margin: 8px 0 4px; }
  .result { font-size: 12px; font-weight: bold; }
  .pn { margin-left: 14px; padding: 1px 6px; border: 1px solid #999; }
  .pn.on { background: #dcfce7; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .signoff { font-size: 11px; margin-top: 10px; }
  .sig { height: 36px; vertical-align: middle; }
  .sigscript { font-family: 'Brush Script MT', 'Segoe Script', cursive; font-size: 22px; padding: 0 8px; }
  .flag { font-size: 11px; color: #b45309; margin: 2px 0; }
  .srcnote { font-size: 10px; color: #666; font-style: italic; margin: 0 0 4px; }
  .na-foot { font-size: 10px; color: #777; margin-top: 6px; }
  .excused { font-size: 12px; color: #555; font-style: italic; }
  @media print { .toolbar { display: none; } .form { margin: 0 auto; } }
`;

/** The megacode form CSS — exported so the per-student packet can merge it. */
export const MEGACODE_CSS = STYLE;

/** Full self-contained HTML document (one megacode form per student). */
export function renderMegacodeDocument(report: MegacodeReport, opts: { autoPrint?: boolean; title?: string } = {}): string {
  const forms = report.rows.map((r) => renderMegacodeStudentForm(r)).join('\n');
  const printScript = opts.autoPrint ? '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),350));</script>' : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(opts.title ?? 'AHA Megacode Testing Checklists')}</title><style>${STYLE}</style></head>
<body>
  <div class="toolbar"><button onclick="window.print()">🖨 Print / Save as PDF</button> &nbsp; ${report.summary.total} student(s) · ${report.summary.namedVariant} named-variant · ${report.summary.sectionMapped} section-mapped (practice-as-testing) · ${report.summary.noAttempt} excused/no-attempt</div>
  <div class="doc">${forms || '<p>No students in scope.</p>'}</div>
  ${printScript}
</body></html>`;
}
