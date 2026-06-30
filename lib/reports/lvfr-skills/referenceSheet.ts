/**
 * LVFR-AEMT skill REFERENCE sheet (Side 2b) — one BLANK page per skill.
 *
 * Two uses, one artifact: (1) guide the skill in lab, and (2) hand-document the
 * rare individual failure (cadre often has no site access, so the instructor
 * prints these and brings paper). v1 content is what we hold in the DB — name,
 * description, equipment, safety note, the introduced/practice/eval days — plus
 * a blank ruled area for performance notes and a hand sign-off block. Granular
 * per-step criteria can be layered in later from PMI/NREMT skill sheets.
 *
 * Letter portrait, PMI red branding. Pure render (no DB access).
 */

export interface ReferenceSheetSkill {
  id: string;
  category: string;
  name: string;
  description: string | null;
  nremt_tested: boolean;
  introduced_day: number | null;
  practice_days: number[] | null;
  evaluation_day: number | null;
  equipment_needed: string[] | null;
  safety_note: string | null;
}

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function whenLine(s: ReferenceSheetSkill): string {
  const parts: string[] = [];
  if (s.introduced_day != null) parts.push(`Introduced: Day ${s.introduced_day}`);
  if (s.practice_days && s.practice_days.length > 0) parts.push(`Practice: Day ${s.practice_days.join(', ')}`);
  if (s.evaluation_day != null) parts.push(`Evaluation: Day ${s.evaluation_day}`);
  return parts.join('  •  ');
}

const CSS = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Arial, Helvetica, sans-serif; color: #111827; margin: 0; font-size: 11px; }
  .page { padding: 0 2px; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .band { background: linear-gradient(90deg, #b91c1c, #7f1d1d); color: #fff; padding: 12px 16px; border-radius: 6px; }
  .band .kicker { font-size: 10px; color: #fecaca; text-transform: uppercase; letter-spacing: .5px; }
  .band h1 { margin: 2px 0 0; font-size: 18px; font-weight: 700; }
  .band .cat { font-size: 11px; color: #fde2e2; margin-top: 2px; }
  .nremt { display: inline-block; background: #fff; color: #b91c1c; font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 3px; margin-left: 8px; vertical-align: middle; }
  .when { font-size: 10px; color: #6b7280; margin: 8px 2px 0; }
  .sec { margin-top: 12px; }
  .sec h2 { font-size: 10px; text-transform: uppercase; letter-spacing: .4px; color: #991b1b; margin: 0 0 4px; border-bottom: 1px solid #e5e7eb; padding-bottom: 2px; }
  .sec p { margin: 0; line-height: 1.4; }
  ul { margin: 2px 0 0; padding-left: 18px; }
  li { margin: 1px 0; }
  .safety { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; border-radius: 6px; padding: 8px 10px; font-size: 10.5px; }
  .ruled { margin-top: 4px; }
  .ruled .line { border-bottom: 1px solid #d1d5db; height: 22px; }
  .signoff { margin-top: 16px; border-top: 1.5px solid #d1d5db; padding-top: 12px; }
  .signoff .row { display: flex; gap: 22px; margin-top: 6px; }
  .signoff .fld { flex: 1; }
  .signoff .rule { border-bottom: 1px solid #111827; height: 20px; }
  .signoff .lbl { font-size: 9px; color: #6b7280; margin-top: 3px; }
  .result { font-size: 11px; }
  .result .opt { display: inline-block; margin-right: 16px; }
  .result .circle { display: inline-block; width: 12px; height: 12px; border: 1.4px solid #111827; border-radius: 50%; vertical-align: middle; margin-right: 4px; }
  .caption { font-size: 9px; color: #6b7280; font-style: italic; margin: 8px 2px 0; }
`;

function renderOne(s: ReferenceSheetSkill): string {
  const when = whenLine(s);
  const equip = (s.equipment_needed || []).filter(Boolean);
  return `<div class="page">
    <div class="band">
      <div class="kicker">PMI LVFR AEMT — Skill Reference &amp; Competency Sheet</div>
      <h1>${esc(s.name)}${s.nremt_tested ? '<span class="nremt">NREMT</span>' : ''}</h1>
      <div class="cat">${esc(s.category)}</div>
    </div>
    ${when ? `<div class="when">${esc(when)}</div>` : ''}
    ${s.description ? `<div class="sec"><h2>Description</h2><p>${esc(s.description)}</p></div>` : ''}
    ${equip.length > 0 ? `<div class="sec"><h2>Equipment</h2><ul>${equip.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}
    ${s.safety_note ? `<div class="sec"><h2>Safety</h2><div class="safety">${esc(s.safety_note)}</div></div>` : ''}
    <div class="sec">
      <h2>Performance steps observed / notes</h2>
      <div class="ruled">
        ${'<div class="line"></div>'.repeat(8)}
      </div>
    </div>
    <div class="signoff">
      <div class="result"><strong>Result:</strong>
        <span class="opt"><span class="circle"></span>Pass</span>
        <span class="opt"><span class="circle"></span>Fail / Remediation</span>
      </div>
      <div class="row">
        <div class="fld"><div class="rule"></div><div class="lbl">Student name</div></div>
        <div class="fld" style="max-width:150px;"><div class="rule"></div><div class="lbl">Date</div></div>
      </div>
      <div class="row">
        <div class="fld"><div class="rule"></div><div class="lbl">Evaluator (print)</div></div>
        <div class="fld"><div class="rule"></div><div class="lbl">Evaluator signature</div></div>
      </div>
    </div>
    <div class="caption">Use to guide the skill in lab. For the rare individual failure/remediation, document by hand on this sheet.</div>
  </div>`;
}

/** One HTML doc, one page per skill (rendered to a single multi-page PDF). */
export function renderReferenceSheetsHTML(skills: ReferenceSheetSkill[]): string {
  const pages = skills.map(renderOne).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>LVFR AEMT Skill Reference Sheets</title><style>${CSS}</style></head><body>${pages}</body></html>`;
}
