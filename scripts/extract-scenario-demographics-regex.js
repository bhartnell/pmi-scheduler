#!/usr/bin/env node
// Pure regex / string-parsing extraction of demographics from
// patient_presentation prose. No Anthropic API — runs against the
// Supabase service role and is free.
//
// Targets every active scenario with chief_complaint IS NULL and a
// non-empty patient_presentation. Idempotent: only fills currently-
// empty columns, never overwrites.
//
// Usage:
//   node scripts/extract-scenario-demographics-regex.js              # DRY RUN (default)
//   node scripts/extract-scenario-demographics-regex.js --apply      # write
//   node scripts/extract-scenario-demographics-regex.js --limit 5    # sample first

const fs = require('fs');
const path = require('path');

try {
  const envPath = path.join(__dirname, '..', '.env.local');
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i > 0) process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
  }
} catch {}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const APPLY = process.argv.includes('--apply');
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit');
  if (i === -1) return null;
  const n = parseInt(process.argv[i + 1], 10);
  return Number.isFinite(n) ? n : null;
})();

// ─── Extractors ────────────────────────────────────────────────

function extractAgeAndSex(text) {
  // Matches "58-year-old male", "32-year old female", "6-month-old infant",
  // "newborn", "32 y/o male", "32yo female", "6 mo male"
  // Year-old (male|female)
  let m = text.match(/(\d+)\s*[-\s]?(?:year|yr)\s*[-\s]?old\s+(male|female|man|woman|boy|girl|infant|child|baby|patient)/i);
  if (m) {
    const age = parseInt(m[1], 10);
    const sexWord = m[2].toLowerCase();
    let sex = null;
    if (['male', 'man', 'boy'].includes(sexWord)) sex = 'male';
    else if (['female', 'woman', 'girl'].includes(sexWord)) sex = 'female';
    return { age: Number.isFinite(age) ? age : null, sex };
  }
  // y/o or yo abbreviation
  m = text.match(/(\d+)\s*y\.?\s*\/?\s*o\.?\s+(male|female|m\b|f\b)/i);
  if (m) {
    const age = parseInt(m[1], 10);
    const sexShort = m[2].toLowerCase().trim().replace(/\W/g, '');
    const sex = sexShort.startsWith('m') ? 'male' : sexShort.startsWith('f') ? 'female' : null;
    return { age: Number.isFinite(age) ? age : null, sex };
  }
  // Months → 0
  m = text.match(/(\d+)\s*[-\s]?month[-\s]?old\s+(male|female|infant|baby|child)/i);
  if (m) {
    const sexWord = m[2].toLowerCase();
    let sex = null;
    if (sexWord === 'male') sex = 'male';
    else if (sexWord === 'female') sex = 'female';
    return { age: 0, sex };
  }
  // Newborn / neonate
  if (/\bnewborn\b|\bneonate\b/i.test(text)) {
    return { age: 0, sex: null };
  }
  // Age only (no sex)
  m = text.match(/(\d+)\s*[-\s]?(?:year|yr)\s*[-\s]?old\b/i);
  if (m) {
    const age = parseInt(m[1], 10);
    return { age: Number.isFinite(age) ? age : null, sex: null };
  }
  // Sex only — adult male / adult female
  if (/\badult\s+male\b/i.test(text)) return { age: null, sex: 'male' };
  if (/\badult\s+female\b/i.test(text)) return { age: null, sex: 'female' };
  return { age: null, sex: null };
}

function extractChiefComplaint(text) {
  // "Chief Complaint: <phrase>" — pull until end of line
  const m = text.match(/Chief Complaint\s*:?\s*([^\n\r]{3,200})/i);
  if (m) return m[1].trim().replace(/[.;]+$/, '');
  return null;
}

function extractName(text) {
  // "Patient: First Last, ..." or "Patient: First M. Last"
  const m = text.match(/(?:^|\n)\s*Patient\s*:\s*([A-Z][a-zA-Z'’-]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-zA-Z'’-]+)(?:[,\s]|$)/);
  if (m) return m[1].trim();
  return null;
}

function extractWeight(text) {
  // "85 kg (187 lbs)" or "70 kg" or "150 lbs"
  let m = text.match(/(\d+(?:\.\d+)?)\s*kg\s*\((\d+(?:\.\d+)?)\s*lbs?\)/i);
  if (m) return `${m[1]} kg (${m[2]} lbs)`;
  m = text.match(/(\d+(?:\.\d+)?)\s*kg\b(?!\s*\/m\^?2)/i);  // exclude BMI kg/m²
  if (m) return `${m[1]} kg`;
  m = text.match(/(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)\b/i);
  if (m) return `${m[1]} lbs`;
  return null;
}

function extractAllergies(text) {
  // Look for explicit Allergies: line. Capture until newline or
  // a section keyword. Strip trailing punctuation.
  const m = text.match(/Allerg(?:y|ies)\s*:?\s*([^\n\r]{2,200})/i);
  if (!m) return null;
  let val = m[1].trim();
  // Cut at next obvious section break
  val = val.split(/\s*(?:Medications?|Meds|Past Medical|PMHx?|History|Social|Family|Vitals?|Assessment)\s*:/i)[0].trim();
  val = val.replace(/[.;]+$/, '').trim();
  return val.length > 0 ? val : null;
}

function splitListItems(s) {
  // Split on commas, semicolons, line bullets ("- ", "• "), or " and "
  return s
    .split(/(?:^|\s)[-•]\s|;|,|\s+(?:and|&)\s+/i)
    .map(x => x.trim().replace(/^[-•*\s]+/, '').replace(/[.;]+$/, ''))
    .filter(x => x.length > 0);
}

function extractMedications(text) {
  const m = text.match(/(?:^|\n)\s*(?:Medications?|Meds)\s*:?\s*([^\n\r]{2,500})/i);
  if (!m) return null;
  let raw = m[1].trim();
  raw = raw.split(/\s*(?:Allerg(?:y|ies)|Past Medical|PMHx?|History|Social|Family|Vitals?|Assessment)\s*:/i)[0].trim();
  if (/^(none|nil|no(?:ne known)?|n\/a|nka)\b/i.test(raw)) return [];
  const items = splitListItems(raw);
  return items.length > 0 ? items.slice(0, 30) : null;
}

function extractMedicalHistory(text) {
  // STRICT: only match labelled keys followed by a COLON, in start-
  // of-line context. Prevents "history of heart failure" mid-sentence
  // from leaking into the field. Tries the most-specific first.
  // Patterns accepted (case-insensitive, anchored on line start):
  //   PMH:  /  PMHx:  /  Past Medical History:  /
  //   Medical History:  /  History (PMHx):  /  Hx:
  const patterns = [
    /(?:^|\n)\s*PMHx?\s*:\s*([^\n\r]{2,500})/i,
    /(?:^|\n)\s*Past\s+Medical\s+History\s*:\s*([^\n\r]{2,500})/i,
    /(?:^|\n)\s*Medical\s+History\s*:\s*([^\n\r]{2,500})/i,
    /(?:^|\n)\s*Hx\s*:\s*([^\n\r]{2,500})/i,
  ];
  let m = null;
  for (const p of patterns) {
    m = text.match(p);
    if (m) break;
  }
  if (!m) return null;
  let raw = m[1].trim();
  raw = raw
    .split(/\s*(?:Allerg(?:y|ies)|Medications?|Meds|Social|Family|Vitals?|Assessment|Surgical|Surgeries)\s*:/i)[0]
    .trim();
  if (/^(none|nil|no(?:ne known|t\b)|n\/a|nka|unremarkable)\b/i.test(raw)) return [];
  const items = splitListItems(raw);
  return items.length > 0 ? items.slice(0, 30) : null;
}

function isEmpty(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

(async () => {
  console.log(`Mode: ${APPLY ? 'APPLY (will write)' : 'DRY RUN'}`);
  if (LIMIT) console.log(`Limit: ${LIMIT}`);

  const { data: scenarios, error } = await supabase
    .from('scenarios')
    .select(
      'id, title, patient_presentation, chief_complaint, patient_name, patient_age, patient_sex, patient_weight, medical_history, medications, allergies'
    )
    .eq('is_active', true)
    .is('chief_complaint', null)
    .not('patient_presentation', 'is', null)
    .order('title');
  if (error) {
    console.error('Fetch failed:', error.message);
    process.exit(1);
  }

  const list = LIMIT ? scenarios.slice(0, LIMIT) : scenarios;
  console.log(`\nProcessing ${list.length} scenarios (of ${scenarios.length} eligible)...\n`);

  let totalApplied = 0;
  let totalChanged = 0;
  let totalErrors = 0;
  const fieldFillCounts = {};

  for (const sc of list) {
    const text = sc.patient_presentation || '';
    if (text.trim().length < 30) {
      console.log(`SKIP ${sc.id.slice(0, 8)} · "${sc.title.slice(0, 60)}" · presentation too short`);
      continue;
    }

    const ageSex = extractAgeAndSex(text);
    const cc = extractChiefComplaint(text);
    const name = extractName(text);
    const weight = extractWeight(text);
    const allergies = extractAllergies(text);
    const meds = extractMedications(text);
    const hx = extractMedicalHistory(text);

    const patch = {};
    const filled = [];
    const fill = (col, cur, val, valid = () => true) => {
      if (!isEmpty(cur)) return;
      if (val === null || val === undefined) return;
      if (Array.isArray(val) && val.length === 0 && cur === null) {
        // Allow filling with [] only if intent was clearly "none"
        // — handled by extractor returning [] vs null.
        patch[col] = val;
        filled.push(col);
        return;
      }
      if (!valid(val)) return;
      patch[col] = val;
      filled.push(col);
    };

    fill('chief_complaint', sc.chief_complaint, cc);
    fill('patient_name', sc.patient_name, name);
    fill('patient_age', sc.patient_age, ageSex.age);
    fill('patient_sex', sc.patient_sex, ageSex.sex, v => ['male', 'female', 'other'].includes(v));
    fill('patient_weight', sc.patient_weight, weight);
    fill('allergies', sc.allergies, allergies);
    fill('medications', sc.medications, meds);
    fill('medical_history', sc.medical_history, hx);

    for (const f of filled) fieldFillCounts[f] = (fieldFillCounts[f] || 0) + 1;

    if (filled.length === 0) {
      console.log(`MISS ${sc.id.slice(0, 8)} · "${sc.title.slice(0, 60)}" · regex matched nothing extractable`);
      continue;
    }

    totalChanged++;

    if (APPLY) {
      const { error: uErr } = await supabase.from('scenarios').update(patch).eq('id', sc.id);
      if (uErr) {
        totalErrors++;
        console.log(`UPDF ${sc.id.slice(0, 8)} · ${uErr.message}`);
      } else {
        totalApplied++;
        console.log(`OK   ${sc.id.slice(0, 8)} · "${sc.title.slice(0, 50)}" · ${filled.join(', ')}`);
      }
    } else {
      console.log(
        `DRY  ${sc.id.slice(0, 8)} · "${sc.title.slice(0, 50)}" · would fill: ${filled.join(', ')}`
      );
      // Show a 1-line preview of the values so the operator can
      // sanity-check before re-running with --apply.
      for (const f of filled) {
        const val = Array.isArray(patch[f]) ? patch[f].join(' | ') : patch[f];
        const display = String(val).slice(0, 80);
        console.log(`       ${f.padEnd(18)} → ${display}`);
      }
    }
  }

  console.log(`\n──── SUMMARY ────`);
  console.log(`Total checked:     ${list.length}`);
  console.log(`Total with changes: ${totalChanged}`);
  console.log(`Total applied:     ${totalApplied}`);
  console.log(`Total errors:      ${totalErrors}`);
  console.log(`\nField fill counts:`);
  for (const [k, v] of Object.entries(fieldFillCounts)) {
    console.log(`  ${k.padEnd(18)} ${v}`);
  }
  if (!APPLY) {
    console.log(`\nDry run only. Re-run with --apply to write.`);
  }
})().catch(e => {
  console.error(e);
  process.exit(1);
});
