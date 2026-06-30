/**
 * LVFR-AEMT skills COMPLETION sheet (Side 2a).
 *
 * One self-contained HTML page per student, rendered to PDF server-side
 * (headless Chrome) and bundled into a per-student ZIP — the ACLS pattern:
 * ONE master layout name-stamped into ~25 identical copies (NOT per-student
 * scored). Every covered skill shows ✓ + the class coverage date; the rare
 * individual failure is documented by hand off the blank reference sheet
 * (Side 2b), not here.
 *
 * Letter portrait, PMI red branding. Pure render (no DB access).
 */

export interface CompletionSheetSkill {
  id: string;
  category: string;
  name: string;
  nremt_tested: boolean;
  evaluation_day: number | null;
}
export interface CompletionRow {
  completed: boolean;
  completed_date: string | null;
}

const clean = (s: string) => String(s ?? '').replace(/[^A-Za-z0-9]+/g, '').trim() || 'Unknown';

/** Drag-ready filename: LastName_FirstName_LVFR_Skills_Completion.pdf */
export function completionFilename(lastName: string, firstName: string): string {
  return `${clean(lastName)}_${clean(firstName)}_LVFR_Skills_Completion.pdf`;
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
  .meta { display: flex; justify-content: space-between; gap: 16px; margin: 12px 2px 6px; }
  .meta .who { font-size: 13px; font-weight: 700; }
  .meta .sub { font-size: 10px; color: #6b7280; }
  .caption { font-size: 9px; color: #6b7280; margin: 0 2px 10px; font-style: italic; }
  .cat { margin-top: 10px; }
  .cat h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .4px; color: #991b1b; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; margin: 0 0 4px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 3px 4px; vertical-align: top; }
  td.box { width: 18px; text-align: center; }
  .chk { display: inline-block; width: 12px; height: 12px; border: 1.4px solid #16a34a; border-radius: 3px; line-height: 11px; text-align: center; color: #16a34a; font-weight: 700; font-size: 10px; }
  .chk.empty { border-color: #9ca3af; color: transparent; }
  td.name { font-weight: 600; }
  .nremt { display: inline-block; background: #fee2e2; color: #b91c1c; font-size: 8px; font-weight: 700; padding: 1px 4px; border-radius: 3px; margin-left: 5px; vertical-align: middle; }
  td.date { width: 92px; text-align: right; color: #16a34a; font-weight: 600; white-space: nowrap; }
  td.date.none { color: #9ca3af; font-weight: 400; }
  .signoff { margin-top: 18px; border-top: 1.5px solid #d1d5db; padding-top: 12px; display: flex; gap: 28px; }
  .signoff .line { flex: 1; }
  .signoff .rule { border-bottom: 1px solid #111827; height: 22px; }
  .signoff .lbl { font-size: 9px; color: #6b7280; margin-top: 3px; }
  .foot { margin-top: 14px; font-size: 8px; color: #9ca3af; text-align: right; }
`;

interface RenderArgs {
  studentName: string;
  cohortLabel: string;
  skills: CompletionSheetSkill[];
  completion: Record<string, CompletionRow>;
  generatedDate: string; // YYYY-MM-DD
}

export function renderCompletionSheetHTML(a: RenderArgs): string {
  // Group skills by category, preserving incoming order.
  const groups: Array<{ cat: string; items: CompletionSheetSkill[] }> = [];
  const idx = new Map<string, number>();
  for (const s of a.skills) {
    if (!idx.has(s.category)) { idx.set(s.category, groups.length); groups.push({ cat: s.category, items: [] }); }
    groups[idx.get(s.category)!].items.push(s);
  }

  const coveredCount = a.skills.filter(s => a.completion[s.id]?.completed).length;

  const groupsHtml = groups.map(g => {
    const rows = g.items.map(s => {
      const row = a.completion[s.id];
      const done = !!row?.completed;
      const date = done && row?.completed_date ? row.completed_date : null;
      return `<tr>
        <td class="box"><span class="chk${done ? '' : ' empty'}">${done ? '✓' : ''}</span></td>
        <td class="name">${esc(s.name)}${s.nremt_tested ? '<span class="nremt">NREMT</span>' : ''}</td>
        <td class="date${date ? '' : ' none'}">${date ? esc(date) : '—'}</td>
      </tr>`;
    }).join('');
    return `<div class="cat"><h2>${esc(g.cat)}</h2><table>${rows}</table></div>`;
  }).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(completionFilename('', ''))}</title><style>${CSS}</style></head>
<body>
  <div class="band">
    <h1>Pima Medical Institute — LVFR AEMT</h1>
    <p>Psychomotor Skills Completion Record</p>
  </div>
  <div class="meta">
    <div>
      <div class="who">${esc(a.studentName)}</div>
      <div class="sub">${esc(a.cohortLabel)}</div>
    </div>
    <div class="sub" style="text-align:right;">${coveredCount} of ${a.skills.length} skills covered</div>
  </div>
  <p class="caption">This record documents skills covered and verified with the class. Individual remediation/failure events, when they occur, are documented separately on the skill reference sheet.</p>
  ${groupsHtml}
  <div class="signoff">
    <div class="line"><div class="rule"></div><div class="lbl">Instructor signature</div></div>
    <div class="line" style="max-width:160px;"><div class="rule"></div><div class="lbl">Date</div></div>
  </div>
  <div class="foot">Generated ${esc(a.generatedDate)}</div>
</body></html>`;
}
