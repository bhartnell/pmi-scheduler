#!/usr/bin/env node
/**
 * ACLS / advanced-cert content importer (build-order step 2).
 *
 * Loads the reusable algorithm-segment library + scenario assemblies from
 * acls_scenario_seed.json into the adv_cert_* tables and the tagged scenarios
 * rows. Mirrors the skill-drills importer's upsert semantics: idempotent
 * SELECT-then-write by natural key (segments by (key, cert_course); scenarios
 * by (case_code, cert_course)), so re-running updates in place — never
 * duplicates and never orphans existing grading data (criteria/segments beyond
 * the seed are DEACTIVATED, not deleted, to preserve FK references from any
 * recorded results).
 *
 * Usage:
 *   node scripts/import-acls-seed.js <seed.json> [--dry-run]
 *
 * --dry-run runs the entire import inside a transaction and ROLLS BACK, so it
 * exercises every statement (catching errors) and reports real counts without
 * persisting anything.
 *
 * Connection: SUPABASE_DB_URL / DATABASE_URL from .env.local (same as
 * run-migration.js).
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
  console.error('Usage: node scripts/import-acls-seed.js <seed.json> [--dry-run]');
  process.exit(1);
}

const SCENARIO_CATEGORY = 'Cardiac'; // ACLS cases are all cardiac arrest / peri-arrest

async function main() {
  const seed = JSON.parse(fs.readFileSync(file, 'utf8'));
  const segments = seed.algorithm_segments || [];
  const scenarios = seed.scenarios || [];
  const defaultCourse = seed.cert_course || 'acls';

  const conn = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const stats = {
    segIns: 0, segUpd: 0, critIns: 0, critUpd: 0, critDeact: 0,
    scenIns: 0, scenUpd: 0, ssIns: 0, ssUpd: 0,
  };

  try {
    await client.query('BEGIN');

    // ---- 1. segments + criteria ----
    const segIdByKey = {}; // `${key}|${course}` -> id
    for (const s of segments) {
      const course = s.cert_course || defaultCourse;
      const existing = await client.query(
        'SELECT id FROM adv_cert_segments WHERE key=$1 AND cert_course=$2',
        [s.key, course]
      );
      let segId;
      if (existing.rows[0]) {
        segId = existing.rows[0].id;
        await client.query(
          `UPDATE adv_cert_segments
             SET name=$1, algorithm_type=$2, always_present=$3, content_version=$4, active=true, updated_at=now()
           WHERE id=$5`,
          [s.name, s.algorithm_type, !!s.always_present, s.content_version || 'AHA 2020', segId]
        );
        stats.segUpd++;
      } else {
        const ins = await client.query(
          `INSERT INTO adv_cert_segments (key, name, algorithm_type, always_present, cert_course, content_version, active)
           VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING id`,
          [s.key, s.name, s.algorithm_type, !!s.always_present, course, s.content_version || 'AHA 2020']
        );
        segId = ins.rows[0].id;
        stats.segIns++;
      }
      segIdByKey[`${s.key}|${course}`] = segId;

      // criteria: upsert by (segment_id, display_order); deactivate extras
      const crits = s.criteria || [];
      for (let i = 0; i < crits.length; i++) {
        const text = crits[i];
        const order = i + 1;
        const ex = await client.query(
          'SELECT id FROM adv_cert_segment_criteria WHERE segment_id=$1 AND display_order=$2',
          [segId, order]
        );
        if (ex.rows[0]) {
          await client.query(
            'UPDATE adv_cert_segment_criteria SET text=$1, active=true WHERE id=$2',
            [text, ex.rows[0].id]
          );
          stats.critUpd++;
        } else {
          await client.query(
            'INSERT INTO adv_cert_segment_criteria (segment_id, text, display_order, active) VALUES ($1,$2,$3,true)',
            [segId, text, order]
          );
          stats.critIns++;
        }
      }
      const deact = await client.query(
        'UPDATE adv_cert_segment_criteria SET active=false WHERE segment_id=$1 AND display_order>$2 AND active=true',
        [segId, crits.length]
      );
      stats.critDeact += deact.rowCount;
    }

    // ---- 2. scenarios + assembly ----
    for (const sc of scenarios) {
      const course = sc.cert_course || defaultCourse;
      const ex = await client.query(
        'SELECT id FROM scenarios WHERE case_code=$1 AND cert_course=$2',
        [sc.case_code, course]
      );
      let scenId;
      if (ex.rows[0]) {
        scenId = ex.rows[0].id;
        await client.query(
          `UPDATE scenarios
             SET title=$1, grading_model=$2, cert_tier=$3, scenario_scope=$4, is_active=true
           WHERE id=$5`,
          [sc.name, sc.grading_model || null, sc.cert_tier || null, sc.scenario_scope || null, scenId]
        );
        stats.scenUpd++;
      } else {
        const ins = await client.query(
          `INSERT INTO scenarios (title, category, case_code, cert_course, cert_tier, scenario_scope, grading_model, is_active)
           VALUES ($1,$2,$3,$4,$5,$6,$7,true) RETURNING id`,
          [sc.name, SCENARIO_CATEGORY, sc.case_code, course, sc.cert_tier || null, sc.scenario_scope || null, sc.grading_model || null]
        );
        scenId = ins.rows[0].id;
        stats.scenIns++;
      }

      // assembly: upsert adv_cert_scenario_segments by (scenario_id, sequence_order)
      for (const seg of sc.segments || []) {
        const key = `${seg.segment_key}|${course}`;
        const segId = segIdByKey[key];
        if (!segId) throw new Error(`Scenario ${sc.case_code} references unknown segment_key "${seg.segment_key}" (course ${course})`);
        const exss = await client.query(
          'SELECT id FROM adv_cert_scenario_segments WHERE scenario_id=$1 AND sequence_order=$2',
          [scenId, seg.order]
        );
        if (exss.rows[0]) {
          await client.query(
            'UPDATE adv_cert_scenario_segments SET segment_id=$1 WHERE id=$2',
            [segId, exss.rows[0].id]
          );
          stats.ssUpd++;
        } else {
          await client.query(
            'INSERT INTO adv_cert_scenario_segments (scenario_id, segment_id, sequence_order) VALUES ($1,$2,$3)',
            [scenId, segId, seg.order]
          );
          stats.ssIns++;
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
      `Segments: ${stats.segIns} new / ${stats.segUpd} updated | ` +
      `Criteria: ${stats.critIns} new / ${stats.critUpd} updated / ${stats.critDeact} deactivated | ` +
      `Scenarios: ${stats.scenIns} new / ${stats.scenUpd} updated | ` +
      `Assembly rows: ${stats.ssIns} new / ${stats.ssUpd} updated`
    );
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ FAILED (rolled back):', e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
