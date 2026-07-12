#!/usr/bin/env node
/**
 * PALS content importer (Phase 1).
 *
 * Loads the 12 AHA PALS 2025 Case Scenario Testing Checklists (+ their Critical
 * Performance Steps, VERBATIM) and the 32 scenario records (16 practice + 16
 * testing) from docs/pals/pals_scenario_seed.json into:
 *   pals_checklists / pals_checklist_criteria   (grading content — FINAL 2025)
 *   scenarios (cert_course='pals')              (case stubs; narratives Phase 2)
 *
 * Idempotent SELECT-then-write by natural key, mirroring import-acls-seed.js:
 *   checklists by checklist_key; criteria by (checklist_id, display_order)
 *   (extras beyond the seed are DEACTIVATED, not deleted, to preserve any FK
 *   references from recorded criterion results); scenarios by (case_code,
 *   cert_course). Re-running updates in place — never duplicates.
 *
 * DATA INTEGRITY (Ben's #1 rule): NOTHING is inferred. Qualitative age
 * ("6 mo"/"child"/"10 yr") is preserved VERBATIM in scenarios.pals_case_meta —
 * never coerced into the integer patient_age. checklist_key='TBD' or unknown =>
 * pals_checklist_id left NULL (logged), never guessed. narrative_status is taken
 * straight from the seed so card display stays gated on 'complete'.
 *
 * PRECONDITION: the cert_tier scenario_* values require the
 * 20260712_cert_tier_scenario_rename migration to have run first (it widens the
 * scenarios_cert_tier_check to allow scenario_practice/scenario_testing).
 *
 * Usage:
 *   node scripts/import-pals-seed.js docs/pals/pals_scenario_seed.json [--dry-run]
 *
 * --dry-run runs the whole import in a transaction and ROLLS BACK.
 * Connection: SUPABASE_DB_URL / DATABASE_URL from .env.local.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// ---- env ----
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = t.slice(i + 1).trim();
  }
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const file = args.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('Usage: node scripts/import-pals-seed.js <seed.json> [--dry-run]');
  process.exit(1);
}

// Fields lifted onto typed scenario columns; everything else in the seed record
// is preserved verbatim in pals_case_meta.
const LIFTED = new Set(['case_code', 'name', 'category', 'checklist_key', 'narrative_status']);

function caseMeta(rec) {
  const meta = {};
  for (const [k, v] of Object.entries(rec)) {
    if (!LIFTED.has(k)) meta[k] = v; // age, weight_kg, manikin_fit, _notes, _aha_conflict, program_selection, …
  }
  return Object.keys(meta).length ? JSON.stringify(meta) : null;
}

async function main() {
  const seed = JSON.parse(fs.readFileSync(file, 'utf8'));
  const course = seed.cert_course || 'pals';
  const contentVersion = seed.content_version || 'AHA 2025';
  const checklists = seed.checklists || [];
  const practice = seed.practice_scenarios || [];
  const testing = seed.testing_case_scenarios || [];

  const conn = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!conn) { console.error('No SUPABASE_DB_URL / DATABASE_URL configured.'); process.exit(1); }
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const stats = {
    clIns: 0, clUpd: 0, critIns: 0, critUpd: 0, critDeact: 0,
    scenIns: 0, scenUpd: 0, linked: 0, unlinked: 0,
  };
  const idByKey = {};
  const warnings = [];

  try {
    await client.query('BEGIN');

    // ---- 1. checklists + criteria (VERBATIM) ----
    for (const cl of checklists) {
      const ex = await client.query('SELECT id FROM pals_checklists WHERE checklist_key=$1', [cl.key]);
      let clId;
      if (ex.rows[0]) {
        clId = ex.rows[0].id;
        await client.query(
          `UPDATE pals_checklists
             SET category=$1, subtype=$2, source_ref=$3, cert_course=$4,
                 content_version=$5, pass_rule=$6, active=true, updated_at=now()
           WHERE id=$7`,
          [cl.category, cl.subtype || null, cl.source_ref || null, course, contentVersion, 'all_in_scope_checked', clId]
        );
        stats.clUpd++;
      } else {
        const ins = await client.query(
          `INSERT INTO pals_checklists (checklist_key, category, subtype, source_ref, cert_course, content_version, pass_rule, active)
           VALUES ($1,$2,$3,$4,$5,$6,$7,true) RETURNING id`,
          [cl.key, cl.category, cl.subtype || null, cl.source_ref || null, course, contentVersion, 'all_in_scope_checked']
        );
        clId = ins.rows[0].id;
        stats.clIns++;
      }
      idByKey[cl.key] = clId;

      const crits = cl.criteria || [];
      for (const c of crits) {
        const order = c.order;
        const ex2 = await client.query(
          'SELECT id FROM pals_checklist_criteria WHERE checklist_id=$1 AND display_order=$2',
          [clId, order]
        );
        if (ex2.rows[0]) {
          await client.query(
            `UPDATE pals_checklist_criteria
               SET text=$1, instructor_prompt=$2, prompt_kind=$3, scope_conditional=$4,
                   is_critical=$5, active=true
             WHERE id=$6`,
            [c.text, c.instructor_prompt || null, c.prompt_kind || null,
             !!c.scope_conditional, !!c.is_critical, ex2.rows[0].id]
          );
          stats.critUpd++;
        } else {
          await client.query(
            `INSERT INTO pals_checklist_criteria
               (checklist_id, display_order, text, instructor_prompt, prompt_kind, scope_conditional, is_critical, active)
             VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
            [clId, order, c.text, c.instructor_prompt || null, c.prompt_kind || null,
             !!c.scope_conditional, !!c.is_critical]
          );
          stats.critIns++;
        }
      }
      const maxOrder = crits.reduce((m, c) => Math.max(m, c.order), 0);
      const deact = await client.query(
        'UPDATE pals_checklist_criteria SET active=false WHERE checklist_id=$1 AND display_order>$2 AND active=true',
        [clId, maxOrder]
      );
      stats.critDeact += deact.rowCount;
    }

    // ---- 2. scenarios (practice = scenario_practice, testing = scenario_testing) ----
    const groups = [
      { rows: practice, tier: 'scenario_practice' },
      { rows: testing, tier: 'scenario_testing' },
    ];
    for (const g of groups) {
      for (const rec of g.rows) {
        // Resolve checklist link — never guess. TBD / unknown => NULL + warn.
        let checklistId = null;
        const key = rec.checklist_key;
        if (key && key !== 'TBD') {
          checklistId = idByKey[key] || null;
          if (!checklistId) warnings.push(`${rec.case_code}: unknown checklist_key "${key}" — left unlinked`);
        } else {
          warnings.push(`${rec.case_code}: checklist_key "${key || 'missing'}" — left unlinked (expected for not-yet-indexed cases)`);
        }
        if (checklistId) stats.linked++; else stats.unlinked++;

        const meta = caseMeta(rec);
        const ex = await client.query(
          'SELECT id FROM scenarios WHERE case_code=$1 AND cert_course=$2',
          [rec.case_code, course]
        );
        if (ex.rows[0]) {
          await client.query(
            `UPDATE scenarios
               SET title=$1, category=COALESCE(category,$2), cert_tier=$3,
                   narrative_status=$4, pals_checklist_id=$5, pals_case_meta=$6::jsonb,
                   is_active=true
             WHERE id=$7`,
            [rec.name, rec.category || null, g.tier, rec.narrative_status || null, checklistId, meta, ex.rows[0].id]
          );
          stats.scenUpd++;
        } else {
          await client.query(
            `INSERT INTO scenarios
               (title, category, case_code, cert_course, cert_tier, narrative_status, pals_checklist_id, pals_case_meta, is_active)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,true)`,
            [rec.name, rec.category || null, rec.case_code, course, g.tier, rec.narrative_status || null, checklistId, meta]
          );
          stats.scenIns++;
        }
      }
    }

    if (dryRun) {
      await client.query('ROLLBACK');
      console.log('🔍 DRY RUN — rolled back, nothing persisted.');
    } else {
      await client.query('COMMIT');
      console.log('✅ Import committed.');
    }

    console.log(JSON.stringify(stats, null, 2));
    console.log(
      `Checklists: ${stats.clIns} new / ${stats.clUpd} updated | ` +
      `Criteria: ${stats.critIns} new / ${stats.critUpd} updated / ${stats.critDeact} deactivated | ` +
      `Scenarios: ${stats.scenIns} new / ${stats.scenUpd} updated (${stats.linked} linked to a checklist, ${stats.unlinked} unlinked)`
    );
    if (warnings.length) {
      console.log(`\n⚠ ${warnings.length} unlinked/notable:`);
      for (const w of warnings) console.log(`   - ${w}`);
    }
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ FAILED (rolled back):', e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
