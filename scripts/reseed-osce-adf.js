#!/usr/bin/env node
/**
 * Re-seed OSCE scenarios A, D, F from source DOCX files.
 * Uses the same parsing logic as seed-osce-scenarios.js but targets only A, D, F.
 * Also verifies osce_assessments scenario assignments.
 *
 * Usage:
 *   node scripts/reseed-osce-adf.js
 *   node scripts/reseed-osce-adf.js --dry-run
 */

const { Client } = require('pg');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

// Load .env.local
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
} catch {
  // .env.local not found
}

function getConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  const host = process.env.SUPABASE_DB_HOST || 'aws-0-us-west-2.pooler.supabase.com';
  const port = process.env.SUPABASE_DB_PORT || '5432';
  const user = process.env.SUPABASE_DB_USER || 'postgres.mkrqpwncfjpppxyntdtp';
  const password = process.env.SUPABASE_DB_PASSWORD;
  const database = process.env.SUPABASE_DB_NAME || 'postgres';
  if (!password) {
    console.error('ERROR: No database connection configured.');
    process.exit(1);
  }
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

// Only re-seed A, D, F
const SCENARIO_FILES = [
  { letter: 'A', filename: 'OSCE_Scenario_A.docx' },
  { letter: 'D', filename: 'OSCE_Scenario_D_CHF (1).docx' },
  { letter: 'F', filename: 'OSCE_Scenario_F_StatusEpi.docx' },
];

// Try Downloads first, fall back to OSCE build files folder
const SEARCH_PATHS = [
  'C:/Users/benny/Downloads',
  'C:/Users/benny/OneDrive/Documents/(1)Pima Paramedic Instructor/Pmitools folder/OSCE build files',
];

// ── Parsing helpers (same as seed-osce-scenarios.js) ──

function extractBetween(text, startMarker, endMarker) {
  const startIdx = text.indexOf(startMarker);
  if (startIdx === -1) return '';
  const contentStart = startIdx + startMarker.length;
  const endIdx = endMarker ? text.indexOf(endMarker, contentStart) : text.length;
  if (endIdx === -1) return text.substring(contentStart).trim();
  return text.substring(contentStart, endIdx).trim();
}

function extractField(text, label) {
  const patterns = [
    new RegExp(label + ':\\s*\\n\\s*\\n\\s*(.+)', 'i'),
    new RegExp(label + ':\\s*\\n\\s*(.+)', 'i'),
    new RegExp(label + ':\\s*(.+)', 'i'),
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return '';
}

function parseScenario(text, letter) {
  const titleMatch = text.match(/OSCE Scenario [A-Z]:\s*(.+)/i);
  const title = titleMatch ? titleMatch[1].trim() : `Scenario ${letter}`;

  const instructorNotesMatch = text.match(/INSTRUCTOR NOTES \(READ FIRST\)\s*\n\s*\n([\s\S]*?)(?=\n\s*\n\s*(?:KEY PHYSIOLOGIC|DISPATCH INFORMATION))/i);
  let instructorNotes = instructorNotesMatch ? instructorNotesMatch[1].trim() : '';

  const keyPhysioMatch = text.match(/KEY PHYSIOLOGIC RELATIONSHIP:\s*([\s\S]*?)(?=\n\s*\n\s*DISPATCH INFORMATION)/i);
  if (keyPhysioMatch) {
    instructorNotes += '\n\nKEY PHYSIOLOGIC RELATIONSHIP: ' + keyPhysioMatch[1].trim();
  }

  const patientSection = extractBetween(text, 'PATIENT INFORMATION', 'PRIMARY ASSESSMENT');
  const patientName = extractField(patientSection, 'Name');
  const patientAge = extractField(patientSection, 'Age');
  const patientSex = extractField(patientSection, 'Sex');
  const patientGender = patientSex === 'Male' ? 'M' : patientSex === 'Female' ? 'F' : patientSex;

  const dispatchSection = extractBetween(text, 'DISPATCH INFORMATION', 'PATIENT INFORMATION');
  const chiefComplaint = extractField(dispatchSection, 'Chief Complaint');
  const dispatchText = dispatchSection;

  const criticalSection = extractBetween(text, 'CRITICAL ACTIONS (MUST PERFORM)', 'SCENARIO PHASES');
  const criticalActions = criticalSection
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 10 && !l.startsWith('\u2713') && !l.startsWith('CRITICAL'));

  const vitalSignProgressions = parseVitalProgressions(text);
  const expectedInterventions = parseExpectedInterventions(text);

  const debriefSection = extractBetween(text, 'DEBRIEF DISCUSSION POINTS', null);
  const oralBoardDomains = {
    'Debrief Discussion Points': debriefSection
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 10)
  };

  return {
    scenario_letter: letter,
    title,
    patient_name: patientName,
    patient_age: patientAge,
    patient_gender: patientGender,
    chief_complaint: chiefComplaint,
    dispatch_text: dispatchText,
    instructor_notes: instructorNotes,
    critical_actions: criticalActions,
    expected_interventions: expectedInterventions,
    oral_board_domains: oralBoardDomains,
    vital_sign_progressions: vitalSignProgressions,
    full_content: text,
  };
}

function parseVitalProgressions(text) {
  const phases = [];
  const phaseRegex = /PHASE (\d+):\s*([^\n]+)/g;
  let match;
  const phasePositions = [];

  while ((match = phaseRegex.exec(text)) !== null) {
    phasePositions.push({
      number: parseInt(match[1]),
      title: match[2].trim(),
      index: match.index,
    });
  }

  for (let i = 0; i < phasePositions.length; i++) {
    const start = phasePositions[i].index;
    const end = i + 1 < phasePositions.length ? phasePositions[i + 1].index : text.length;
    const phaseText = text.substring(start, end);
    const vitals = extractVitalsFromPhase(phaseText);

    phases.push({
      phase: phasePositions[i].number,
      title: phasePositions[i].title,
      vitals: vitals,
    });
  }

  return phases;
}

function extractVitalsFromPhase(phaseText) {
  const results = [];
  const vitalBlocks = phaseText.split(/(?=\nBP\n)/);

  for (const block of vitalBlocks) {
    if (!block.includes('\nBP\n') && !block.startsWith('BP\n')) continue;

    const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const bpIdx = lines.indexOf('BP');
    if (bpIdx === -1) continue;

    const headerCount = 6;
    const headers = lines.slice(bpIdx, bpIdx + headerCount);
    if (headers.length < 6) continue;

    const valStart = bpIdx + headerCount;
    const values = lines.slice(valStart, valStart + headerCount);
    if (values.length < 6) continue;

    if (/^\d+\/\d+/.test(values[0])) {
      results.push({
        BP: values[0],
        HR: values[1],
        RR: values[2],
        SpO2: values[3],
        Temp: values[4],
        BGL: values[5],
      });
    }
  }

  const etco2Match = phaseText.match(/ETCO2:\s*([^\n]+)/);
  if (etco2Match && results.length > 0) {
    results[0].ETCO2 = etco2Match[1].trim();
  }

  return results;
}

function parseExpectedInterventions(text) {
  const interventions = {};
  const phaseRegex = /PHASE (\d+):\s*([^\n]+)/g;
  let match;
  const phasePositions = [];

  while ((match = phaseRegex.exec(text)) !== null) {
    phasePositions.push({
      number: parseInt(match[1]),
      title: match[2].trim(),
      index: match.index,
    });
  }

  for (let i = 0; i < phasePositions.length; i++) {
    const start = phasePositions[i].index;
    const end = i + 1 < phasePositions.length ? phasePositions[i + 1].index : text.indexOf('DEBRIEF DISCUSSION') > start ? text.indexOf('DEBRIEF DISCUSSION') : text.length;
    const phaseText = text.substring(start, end);

    const expectedMatch = phaseText.match(/Expected Actions:\s*\n([\s\S]*?)(?=\n\s*\n\s*(?:Instructor Cues|CORRECT PATH|INCORRECT PATH|$))/i);
    if (expectedMatch) {
      const actions = expectedMatch[1]
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 5);
      interventions[`Phase ${phasePositions[i].number}: ${phasePositions[i].title}`] = actions;
    }

    const cuesMatch = phaseText.match(/Instructor Cues:\s*([\s\S]*?)(?=\n\s*\n\s*(?:PHASE|CORRECT|INCORRECT|DEBRIEF|$))/i);
    if (cuesMatch) {
      interventions[`Phase ${phasePositions[i].number} Instructor Cues`] = cuesMatch[1].trim();
    }
  }

  return interventions;
}

// ── Expected assignments for verification ──
const EXPECTED_ASSIGNMENTS = {
  1: { // Day 1
    'PORFIRIO': 'D', 'GIFFORD': 'A', 'JOHNSON': 'D', 'SOLARI': 'A',
    'MIRANDA': 'F', 'BILHARZ': 'A', 'NIXON': 'F', 'GRAHOVAC': 'F',
    'COTTRELL': 'A', 'RUIZ': 'A', 'SULLIVAN': 'D', 'ZENTEK': 'D',
    'JAKICEVIC': 'F',
  },
  2: { // Day 2
    'SARELLANO LOPEZ': 'D', 'ACOSTA': 'A', 'CAHA': 'A', 'SMITH': 'D',
    'KENNEDY': 'D', 'WILLIAMS': 'F',
  },
};

// ── Main ──

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('\n=== OSCE Scenario Re-Seed: A, D, F ===');
  console.log('='.repeat(50));

  // Extract and parse scenarios
  const scenarios = [];
  for (const { letter, filename } of SCENARIO_FILES) {
    let filePath = null;
    for (const base of SEARCH_PATHS) {
      const candidate = path.join(base, filename);
      if (fs.existsSync(candidate)) {
        filePath = candidate;
        break;
      }
    }

    if (!filePath) {
      console.error(`  ERROR: File not found for Scenario ${letter}: ${filename}`);
      process.exit(1);
    }

    console.log(`\nReading Scenario ${letter}: ${filePath}`);
    const result = await mammoth.extractRawText({ path: filePath });
    const text = result.value;
    console.log(`  Extracted ${text.length} characters`);

    const parsed = parseScenario(text, letter);
    console.log(`  Title: ${parsed.title}`);
    console.log(`  Patient: ${parsed.patient_name}, ${parsed.patient_age}, ${parsed.patient_gender}`);
    console.log(`  Chief Complaint: ${parsed.chief_complaint}`);
    console.log(`  Critical Actions: ${parsed.critical_actions.length}`);
    console.log(`  Vital Progressions: ${parsed.vital_sign_progressions.length} phases`);

    scenarios.push(parsed);
  }

  if (dryRun) {
    console.log('\n--- DRY RUN ---');
    for (const s of scenarios) {
      console.log(`  Would update ${s.scenario_letter}: ${s.title} (${s.patient_name})`);
      console.log(`    Critical Actions: ${JSON.stringify(s.critical_actions).substring(0, 200)}...`);
    }
    console.log('\nDry run complete. Remove --dry-run to execute.');
    return;
  }

  // Connect to database
  const connStr = getConnectionString();
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('\nDatabase connected');

    // Upsert scenarios A, D, F
    for (const s of scenarios) {
      console.log(`\nUpserting Scenario ${s.scenario_letter}...`);

      await client.query(`
        INSERT INTO osce_scenarios (
          scenario_letter, title, patient_name, patient_age, patient_gender,
          chief_complaint, dispatch_text, instructor_notes,
          critical_actions, expected_interventions, oral_board_domains,
          vital_sign_progressions, full_content, is_active, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, NOW())
        ON CONFLICT (scenario_letter) DO UPDATE SET
          title = EXCLUDED.title,
          patient_name = EXCLUDED.patient_name,
          patient_age = EXCLUDED.patient_age,
          patient_gender = EXCLUDED.patient_gender,
          chief_complaint = EXCLUDED.chief_complaint,
          dispatch_text = EXCLUDED.dispatch_text,
          instructor_notes = EXCLUDED.instructor_notes,
          critical_actions = EXCLUDED.critical_actions,
          expected_interventions = EXCLUDED.expected_interventions,
          oral_board_domains = EXCLUDED.oral_board_domains,
          vital_sign_progressions = EXCLUDED.vital_sign_progressions,
          full_content = EXCLUDED.full_content,
          is_active = true,
          updated_at = NOW()
      `, [
        s.scenario_letter,
        s.title,
        s.patient_name,
        s.patient_age,
        s.patient_gender,
        s.chief_complaint,
        s.dispatch_text,
        s.instructor_notes,
        JSON.stringify(s.critical_actions),
        JSON.stringify(s.expected_interventions),
        JSON.stringify(s.oral_board_domains),
        JSON.stringify(s.vital_sign_progressions),
        s.full_content,
      ]);

      console.log(`  OK: Scenario ${s.scenario_letter} upserted`);
    }

    // Verify all scenarios
    console.log('\n--- Scenario Verification ---');
    const scenResult = await client.query(
      `SELECT scenario_letter, title, patient_name, patient_age,
              LENGTH(full_content) as content_length,
              jsonb_array_length(critical_actions) as num_critical_actions,
              jsonb_array_length(vital_sign_progressions) as num_phases
       FROM osce_scenarios
       WHERE scenario_letter IN ('A', 'D', 'F')
       ORDER BY scenario_letter`
    );
    for (const row of scenResult.rows) {
      console.log(`  ${row.scenario_letter}: ${row.title}`);
      console.log(`    Patient: ${row.patient_name}, ${row.patient_age}`);
      console.log(`    Content: ${row.content_length} chars, ${row.num_critical_actions} critical actions, ${row.num_phases} phases`);
    }

    // Verify assessments
    console.log('\n--- Assessment Assignment Verification ---');
    const assessResult = await client.query(`
      SELECT student_name, scenario, slot_number, day_number
      FROM osce_assessments
      WHERE student_name NOT LIKE 'Test%'
      ORDER BY day_number, slot_number
    `);

    let allCorrect = true;
    const mismatches = [];

    for (const row of assessResult.rows) {
      const dayExpected = EXPECTED_ASSIGNMENTS[row.day_number];
      if (!dayExpected) continue;

      // Match by last name (uppercase)
      const lastName = row.student_name.split(',')[0].trim().toUpperCase();
      const expectedScenario = dayExpected[lastName];

      if (expectedScenario && expectedScenario !== row.scenario) {
        allCorrect = false;
        mismatches.push({
          student: row.student_name,
          day: row.day_number,
          slot: row.slot_number,
          current: row.scenario,
          expected: expectedScenario,
        });
      }

      console.log(`  Day ${row.day_number} Slot ${row.slot_number}: ${row.student_name} => ${row.scenario}${expectedScenario && expectedScenario !== row.scenario ? ' ** MISMATCH (expected ' + expectedScenario + ')' : ''}`);
    }

    if (mismatches.length > 0) {
      console.log(`\nWARNING: ${mismatches.length} assignment mismatches found!`);
      console.log('Fixing mismatches (without touching evaluator scores)...');

      for (const m of mismatches) {
        console.log(`  Updating ${m.student} Day ${m.day} from ${m.current} to ${m.expected}...`);
        await client.query(`
          UPDATE osce_assessments
          SET scenario = $1, updated_at = NOW()
          WHERE student_name = $2 AND day_number = $3
        `, [m.expected, m.student, m.day]);
      }
      console.log('  Mismatches fixed.');
    } else {
      console.log('\nAll assignments are correct.');
    }

    console.log('\n=== Re-seed complete ===\n');

  } catch (err) {
    console.error(`\nERROR: ${err.message}\n`);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
