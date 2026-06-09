/**
 * LVFR AEMT runsheet rebuild — source parser + dry-run report.
 *
 * Reads the three authoritative 30-day files (repo root), builds the full
 * item set in memory, writes a reviewable artifact, and prints a dry-run
 * report. WRITES NOTHING to the database. See SPEC_lvfr_runsheet_rebuild (2).md.
 *
 *   node scripts/lvfr-rebuild/parse-sources.mjs            # report + artifact
 *   node scripts/lvfr-rebuild/parse-sources.mjs --day 3    # also dump one day
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const REPO = path.resolve(fileURLToPath(import.meta.url), '../../..');
const SRC = path.join(REPO, 'data', 'lvfr-aemt', 'sources');
const DOCX = path.join(SRC, 'LVFR_AEMT_Daily_Lesson_Plans (2).docx');
const XLSXF = path.join(SRC, 'AEMT_Instructor_Assignments (5).xlsx');
const TRACKER = path.join(SRC, 'AEMT_Schedule_Build_Tracker (4).md');
const OUT = path.join(REPO, 'data', 'lvfr-aemt', 'runsheet_days.json');

const PM_BOUNDARY = 1300; // activities starting >= 1300 go to the PM block

// ── docx → paragraphs ──────────────────────────────────────────────
function docxParagraphs(docxPath) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lvfr-docx-'));
  const zip = path.join(tmp, 'd.zip');
  fs.copyFileSync(docxPath, zip);
  execSync(`unzip -oq "${zip}" -d "${tmp}/unz"`, { stdio: 'pipe' });
  const xml = fs.readFileSync(path.join(tmp, 'unz', 'word', 'document.xml'), 'utf8');
  fs.rmSync(tmp, { recursive: true, force: true });
  return xml
    .split(/<w:p[ >]/)
    .slice(1)
    .map(p =>
      [...p.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
        .map(m => m[1])
        .join('')
        .replace(/&amp;/g, '&')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/’/g, "'")
        .trim(),
    )
    .filter(Boolean);
}

// ── classification (3-tier) ────────────────────────────────────────
// Precedence: info → scenario(context) → optional → required → fallback.
// NOTE: no outer \b on the alternation — it breaks plural/stem matches
// ("Quizzes", "Checkoffs", "Case Studies"). Use targeted \b only where a
// short token risks matching inside another word (e.g. \blab\b).
const INFO_RE = /(roll call|announcement|\bbreak\b|lunch|transition)/i;
const OPTIONAL_RE = /(quiz review|exam review|\breview\b|case stud|worksheet|optional|catch[- ]?up|open practice|additional practice|remediation|self[- ]study|walkthrough|preview discussion)/i;
const REQUIRED_RE = /(chapter|\bch \d|lecture|quiz|exam|\blab\b|checkoff|competenc|safety|login|orientation|group testing|\bdemo\b|med admin|manikin|live stick|splint|c-spine|tourniquet|deliver|\bnrp\b|nremt|final|\bprep\b|skill|practice|exercise|briefing|tabletop)/i;

// scenario activities: required only when they ARE the day's designated lab
// (xlsx marks the day LAB and the lab name is scenario-based); otherwise the
// spec treats "extra scenarios beyond the required lab" as optional.
function classify(title, dayIsLab, labName) {
  const t = title.toLowerCase();
  if (INFO_RE.test(t)) return { requirement: 'info', reason: 'info-keyword' };
  if (/scenario/i.test(t)) {
    const designatedLab = dayIsLab && /scenario/i.test(labName || '');
    return designatedLab
      ? { requirement: 'required', reason: 'scenario-is-designated-lab' }
      : { requirement: 'optional', reason: 'scenario-extra-practice' };
  }
  if (OPTIONAL_RE.test(t)) return { requirement: 'optional', reason: 'optional-keyword' };
  if (REQUIRED_RE.test(t)) return { requirement: 'required', reason: 'required-keyword' };
  return { requirement: 'required', reason: 'default-fallback' };
}

// Small presentation category (drives the existing item_type badge/icon).
function category(title) {
  const t = title.toLowerCase();
  if (/\bquiz\b/.test(t)) return 'quiz';
  if (/\bexam|final\b/.test(t)) return 'exam';
  if (/\bchapter|ch \d|lecture\b/.test(t)) return 'chapter';
  if (/\blab|checkoff|competenc|manikin|live stick|scenario|practice\b/.test(t)) return 'lab';
  if (/\b(roll call|announcement|break|lunch|transition)\b/.test(t)) return 'break';
  if (/\bskill\b/.test(t)) return 'skills';
  return 'other';
}

// ── docx day parser ────────────────────────────────────────────────
function parseDocx() {
  const paras = docxParagraphs(DOCX);
  const heads = [];
  paras.forEach((t, i) => {
    if (/^Day \d+ \(.*\) - Lesson Plan/.test(t)) heads.push(i);
  });
  const days = [];
  for (let h = 0; h < heads.length; h++) {
    const start = heads[h];
    const end = heads[h + 1] ?? paras.length;
    const block = paras.slice(start, end);
    const headM = block[0].match(/^Day (\d+) \((\w+), ([A-Za-z]+ \d+)\) - Lesson Plan/);
    const dayNumber = Number(headM[1]);
    const dow = headM[2];

    // section boundaries
    const idx = label => block.findIndex(l => l === label);
    const objStart = idx('Daily Objectives');
    const schedStart = idx('Lesson Schedule and Activities');
    const matStart = idx('Materials and Equipment');
    const notesStart = idx('Notes and Reminders');

    const objectives = block
      .slice(objStart + 1, schedStart)
      .filter(l => /^\d+\.\s/.test(l))
      .map(l => l.replace(/^\d+\.\s*/, ''));

    const notes = notesStart >= 0 ? block.slice(notesStart + 1, block.length).join(' ').trim() : '';

    // activities: time-block lines + their following sub-bullets
    const schedEnd = matStart >= 0 ? matStart : (notesStart >= 0 ? notesStart : block.length);
    const sched = block.slice(schedStart + 1, schedEnd);
    const activities = [];
    let cur = null;
    for (const line of sched) {
      const tm = line.match(/^(\d{4})-(\d{4})\s+(.*)$/);
      if (tm) {
        cur = {
          start: Number(tm[1]),
          end: Number(tm[2]),
          time_label: `${tm[1]}-${tm[2]}`,
          title: tm[3].trim(),
          bullets: [],
        };
        activities.push(cur);
      } else if (cur) {
        cur.bullets.push(line.replace(/^[-•]\s*/, '').trim());
      }
    }
    days.push({ dayNumber, dow, objectives, notes, activities });
  }
  return days;
}

// ── xlsx skeleton ──────────────────────────────────────────────────
function parseXlsx() {
  const wb = XLSX.readFile(XLSXF);
  const ws = wb.Sheets['Instructor Assignments'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
  const hi = rows.findIndex(r => String(r[0]).trim() === 'Day');
  const out = {};
  for (const r of rows.slice(hi + 1)) {
    if (!/^\d+$/.test(String(r[0]).trim())) continue;
    out[Number(r[0])] = {
      dateRaw: String(r[1]).trim(),       // "Jul 14"
      dow: String(r[2]).trim(),
      week: String(r[3]).trim(),
      content: String(r[4]).trim(),
      isLab: String(r[5]).trim().toUpperCase() === 'LAB',
      labName: String(r[6]).trim(),
      instNeeded: String(r[7]).trim(),
      notes: String(r[15]).trim(),
      cadre: String(r[16] ?? '').trim(),
    };
  }
  return out;
}

// "Jul 14" + year → ISO. Course runs Jul–Sep 2026.
const MONTHS = { Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12 };
function toIso(dateRaw) {
  const m = dateRaw.match(/^([A-Za-z]+)\s+(\d+)$/);
  const mo = String(MONTHS[m[1]]).padStart(2, '0');
  const d = String(Number(m[2])).padStart(2, '0');
  return `2026-${mo}-${d}`;
}

// ── build ──────────────────────────────────────────────────────────
function build() {
  const docxDays = parseDocx();
  const skel = parseXlsx();
  const flags = [];
  const result = [];

  for (const d of docxDays) {
    const sk = skel[d.dayNumber];
    if (!sk) { flags.push(`Day ${d.dayNumber}: no xlsx skeleton row`); continue; }
    const date = toIso(sk.dateRaw);

    // brief: a single synopsis line, built AFTER items so it tracks the
    // actual required activities (computed below, after promotion).
    let brief = '';

    // debrief: the LAST closeout/debrief activity's bullets (the day's wrap).
    // Using the last match avoids grabbing an earlier "Admin Closeout" item.
    let debrief = '';
    let closeoutIdx = -1;
    d.activities.forEach((a, i) => { if (/closeout|debrief/i.test(a.title)) closeoutIdx = i; });

    const items = { morning: [], afternoon: [] };
    d.activities.forEach((a, i) => {
      // The trailing closeout/debrief block becomes the day-level debrief,
      // not a checklist item (matches the worked example).
      if (i === closeoutIdx) {
        debrief = a.bullets.join(' ');
        return;
      }
      const { requirement, reason } = classify(a.title, sk.isLab, sk.labName);
      const block = a.start >= PM_BOUNDARY ? 'afternoon' : 'morning';
      const item = {
        title: a.title,
        requirement,
        item_type: category(a.title),
        time_label: a.time_label,
        description: a.bullets.join('; ') || null,
        sort_order: a.start, // HHMM as int → chronological within block
      };
      if (reason === 'default-fallback') {
        flags.push(`Day ${d.dayNumber} ${a.time_label} "${a.title}" → required (no keyword matched — defaulted)`);
      } else if (reason === 'scenario-extra-practice') {
        flags.push(`Day ${d.dayNumber} ${a.time_label} "${a.title}" → optional (extra scenario, not the designated lab)`);
      } else if (reason === 'scenario-is-designated-lab') {
        flags.push(`Day ${d.dayNumber} ${a.time_label} "${a.title}" → required (this IS the day's lab per xlsx)`);
      }
      items[block].push(item);
    });

    // ── Afternoon-completable rule ────────────────────────────────
    // Every lab/scenario afternoon must have ONE required item so the day
    // can be completed. Where the PM offers alternative paths (scenarios if
    // cadre, else case studies / group testing) the docx already encodes
    // them as ONE activity with the options in its description — so we
    // promote that single primary block to required rather than making each
    // alternative its own required item. True single labs already pass this
    // check (they're required), so they're untouched.
    const pmRequired = items.afternoon.filter(i => i.requirement === 'required').length;
    if (pmRequired === 0) {
      const primary = items.afternoon
        .filter(i => i.requirement === 'optional')
        .sort((a, b) => a.sort_order - b.sort_order)[0];
      if (primary) {
        primary.requirement = 'required';
        // drop the earlier "optional (extra scenario)" flag for this exact
        // item so it shows only once, as a promotion.
        const dup = flags.findIndex(f => f.includes(`Day ${d.dayNumber} ${primary.time_label} "${primary.title}"`));
        if (dup >= 0) flags.splice(dup, 1);
        flags.push(`Day ${d.dayNumber} ${primary.time_label} "${primary.title}" → PROMOTED to required (afternoon needs one completable item; alternative paths kept in its description, not as separate required items)`);
      } else {
        flags.push(`Day ${d.dayNumber}: afternoon has NO promotable item (all info) — review`);
      }
    }

    // ── one-line brief from the day's required activities ─────────
    const cleanTitle = t =>
      t.replace(/\s*\([^)]*\)/g, '')          // drop "(Lecture)", "(90 min)"
        .replace(/\s*-\s*\d+\s*questions?.*$/i, '') // drop "- 45 questions"
        .replace(/\s*-\s*\d+q.*$/i, '')
        .replace(/\s+if not done.*$/i, '')
        .replace(/:\s*$/, '')
        .trim();
    const amReq = [...new Set(items.morning.filter(i => i.requirement === 'required').map(i => cleanTitle(i.title)))];
    const pmReq = [...new Set(items.afternoon.filter(i => i.requirement === 'required').map(i => cleanTitle(i.title)))];
    brief = amReq.join(', ') + (pmReq.length ? ` → PM: ${pmReq.join(', ')}` : '');

    // lab metadata note from xlsx for traceability
    const labNote = sk.isLab ? `Lab: ${sk.labName} | instructors needed: ${sk.instNeeded}${sk.cadre ? ` | cadre: ${sk.cadre}` : ''}` : null;

    result.push({
      day_number: d.dayNumber,
      date,
      dow: d.dow,
      week: sk.week,
      brief,
      debrief,
      lab: sk.isLab ? { name: sk.labName, instNeeded: sk.instNeeded, cadre: sk.cadre } : null,
      lab_note: labNote,
      objectives: d.objectives,
      notes: d.notes,
      morning: items.morning,
      afternoon: items.afternoon,
    });
  }
  return { days: result, flags };
}

// ── report ─────────────────────────────────────────────────────────
const { days, flags } = build();

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ generated_from: ['LVFR_AEMT_Daily_Lesson_Plans (2).docx', 'AEMT_Instructor_Assignments (5).xlsx'], course: '30-day Jul 14 – Sep 17 2026', days }, null, 2));

const tot = { required: 0, optional: 0, info: 0 };
console.log('================ LVFR AEMT RUNSHEET — DRY RUN ================');
console.log(`Source docx : LVFR_AEMT_Daily_Lesson_Plans (2).docx`);
console.log(`Source xlsx : AEMT_Instructor_Assignments (5).xlsx`);
console.log(`Artifact    : data/lvfr-aemt/runsheet_days.json  (NOT written to DB)`);
console.log(`Days built  : ${days.length}  (${days[0].date} … ${days[days.length - 1].date})`);
console.log('');
console.log('Day  Date        DOW  AM(req/opt/info)  PM(req/opt/info)  Lab');
console.log('---  ----------  ---  ----------------  ----------------  --------------------');
for (const d of days) {
  const c = blk => {
    const r = blk.filter(i => i.requirement === 'required').length;
    const o = blk.filter(i => i.requirement === 'optional').length;
    const n = blk.filter(i => i.requirement === 'info').length;
    return `${r}/${o}/${n}`;
  };
  for (const blk of [d.morning, d.afternoon]) for (const i of blk) tot[i.requirement]++;
  const pad = (s, n) => String(s).padEnd(n);
  console.log(
    `${pad(d.day_number, 3)}  ${d.date}  ${pad(d.dow.slice(0, 3), 3)}  ${pad(c(d.morning), 16)}  ${pad(c(d.afternoon), 16)}  ${d.lab ? d.lab.name : ''}`,
  );
}
const itemCount = tot.required + tot.optional + tot.info;
console.log('');
console.log(`TOTAL items : ${itemCount}   required=${tot.required}  optional=${tot.optional}  info=${tot.info}`);
console.log(`New days    : 28 (${days[27]?.date}), 29 (${days[28]?.date}), 30 (${days[29]?.date})  — added vs old 27-day set`);
console.log(`Cohort      : AEMT G2 end_date 2026-09-10 → ${days[days.length - 1].date}`);
console.log('');
console.log(`AMBIGUOUS / FLAGGED classifications (${flags.length}) — for your review:`);
flags.forEach(f => console.log('  • ' + f));

// optional single-day dump
const di = process.argv.indexOf('--day');
if (di >= 0) {
  const want = Number(process.argv[di + 1]);
  const d = days.find(x => x.day_number === want);
  console.log(`\n================ DAY ${want} PARSED (${d.date}, ${d.dow}) ================`);
  console.log('BRIEF  : ' + d.brief);
  const show = (label, blk) => {
    console.log(label + ':');
    for (const i of blk) {
      const box = i.requirement === 'info' ? '       ' : `[${i.requirement}]`;
      console.log(`  ${box.padEnd(10)} (${i.time_label}) ${i.title}`);
      if (i.description) console.log(`              desc: ${i.description}`);
    }
  };
  show('AM', d.morning);
  show('PM', d.afternoon);
  console.log('DEBRIEF: ' + d.debrief);
}
