/**
 * AHA skills checklists (Airway, Adult High-Quality BLS) — HTML recreation of
 * the official 2025 forms, AUTO-COMPLETED as PASS.
 *
 * These skills are verified live during/before the ACLS course but are NOT
 * scored in the app, so the export documents the verified competency: every
 * step is checked and the result is PASS. A caption states this is documenting
 * verified competency (failures are handled live; the export reflects the
 * completed/passed state). Item text transcribed from the official PDFs.
 *
 * Infant CPR is NOT included here yet — its per-cycle compression/breath
 * sub-criteria did not survive PDF text extraction (multi-column/nested cells);
 * faithful recreation needs a cleaner source or visual confirm (flagged).
 */
import type { RosterStudent } from '@/lib/reports/roster';
import type { SignoffInstructor } from '@/lib/reports/aha/megacodeForm';

interface Step { text: string; subs?: string[] }
interface Section { heading: string; note?: string; steps: Step[] }
export interface SkillsForm { id: string; program: string; title: string; scenarios?: string[]; sections: Section[] }

export const AIRWAY_FORM: SkillsForm = {
  id: 'airway', program: 'Advanced Cardiovascular Life Support',
  title: 'Airway Management Skills Testing Checklist',
  sections: [{
    heading: 'BLS Assessment and Interventions',
    steps: [
      { text: 'Checks for responsiveness', subs: ['Taps and shouts, "Are you OK?"'] },
      { text: 'Activates the emergency response system', subs: ['Shouts for nearby help / activates the emergency response system and gets the AED, OR', 'Directs second rescuer to activate the emergency response system and get the AED'] },
      { text: 'Checks breathing', subs: ['Scans chest for movement (5-10 seconds)'] },
      { text: 'Checks pulse (5-10 seconds)', subs: ['Breathing and pulse check can be done simultaneously', 'Notes that pulse is present and does not initiate chest compressions or attach AED'] },
      { text: 'Inserts oropharyngeal or nasopharyngeal airway' },
      { text: 'Administers oxygen' },
      { text: 'Performs effective bag-mask ventilation for 1 minute', subs: ['Gives proper ventilation rate (once every 6 seconds)', 'Gives proper ventilation speed (over 1 second)', 'Gives proper ventilation volume (about half a bag)'] },
    ],
  }],
};

export const ADULT_BLS_FORM: SkillsForm = {
  id: 'adult_bls', program: 'Advanced Cardiovascular Life Support',
  title: 'Adult High-Quality BLS Skills Testing Checklist',
  scenarios: [
    'Hospital: You are working in a hospital or clinic and see a person suddenly collapse in the hallway. You check that the scene is safe and approach the patient. Demonstrate what you would do next.',
    'Out-of-Hospital: You arrive on the scene for a suspected cardiac arrest. No bystander CPR has been provided. You ensure the scene is safe. Demonstrate what you would do next.',
  ],
  sections: [
    { heading: 'Assessment and Activation', steps: [
      { text: 'Checks responsiveness' },
      { text: 'Shouts for help / activates emergency response system / sends for AED' },
      { text: 'Checks breathing' },
      { text: 'Checks pulse' },
    ] },
    { heading: 'Compressions', note: 'Audio/visual feedback device required for accuracy', steps: [
      { text: 'Hand placement on lower half of sternum' },
      { text: 'Performs continuous compressions for 1 minute (100-120/min)' },
      { text: 'Compresses at least 2 inches (5 cm)' },
      { text: 'Complete chest recoil' },
    ] },
    { heading: 'AED', note: 'Follows prompts of AED', steps: [
      { text: 'Powers on AED' },
      { text: 'Correctly attaches pads' },
      { text: 'Clears for analysis' },
      { text: 'Clears to safely deliver a shock' },
      { text: 'Safely delivers a shock' },
      { text: 'Shocks within 45 seconds of AED arrival' },
    ] },
    { heading: 'Resumes Compressions', steps: [
      { text: 'Ensures compressions are resumed immediately after shock delivery' },
    ] },
  ],
};

export const SKILLS_FORMS: Record<string, SkillsForm> = { airway: AIRWAY_FORM, adult_bls: ADULT_BLS_FORM };

const esc = (s: string): string => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function signoff(ins: SignoffInstructor | null): string {
  let sig = '<u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u>';
  if (ins) sig = ins.signatureData ? `<img class="sig" src="${ins.signatureData}" alt="signature" />` : `<span class="sigscript">${esc(ins.name)}</span>`;
  const initials = ins ? esc(ins.name) : '<u>&nbsp;&nbsp;</u>';
  const num = ins?.ahaNumber ? esc(ins.ahaNumber) : '<u>&nbsp;&nbsp;&nbsp;</u>';
  return `<p class="signoff">Instructor ${sig} &nbsp; Initials ${initials} &nbsp; Instructor Number ${num} &nbsp; Date <u>&nbsp;&nbsp;&nbsp;</u></p>`;
}

function renderStudentSheet(form: SkillsForm, student: RosterStudent, ins: SignoffInstructor | null): string {
  const name = `${student.lastName}, ${student.firstName}`;
  const sections = form.sections.map((sec) => {
    const steps = sec.steps.map((st) => {
      const subs = st.subs?.length ? `<div class="subs">${st.subs.map((s) => `• ${esc(s)}`).join('<br>')}</div>` : '';
      return `<tr><td class="step">${esc(st.text)}${subs}</td><td class="chk"><span class="bx">✓</span></td></tr>`;
    }).join('');
    return `<tr class="sec"><td colspan="2">${esc(sec.heading)}${sec.note ? ` <span class="note">— ${esc(sec.note)}</span>` : ''}</td></tr>${steps}`;
  }).join('');
  const scen = form.scenarios?.length ? `<div class="scen">${form.scenarios.map((s) => `<p>${esc(s)}</p>`).join('')}</div>` : '';
  return `<section class="form">
    <p class="prog">${esc(form.program)}</p>
    <h2>${esc(form.title)}</h2>
    <p class="hdr">Student Name <u>${esc(name)}</u> &nbsp;&nbsp; Date of Test <u>&nbsp;&nbsp;&nbsp;&nbsp;</u></p>
    ${scen}
    <table class="ck"><thead><tr><th>Critical Performance Steps</th><th class="chk">Done<br>correctly</th></tr></thead><tbody>${sections}</tbody></table>
    <p class="stop">STOP TEST</p>
    <p class="result"><span class="pn on"><span class="bx">✓</span> PASS</span><span class="pn"><span class="bx"></span> NR</span></p>
    <p class="autocap">Auto-completed as PASS — documenting competency verified live during the course (these skills are not scored in-app; failures are handled live).</p>
    ${signoff(ins)}
  </section>`;
}

const STYLE = `
  * { box-sizing: border-box; } body { font-family: Arial, Helvetica, sans-serif; color:#111; margin:0; }
  .toolbar { position:sticky; top:0; background:#f3f4f6; border-bottom:1px solid #ccc; padding:8px 12px; }
  .toolbar button { font-size:13px; padding:6px 14px; cursor:pointer; }
  .doc { padding:16px; } .form { page-break-after:always; max-width:7.5in; margin:0 auto 24px; }
  .prog { font-size:11px; color:#555; margin:0; } h2 { font-size:15px; margin:0 0 6px; }
  .hdr { font-size:12px; margin:6px 0; } .hdr u,.signoff u { text-decoration:none; border-bottom:1px solid #111; padding:0 16px; }
  .scen { font-size:10px; color:#444; margin:4px 0 8px; } .scen p { margin:2px 0; }
  table.ck { width:100%; border-collapse:collapse; font-size:11px; }
  table.ck th, table.ck td { border:1px solid #444; padding:3px 6px; text-align:left; vertical-align:top; }
  table.ck th.chk, table.ck td.chk { width:64px; text-align:center; }
  tr.sec td { background:#e5e7eb; font-weight:bold; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .sec .note { font-weight:normal; font-size:10px; color:#555; } .subs { color:#555; font-size:10px; margin-top:2px; }
  .bx { display:inline-block; min-width:16px; font-weight:bold; }
  .stop { text-align:center; font-weight:bold; letter-spacing:1px; margin:8px 0 4px; }
  .result { font-size:12px; font-weight:bold; } .pn { margin-right:14px; padding:1px 6px; border:1px solid #999; }
  .pn.on { background:#dcfce7; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .autocap { font-size:10px; color:#777; font-style:italic; margin:6px 0; }
  .signoff { font-size:11px; margin-top:8px; } .sig { height:34px; vertical-align:middle; }
  .sigscript { font-family:'Brush Script MT','Segoe Script',cursive; font-size:22px; padding:0 8px; }
  @media print { .toolbar { display:none; } }
`;

export function renderSkillsDocument(form: SkillsForm, students: RosterStudent[], opts: { autoPrint?: boolean; instructor?: SignoffInstructor | null } = {}): string {
  const sheets = students.map((s) => renderStudentSheet(form, s, opts.instructor ?? null)).join('\n');
  const printScript = opts.autoPrint ? '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),350));</script>' : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(form.title)}</title><style>${STYLE}</style></head>
<body><div class="toolbar"><button onclick="window.print()">🖨 Print / Save as PDF</button> &nbsp; ${form.title} · ${students.length} student(s)</div>
<div class="doc">${sheets || '<p>No students in scope.</p>'}</div>${printScript}</body></html>`;
}
