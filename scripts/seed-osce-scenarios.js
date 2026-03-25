#!/usr/bin/env node
/**
 * Seed OSCE scenarios from DOCX files into the osce_scenarios table.
 *
 * Usage:
 *   node scripts/seed-osce-scenarios.js
 *   node scripts/seed-osce-scenarios.js --dry-run
 *
 * Reads DOCX files using mammoth, parses structured data, and upserts
 * into osce_scenarios table (ON CONFLICT scenario_letter).
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

// ── File mapping ──
const SCENARIO_FILES = [
  { letter: 'A', filename: 'OSCE_Scenario_A.docx' },
  { letter: 'B', filename: 'OSCE_Scenario_B_DKA.docx' },
  { letter: 'D', filename: 'OSCE_Scenario_D_CHF (1).docx' },
  { letter: 'E', filename: 'OSCE_Scenario_E_Sepsis.docx' },
  { letter: 'F', filename: 'OSCE_Scenario_F_StatusEpi.docx' },
];

const BASE_PATH = 'C:/Users/benny/OneDrive/Documents/(1)Pima Paramedic Instructor/Pmitools folder/OSCE build files';

// ── Parsing helpers ──

function extractBetween(text, startMarker, endMarker) {
  const startIdx = text.indexOf(startMarker);
  if (startIdx === -1) return '';
  const contentStart = startIdx + startMarker.length;
  const endIdx = endMarker ? text.indexOf(endMarker, contentStart) : text.length;
  if (endIdx === -1) return text.substring(contentStart).trim();
  return text.substring(contentStart, endIdx).trim();
}

function extractField(text, label) {
  // Match "Label:\n\nValue" or "Label:\nValue" patterns
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
  // Title
  const titleMatch = text.match(/OSCE Scenario [A-Z]:\s*(.+)/i);
  const title = titleMatch ? titleMatch[1].trim() : `Scenario ${letter}`;

  // Instructor notes
  const instructorNotesMatch = text.match(/INSTRUCTOR NOTES \(READ FIRST\)\s*\n\s*\n([\s\S]*?)(?=\n\s*\n\s*(?:KEY PHYSIOLOGIC|DISPATCH INFORMATION))/i);
  let instructorNotes = instructorNotesMatch ? instructorNotesMatch[1].trim() : '';

  // For Scenario B, also grab the KEY PHYSIOLOGIC RELATIONSHIP
  const keyPhysioMatch = text.match(/KEY PHYSIOLOGIC RELATIONSHIP:\s*([\s\S]*?)(?=\n\s*\n\s*DISPATCH INFORMATION)/i);
  if (keyPhysioMatch) {
    instructorNotes += '\n\nKEY PHYSIOLOGIC RELATIONSHIP: ' + keyPhysioMatch[1].trim();
  }

  // Patient info section
  const patientSection = extractBetween(text, 'PATIENT INFORMATION', 'PRIMARY ASSESSMENT');
  const patientName = extractField(patientSection, 'Name');
  const patientAge = extractField(patientSection, 'Age');
  const patientSex = extractField(patientSection, 'Sex');
  const patientGender = patientSex === 'Male' ? 'M' : patientSex === 'Female' ? 'F' : patientSex;

  // Dispatch info
  const dispatchSection = extractBetween(text, 'DISPATCH INFORMATION', 'PATIENT INFORMATION');
  const chiefComplaint = extractField(dispatchSection, 'Chief Complaint');
  const dispatchText = dispatchSection;

  // Critical actions
  const criticalSection = extractBetween(text, 'CRITICAL ACTIONS (MUST PERFORM)', 'SCENARIO PHASES');
  const criticalActions = criticalSection
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 10 && !l.startsWith('✓') && !l.startsWith('CRITICAL'));

  // Parse vital sign progressions from phases
  const vitalSignProgressions = parseVitalProgressions(text);

  // Parse expected interventions per phase
  const expectedInterventions = parseExpectedInterventions(text);

  // Parse debrief/oral board discussion points
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
  // Find all PHASE sections
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

    // Extract vitals from table-like format: BP\nHR\nRR\nSpO2\nTemp\nBGL\nvalue\nvalue...
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
  // Look for vital sign blocks - they appear as BP/HR/RR/SpO2/Temp/BGL followed by values
  const results = [];

  // Pattern: look for lines with BP value format after the headers
  const vitalBlocks = phaseText.split(/(?=\nBP\n)/);

  for (const block of vitalBlocks) {
    if (!block.includes('\nBP\n') && !block.startsWith('BP\n')) continue;

    const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Find the header sequence
    const bpIdx = lines.indexOf('BP');
    if (bpIdx === -1) continue;

    // Headers should be: BP, HR, RR, SpO2, Temp, BGL
    const headerCount = 6;
    const headers = lines.slice(bpIdx, bpIdx + headerCount);
    if (headers.length < 6) continue;

    // Values follow after the headers
    const valStart = bpIdx + headerCount;
    const values = lines.slice(valStart, valStart + headerCount);
    if (values.length < 6) continue;

    // Only include if the BP value looks like a BP reading
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

  // Also check for ETCO2 in the phase
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

    // Extract "Expected Actions:" section
    const expectedMatch = phaseText.match(/Expected Actions:\s*\n([\s\S]*?)(?=\n\s*\n\s*(?:Instructor Cues|CORRECT PATH|INCORRECT PATH|$))/i);
    if (expectedMatch) {
      const actions = expectedMatch[1]
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 5);
      interventions[`Phase ${phasePositions[i].number}: ${phasePositions[i].title}`] = actions;
    }

    // Extract instructor cues
    const cuesMatch = phaseText.match(/Instructor Cues:\s*([\s\S]*?)(?=\n\s*\n\s*(?:PHASE|CORRECT|INCORRECT|DEBRIEF|$))/i);
    if (cuesMatch) {
      interventions[`Phase ${phasePositions[i].number} Instructor Cues`] = cuesMatch[1].trim();
    }
  }

  return interventions;
}

// ── Main ──

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('\n🏥 OSCE Scenario Seeder');
  console.log('─'.repeat(50));

  // Extract and parse all scenarios
  const scenarios = [];
  for (const { letter, filename } of SCENARIO_FILES) {
    const filePath = path.join(BASE_PATH, filename);
    console.log(`\n📄 Reading Scenario ${letter}: ${filename}`);

    if (!fs.existsSync(filePath)) {
      console.error(`   ❌ File not found: ${filePath}`);
      continue;
    }

    const result = await mammoth.extractRawText({ path: filePath });
    const text = result.value;
    console.log(`   ✓ Extracted ${text.length} characters`);

    const parsed = parseScenario(text, letter);
    console.log(`   Title: ${parsed.title}`);
    console.log(`   Patient: ${parsed.patient_name}, ${parsed.patient_age}, ${parsed.patient_gender}`);
    console.log(`   Chief Complaint: ${parsed.chief_complaint}`);
    console.log(`   Critical Actions: ${parsed.critical_actions.length}`);
    console.log(`   Vital Progressions: ${parsed.vital_sign_progressions.length} phases`);

    scenarios.push(parsed);
  }

  if (scenarios.length === 0) {
    console.error('\n❌ No scenarios parsed. Aborting.');
    process.exit(1);
  }

  if (dryRun) {
    console.log('\n🔍 DRY RUN — would insert/update these scenarios:');
    for (const s of scenarios) {
      console.log(`   ${s.scenario_letter}: ${s.title} (${s.patient_name})`);
    }
    console.log('\n✓ Dry run complete. Remove --dry-run to execute.');
    return;
  }

  // Insert into database
  const connStr = getConnectionString();
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('\n✓ Database connected');

    for (const s of scenarios) {
      console.log(`\n⏳ Upserting Scenario ${s.scenario_letter}...`);

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

      console.log(`   ✅ Scenario ${s.scenario_letter} upserted`);
    }

    // Verify
    const result = await client.query(
      'SELECT scenario_letter, title, patient_name FROM osce_scenarios ORDER BY scenario_letter'
    );
    console.log('\n📊 Verification:');
    console.log('─'.repeat(50));
    for (const row of result.rows) {
      console.log(`   ${row.scenario_letter}: ${row.title} (${row.patient_name})`);
    }
    console.log(`\n✅ Total: ${result.rows.length} scenarios seeded successfully\n`);

  } catch (err) {
    console.error(`\n❌ Database error: ${err.message}\n`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
