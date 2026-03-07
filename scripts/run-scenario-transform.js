#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Scenario Transform — Preview & Execute
//
// Previews which scenarios need transformation from old format to new format,
// and optionally executes the transforms directly against the database.
//
// Usage:
//   node scripts/run-scenario-transform.js                 # Preview only
//   node scripts/run-scenario-transform.js --execute       # Execute transforms
//   node scripts/run-scenario-transform.js --audit         # Run audit after
//   node scripts/run-scenario-transform.js --execute --audit  # Both
//
// NOTE: For full UI control with dry-run, selective transforms, and visual
// feedback, use the admin UI at: /admin/scenarios/transform
//
// Connection:
//   Uses the same .env.local configuration as scripts/run-migration.js.
// ---------------------------------------------------------------------------

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Load .env.local
// ---------------------------------------------------------------------------
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
    console.error('Set one of: DATABASE_URL, SUPABASE_DB_URL, or SUPABASE_DB_PASSWORD in .env.local');
    process.exit(1);
  }

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

// ---------------------------------------------------------------------------
// Vitals mapping (mirrors app/api/admin/scenarios/transform/route.ts)
// ---------------------------------------------------------------------------
function mapVitalsFromEntry(entry) {
  return {
    hemorrhage_control: '',
    airway_status: '',
    expose_findings: '',
    bp: entry.bp || '',
    hr: entry.hr || entry.pulse || '',
    rr: entry.rr || entry.resp || '',
    spo2: entry.spo2 || '',
    temp: entry.temp || '',
    gcs_total: entry.gcs || entry.gcs_total || '',
    gcs_e: entry.gcs_e || '',
    gcs_v: entry.gcs_v || '',
    gcs_m: entry.gcs_m || '',
    pupils: entry.pupils || '',
    loc: entry.loc || '',
    pain: entry.pain || '',
    ekg_rhythm: entry.ecg || entry.ekg || entry.ekg_rhythm || '',
    etco2: entry.etco2 || '',
    twelve_lead_notes: entry.twelve_lead || entry.twelve_lead_notes || '',
    lung_sounds: entry.lung_sounds || entry.lungs || '',
    lung_notes: entry.lung_notes || '',
    skin: entry.skin || '',
    jvd: entry.jvd || '',
    edema: entry.edema || '',
    capillary_refill: entry.cap_refill || entry.capillary_refill || '',
    pulse_quality: entry.pulse_quality || '',
    blood_glucose: entry.bgl || entry.blood_glucose || entry.glucose || '',
    other_findings: [],
  };
}

// ---------------------------------------------------------------------------
// Check if a scenario needs transformation
// ---------------------------------------------------------------------------
function scenarioNeedsTransformation(scenario) {
  const reasons = [];
  const phases = scenario.phases;
  const hasPhases = Array.isArray(phases) && phases.length > 0;

  if (hasPhases) {
    const firstPhase = phases[0];
    if (firstPhase && typeof firstPhase === 'object') {
      if (firstPhase.phase_number !== undefined && !firstPhase.name) {
        reasons.push('Phases use old format (phase_number instead of name)');
      }
    }
  }

  if (!hasPhases) {
    const vitals = scenario.vitals;
    const initialVitals = scenario.initial_vitals;
    if (Array.isArray(vitals) && vitals.length > 0) {
      reasons.push('Has vitals array but no phases - needs conversion');
    } else if (initialVitals && typeof initialVitals === 'object' && !Array.isArray(initialVitals) && Object.keys(initialVitals).length > 0) {
      reasons.push('Has initial_vitals object but no phases - needs single phase creation');
    }
  }

  const criticalActions = scenario.critical_actions;
  if (Array.isArray(criticalActions) && criticalActions.length > 0 && typeof criticalActions[0] === 'string') {
    reasons.push('critical_actions are strings (should be {id, description} objects)');
  }

  return { needs: reasons.length > 0, reasons };
}

// ---------------------------------------------------------------------------
// Transform a single scenario
// ---------------------------------------------------------------------------
function transformScenario(scenario) {
  const changes = [];
  const now = Date.now();

  const legacyData = {
    original_phases: scenario.phases || null,
    original_initial_vitals: scenario.initial_vitals || null,
    original_vitals: scenario.vitals || null,
    original_critical_actions: scenario.critical_actions || null,
    transformed_at: new Date().toISOString(),
    transformed_by: 'scripts/run-scenario-transform.js',
  };

  let newPhases = null;
  let newInitialVitals = null;
  let newCriticalActions = null;

  const phases = scenario.phases;
  const hasPhases = Array.isArray(phases) && phases.length > 0;

  // --- Fix old-format phases (phase_number -> name) ---
  if (hasPhases) {
    const firstPhase = phases[0];
    if (firstPhase && typeof firstPhase === 'object' && firstPhase.phase_number !== undefined && !firstPhase.name) {
      newPhases = phases.map((p, index) => {
        const phaseName = typeof p.phase_number === 'number'
          ? (index === 0 ? 'Initial Presentation' : `Phase ${p.phase_number}`)
          : (index === 0 ? 'Initial Presentation' : `Phase ${index + 1}`);
        const vitalsEntry = (p.vitals && typeof p.vitals === 'object') ? p.vitals : {};
        return {
          id: p.id || `phase-${now}-${index}`,
          name: phaseName,
          trigger: index === 0 ? 'On arrival' : (p.trigger || ''),
          vitals: mapVitalsFromEntry(vitalsEntry),
          presentation_notes: p.presentation_notes || p.notes || '',
          expected_actions: p.expected_actions || p.actions || '',
          display_order: index,
          onset: p.onset || '',
          provocation: p.provocation || '',
          quality: p.quality || '',
          radiation: p.radiation || '',
          severity: p.severity || '',
          time_onset: p.time_onset || '',
          general_impression: p.general_impression || '',
        };
      });
      changes.push(`Converted ${newPhases.length} phase(s) from old format (phase_number -> name)`);
    }
  }

  // --- Convert old vitals array to phases ---
  if (!hasPhases) {
    const vitalsArray = scenario.vitals;
    const initialVitals = scenario.initial_vitals;

    if (Array.isArray(vitalsArray) && vitalsArray.length > 0) {
      newPhases = vitalsArray.map((entry, index) => ({
        id: `phase-${now}-${index}`,
        name: entry.phase || (index === 0 ? 'Initial Presentation' : `Phase ${index + 1}`),
        trigger: index === 0 ? 'On arrival' : (entry.trigger || ''),
        vitals: mapVitalsFromEntry(entry),
        presentation_notes: entry.notes || entry.presentation || entry.presentation_notes || '',
        expected_actions: entry.interventions || entry.expected_actions || entry.actions || '',
        display_order: index,
        onset: '',
        provocation: '',
        quality: '',
        radiation: '',
        severity: '',
        time_onset: '',
        general_impression: entry.general_impression || '',
      }));
      changes.push(`Converted vitals array (${newPhases.length} entries) to phases`);

      newInitialVitals = newPhases[0].vitals;
      changes.push('Set initial_vitals from first converted phase');
    } else if (initialVitals && typeof initialVitals === 'object' && !Array.isArray(initialVitals)) {
      newPhases = [
        {
          id: `phase-${now}-0`,
          name: 'Initial Presentation',
          trigger: 'On arrival',
          vitals: mapVitalsFromEntry(initialVitals),
          presentation_notes: scenario.general_impression || '',
          expected_actions: '',
          display_order: 0,
          onset: '',
          provocation: '',
          quality: '',
          radiation: '',
          severity: '',
          time_onset: '',
          general_impression: scenario.general_impression || '',
        },
      ];
      changes.push('Created single phase from initial_vitals object');
    }
  }

  // --- Fix critical_actions format ---
  const criticalActions = scenario.critical_actions;
  if (Array.isArray(criticalActions) && criticalActions.length > 0 && typeof criticalActions[0] === 'string') {
    newCriticalActions = criticalActions.map((desc, i) => ({
      id: `critical-${now}-${i}`,
      description: typeof desc === 'string' ? desc : String(desc),
    }));
    changes.push(`Converted ${newCriticalActions.length} critical_action(s) from strings to objects`);
  }

  return { newPhases, newInitialVitals, newCriticalActions, legacyData, changes };
}

// ---------------------------------------------------------------------------
// Run audit query
// ---------------------------------------------------------------------------
async function runAudit(client) {
  console.log('\n--- AUDIT ---');

  // Count total scenarios
  const totalResult = await client.query('SELECT COUNT(*) as count FROM scenarios');
  const total = parseInt(totalResult.rows[0].count);
  console.log(`Total scenarios: ${total}`);

  // Count by structure quality
  const withPhasesResult = await client.query(`
    SELECT COUNT(*) as count FROM scenarios
    WHERE phases IS NOT NULL
      AND jsonb_array_length(phases::jsonb) > 0
  `);
  const withPhases = parseInt(withPhasesResult.rows[0].count);
  console.log(`With phases: ${withPhases}`);

  // Count scenarios with new-format phases (have 'name' field)
  const newFormatResult = await client.query(`
    SELECT COUNT(*) as count FROM scenarios
    WHERE phases IS NOT NULL
      AND jsonb_array_length(phases::jsonb) > 0
      AND phases::jsonb->0->>'name' IS NOT NULL
  `);
  const newFormat = parseInt(newFormatResult.rows[0].count);
  console.log(`With new-format phases (have 'name'): ${newFormat}`);

  // Count scenarios with old-format phases (have 'phase_number' but no 'name')
  const oldFormatResult = await client.query(`
    SELECT COUNT(*) as count FROM scenarios
    WHERE phases IS NOT NULL
      AND jsonb_array_length(phases::jsonb) > 0
      AND phases::jsonb->0->>'phase_number' IS NOT NULL
      AND phases::jsonb->0->>'name' IS NULL
  `);
  const oldFormat = parseInt(oldFormatResult.rows[0].count);
  console.log(`With old-format phases (phase_number, no name): ${oldFormat}`);

  // Count scenarios with string critical_actions
  const stringCaResult = await client.query(`
    SELECT COUNT(*) as count FROM scenarios
    WHERE critical_actions IS NOT NULL
      AND jsonb_array_length(critical_actions::jsonb) > 0
      AND jsonb_typeof(critical_actions::jsonb->0) = 'string'
  `);
  const stringCa = parseInt(stringCaResult.rows[0].count);
  console.log(`With string critical_actions: ${stringCa}`);

  // Count scenarios with object critical_actions
  const objectCaResult = await client.query(`
    SELECT COUNT(*) as count FROM scenarios
    WHERE critical_actions IS NOT NULL
      AND jsonb_array_length(critical_actions::jsonb) > 0
      AND jsonb_typeof(critical_actions::jsonb->0) = 'object'
  `);
  const objectCa = parseInt(objectCaResult.rows[0].count);
  console.log(`With object critical_actions: ${objectCa}`);

  // Count scenarios with initial_vitals
  const withVitalsResult = await client.query(`
    SELECT COUNT(*) as count FROM scenarios
    WHERE initial_vitals IS NOT NULL
  `);
  const withVitals = parseInt(withVitalsResult.rows[0].count);
  console.log(`With initial_vitals: ${withVitals}`);

  // Count scenarios with legacy_data (already transformed)
  const transformedResult = await client.query(`
    SELECT COUNT(*) as count FROM scenarios
    WHERE legacy_data IS NOT NULL
  `);
  const transformed = parseInt(transformedResult.rows[0].count);
  console.log(`Previously transformed (have legacy_data): ${transformed}`);

  // Issues summary
  const issueCount = oldFormat + stringCa;
  if (issueCount === 0) {
    console.log('\nAll scenarios are in the correct format.');
  } else {
    console.log(`\n${issueCount} scenario(s) still need transformation.`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function run() {
  const args = process.argv.slice(2);
  const doExecute = args.includes('--execute');
  const doAudit = args.includes('--audit');

  console.log('\n=== Scenario Structure Transform ===');
  console.log(`Mode: ${doExecute ? 'EXECUTE (will modify database)' : 'PREVIEW (read-only)'}`);

  const connStr = getConnectionString();
  const maskedConn = connStr.replace(/:([^@]+)@/, ':****@');
  console.log(`Connection: ${maskedConn}`);

  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to database.\n');

    // Fetch all scenarios
    const result = await client.query(`
      SELECT id, title, phases, initial_vitals, vitals, critical_actions, general_impression, created_at
      FROM scenarios
      ORDER BY created_at DESC
    `);

    const scenarios = result.rows;
    console.log(`Total scenarios in database: ${scenarios.length}`);

    // Check each scenario
    const needsTransform = [];
    const alreadyCorrect = [];

    for (const scenario of scenarios) {
      const { needs, reasons } = scenarioNeedsTransformation(scenario);
      if (needs) {
        needsTransform.push({ scenario, reasons });
      } else {
        alreadyCorrect.push(scenario);
      }
    }

    console.log(`Needs transformation: ${needsTransform.length}`);
    console.log(`Already correct: ${alreadyCorrect.length}`);

    if (needsTransform.length === 0) {
      console.log('\nNo scenarios need transformation.');
      if (doAudit) {
        await runAudit(client);
      }
      return;
    }

    // List scenarios needing transform
    console.log('\n--- Scenarios Needing Transformation ---');
    for (const { scenario, reasons } of needsTransform) {
      console.log(`  [${scenario.id.substring(0, 8)}...] ${scenario.title || '(untitled)'}`);
      for (const r of reasons) {
        console.log(`    - ${r}`);
      }
    }

    if (!doExecute) {
      console.log('\nRun with --execute to apply transforms.');
      console.log('Run with --audit to see database structure stats.');
      console.log(`\nExample: node scripts/run-scenario-transform.js --execute --audit`);

      if (doAudit) {
        await runAudit(client);
      }
      return;
    }

    // Execute transforms
    console.log('\n--- Executing Transforms ---');
    let transformed = 0;
    let errors = 0;
    let totalPhasesCreated = 0;
    let totalCriticalActionsNormalized = 0;

    for (const { scenario } of needsTransform) {
      try {
        const { newPhases, newInitialVitals, newCriticalActions, legacyData, changes } =
          transformScenario(scenario);

        // Build update SQL
        const setClauses = ['legacy_data = $2', 'updated_at = NOW()'];
        const params = [scenario.id, JSON.stringify(legacyData)];
        let paramIdx = 3;

        if (newPhases !== null) {
          setClauses.push(`phases = $${paramIdx}`);
          params.push(JSON.stringify(newPhases));
          paramIdx++;
          totalPhasesCreated += newPhases.length;
        }

        if (newInitialVitals !== null) {
          setClauses.push(`initial_vitals = $${paramIdx}`);
          params.push(JSON.stringify(newInitialVitals));
          paramIdx++;

          // Sync ekg_findings
          if (newInitialVitals.ekg_rhythm || newInitialVitals.twelve_lead_notes) {
            setClauses.push(`ekg_findings = $${paramIdx}`);
            params.push(JSON.stringify({
              rhythm: newInitialVitals.ekg_rhythm || null,
              twelve_lead: newInitialVitals.twelve_lead_notes || null,
            }));
            paramIdx++;
          }
        }

        if (newCriticalActions !== null) {
          setClauses.push(`critical_actions = $${paramIdx}`);
          params.push(JSON.stringify(newCriticalActions));
          paramIdx++;
          totalCriticalActionsNormalized += newCriticalActions.length;
        }

        const sql = `UPDATE scenarios SET ${setClauses.join(', ')} WHERE id = $1`;
        await client.query(sql, params);

        transformed++;
        const title = scenario.title || '(untitled)';
        console.log(`  OK: ${title}`);
        for (const c of changes) {
          console.log(`      ${c}`);
        }
      } catch (err) {
        errors++;
        console.error(`  FAIL: ${scenario.title || scenario.id} — ${err.message}`);
      }
    }

    console.log('\n--- Results ---');
    console.log(`Transformed: ${transformed}`);
    console.log(`Errors: ${errors}`);
    console.log(`Phases created: ${totalPhasesCreated}`);
    console.log(`Critical actions normalized: ${totalCriticalActionsNormalized}`);

    if (doAudit) {
      await runAudit(client);
    }
  } catch (err) {
    console.error(`\nError: ${err.message}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
