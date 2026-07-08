/**
 * LVFR-AEMT skills BLANK CLASS CHECKLIST.
 *
 * One compact, print-friendly document: all skills grouped by category with
 * an empty checkbox + blank date line per skill, for physically marking off
 * as the class covers them (matches the class-level, not-per-student
 * tracking model in lvfr_aemt_skill_class_completion). Distinct from the
 * Side 2b reference sheets, which are a detailed page per skill for
 * teaching/hand-documenting a failure.
 *
 * Letter portrait, PMI red branding. Pure render (no DB access).
 */

export interface BlankChecklistSkill {
  id: string;
  category: string;
  name: string;
  nremt_tested: boolean;
}

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const CSS = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Arial, Helvetica, sans-serif; color: #111827; margin: 0; font-size: 10.5px; }
  .band { background: linear-gradient(90deg, #b91c1c, #7f1d1d); color: #fff; padding: 14px 18px; border-radius: 6px; }
  .band h1 { margin: 0; font-size: 17px; font-weight: 700; letter-spacing: .2px; }
  .band p { margin: 2px 0 0; font-size: 11px; color: #fecaca; }
  .fields { display: flex; gap: 22px; margin: 12px 2px 8px; }
  .fields .fld { flex: 1; }
  .fields .rule { border-bottom: 1px solid #111827; height: 20px; }
  .fields .lbl { font-size: 9px; color: #6b7280; margin-top: 3px; }
  .caption { font-size: 9px; color: #6b7280; margin: 0 2px 10px; font-style: italic; }
  .cols { column-count: 2; column-gap: 22px; }
  .cat { break-inside: avoid; margin-bottom: 8px; }
  .cat h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .4px; color: #991b1b; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; margin: 0 0 4px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 3px 4px; vertical-align: top; }
  td.box { width: 16px; text-align: center; }
  .chk { display: inline-block; width: 11px; height: 11px; border: 1.4px solid #9ca3af; border-radius: 3px; }
  td.name { font-weight: 600; }
  .nremt { display: inline-block; background: #fee2e2; color: #b91c1c; font-size: 8px; font-weight: 700; padding: 1px 4px; border-radius: 3px; margin-left: 5px; vertical-align: middle; }
  td.date { width: 78px; }
  .dateline { border-bottom: 1px solid #d1d5db; height: 11px; display: block; }
  .signoff { margin-top: 14px; border-top: 1.5px solid #d1d5db; padding-top: 12px; display: flex; gap: 28px; }
  .signoff .line { flex: 1; }
  .signoff .rule { border-bottom: 1px solid #111827; height: 22px; }
  .signoff .lbl { font-size: 9px; color: #6b7280; margin-top: 3px; }
  .foot { margin-top: 14px; font-size: 8px; color: #9ca3af; text-align: right; }
`;

/** Groups skills by category, preserving incoming (already category/name sorted) order. */
function groupByCategory(skills: BlankChecklistSkill[]): Array<{ cat: string; items: BlankChecklistSkill[] }> {
  const groups: Array<{ cat: string; items: BlankChecklistSkill[] }> = [];
  const idx = new Map<string, number>();
  for (const s of skills) {
    if (!idx.has(s.category)) { idx.set(s.category, groups.length); groups.push({ cat: s.category, items: [] }); }
    groups[idx.get(s.category)!].items.push(s);
  }
  return groups;
}

export function renderBlankChecklistHTML(skills: BlankChecklistSkill[]): string {
  const groups = groupByCategory(skills);

  const groupsHtml = groups.map(g => {
    const rows = g.items.map(s => `<tr>
        <td class="box"><span class="chk"></span></td>
        <td class="name">${esc(s.name)}${s.nremt_tested ? '<span class="nremt">NREMT</span>' : ''}</td>
        <td class="date"><span class="dateline"></span></td>
      </tr>`).join('');
    return `<div class="cat"><h2>${esc(g.cat)}</h2><table>${rows}</table></div>`;
  }).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>LVFR AEMT Skills — Blank Class Checklist</title><style>${CSS}</style></head>
<body>
  <div class="band">
    <h1>Pima Medical Institute — LVFR AEMT</h1>
    <p>Psychomotor Skills — Blank Class Checklist</p>
  </div>
  <div class="fields">
    <div class="fld"><div class="rule"></div><div class="lbl">Class / Cohort</div></div>
    <div class="fld"><div class="rule"></div><div class="lbl">Date range</div></div>
    <div class="fld"><div class="rule"></div><div class="lbl">Instructor</div></div>
  </div>
  <p class="caption">Check off each skill once it has been covered with the class (class-level — not scored per student). ${skills.length} skills across ${groups.length} categories.</p>
  <div class="cols">${groupsHtml}</div>
  <div class="signoff">
    <div class="line"><div class="rule"></div><div class="lbl">Instructor signature</div></div>
    <div class="line" style="max-width:160px;"><div class="rule"></div><div class="lbl">Date</div></div>
  </div>
  <div class="foot">Generated for printing/hand-off — LVFR AEMT skills checklist</div>
</body></html>`;
}
