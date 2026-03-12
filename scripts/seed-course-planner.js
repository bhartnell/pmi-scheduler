#!/usr/bin/env node
/**
 * Seed LVFR AEMT Course Planner data
 * Reads from data/lvfr-aemt/course_planner.json
 * Seeds: content_blocks, prerequisites, plan_templates, plan_instances, plan_placements
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    let val = trimmed.substring(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function readJson(filename) {
  const filePath = path.join(__dirname, '..', 'data', 'lvfr-aemt', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Helper: add minutes to a time string "HH:MM"
function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60);
  const newM = total % 60;
  return String(newH).padStart(2, '0') + ':' + String(newM).padStart(2, '0');
}

// Helper: calculate date from start_date + day_number
// Day 1 = start_date (Tuesday), Day 2 = +1 (Wed), Day 3 = +2 (Thu)
// Day 4 = +7 (next Tue), Day 5 = +8 (next Wed), Day 6 = +9 (next Thu), etc.
function dayNumberToDate(startDate, dayNumber) {
  const weekIndex = Math.floor((dayNumber - 1) / 3); // 0-based week
  const dayInWeek = (dayNumber - 1) % 3; // 0=Tue, 1=Wed, 2=Thu
  const daysToAdd = weekIndex * 7 + dayInWeek;
  const d = new Date(startDate + 'T12:00:00'); // noon to avoid timezone issues
  d.setDate(d.getDate() + daysToAdd);
  return d.toISOString().split('T')[0];
}

// Postgres text array literal
function pgArray(arr) {
  if (!arr || arr.length === 0) return null;
  return '{' + arr.map(v => '"' + v.replace(/"/g, '\\"') + '"').join(',') + '}';
}

async function main() {
  const connStr = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!connStr) {
    console.error('No DATABASE_URL or SUPABASE_DB_URL found in environment or .env.local');
    process.exit(1);
  }

  const client = new Client({
    connectionString: connStr,
    ssl: connStr.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    const data = readJson('course_planner.json');
    console.log('Loaded course_planner.json: ' + data.content_blocks.length + ' blocks, ' + data.prerequisites.length + ' prerequisites, ' + data.ideal_sequence.length + ' days');

    // 1. Seed content blocks
    console.log('\nSeeding content blocks...');
    let blockCount = 0;
    for (const b of data.content_blocks) {
      await client.query(
        `INSERT INTO lvfr_aemt_content_blocks (id, name, duration_min, block_type, min_instructors, equipment, chapter_id, module_id, can_split, notes, color)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           duration_min = EXCLUDED.duration_min,
           block_type = EXCLUDED.block_type,
           min_instructors = EXCLUDED.min_instructors,
           equipment = EXCLUDED.equipment,
           chapter_id = EXCLUDED.chapter_id,
           module_id = EXCLUDED.module_id,
           can_split = EXCLUDED.can_split,
           notes = EXCLUDED.notes,
           color = EXCLUDED.color`,
        [
          b.id,
          b.name,
          b.duration_min,
          b.block_type,
          b.min_instructors || 1,
          b.equipment ? pgArray(b.equipment) : null,
          b.chapter_id || null,
          b.module_id || null,
          b.can_split || false,
          b.notes || null,
          b.color || null,
        ]
      );
      blockCount++;
    }
    console.log('   ' + blockCount + ' content blocks seeded');

    // 2. Seed prerequisites
    console.log('\nSeeding prerequisites...');
    // Clear existing first for clean state
    await client.query('DELETE FROM lvfr_aemt_prerequisites');
    let prereqCount = 0;
    for (const p of data.prerequisites) {
      await client.query(
        `INSERT INTO lvfr_aemt_prerequisites (block_id, requires_block_id, rule_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (block_id, requires_block_id, rule_type) DO NOTHING`,
        [p.block_id, p.requires_block_id, p.rule_type]
      );
      prereqCount++;
    }
    console.log('   ' + prereqCount + ' prerequisites seeded');

    // 3. Seed default template
    console.log('\nSeeding default template...');
    const tpl = data.default_template;
    const tplResult = await client.query(
      `INSERT INTO lvfr_aemt_plan_templates (name, description, total_weeks, days_per_week, class_days, day_start_time, day_end_time, lunch_start, lunch_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT ON CONSTRAINT lvfr_plan_templates_name_unique DO UPDATE SET
         description = EXCLUDED.description,
         total_weeks = EXCLUDED.total_weeks,
         days_per_week = EXCLUDED.days_per_week,
         class_days = EXCLUDED.class_days,
         day_start_time = EXCLUDED.day_start_time,
         day_end_time = EXCLUDED.day_end_time,
         lunch_start = EXCLUDED.lunch_start,
         lunch_end = EXCLUDED.lunch_end
       RETURNING id`,
      [
        tpl.name,
        tpl.description || null,
        tpl.total_weeks,
        tpl.days_per_week,
        pgArray(tpl.class_days),
        tpl.day_start_time,
        tpl.day_end_time,
        tpl.lunch_start,
        tpl.lunch_end,
      ]
    );
    const templateId = tplResult.rows[0].id;
    console.log('   Template created: ' + templateId);

    // 4. Seed default instance
    console.log('\nSeeding default plan instance...');
    const startDate = '2026-07-07'; // First instruction day (Tuesday)
    const instanceName = 'LVFR Academy 2026-2';

    // Check if instance already exists
    const existingInstance = await client.query(
      'SELECT id FROM lvfr_aemt_plan_instances WHERE name = $1',
      [instanceName]
    );

    let instanceId;
    if (existingInstance.rows.length > 0) {
      instanceId = existingInstance.rows[0].id;
      await client.query(
        'UPDATE lvfr_aemt_plan_instances SET template_id = $1, start_date = $2, updated_at = NOW() WHERE id = $3',
        [templateId, startDate, instanceId]
      );
      console.log('   Instance updated: ' + instanceId);
    } else {
      const instResult = await client.query(
        `INSERT INTO lvfr_aemt_plan_instances (template_id, name, start_date, status)
         VALUES ($1, $2, $3, 'draft')
         RETURNING id`,
        [templateId, instanceName, startDate]
      );
      instanceId = instResult.rows[0].id;
      console.log('   Instance created: ' + instanceId);
    }

    // 5. Seed pre-placed blocks from ideal sequence
    console.log('\nSeeding pre-placed blocks from ideal sequence...');

    // Clear existing placements for this instance
    await client.query('DELETE FROM lvfr_aemt_plan_placements WHERE instance_id = $1', [instanceId]);

    // Build a map of block durations for end_time calculation
    const blockDurations = {};
    for (const b of data.content_blocks) {
      blockDurations[b.id] = b.duration_min;
    }

    let placementCount = 0;
    for (const day of data.ideal_sequence) {
      const date = dayNumberToDate(startDate, day.day_number);

      for (let i = 0; i < day.blocks.length; i++) {
        const block = day.blocks[i];
        const duration = blockDurations[block.block_id];
        if (!duration && duration !== 0) {
          console.warn('   Warning: Unknown block: ' + block.block_id + ' on day ' + day.day_number);
          continue;
        }
        const endTime = addMinutes(block.start_time, duration);

        await client.query(
          `INSERT INTO lvfr_aemt_plan_placements (instance_id, content_block_id, day_number, date, start_time, end_time, duration_min, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (instance_id, content_block_id, day_number, start_time) DO UPDATE SET
             date = EXCLUDED.date,
             end_time = EXCLUDED.end_time,
             duration_min = EXCLUDED.duration_min,
             sort_order = EXCLUDED.sort_order,
             updated_at = NOW()`,
          [instanceId, block.block_id, day.day_number, date, block.start_time, endTime, duration, i]
        );
        placementCount++;
      }
    }
    console.log('   ' + placementCount + ' placements seeded');

    // 6. Verification
    console.log('\nVerification:');
    const counts = await Promise.all([
      client.query('SELECT COUNT(*) FROM lvfr_aemt_content_blocks'),
      client.query('SELECT COUNT(*) FROM lvfr_aemt_prerequisites'),
      client.query('SELECT COUNT(*) FROM lvfr_aemt_plan_templates'),
      client.query('SELECT COUNT(*) FROM lvfr_aemt_plan_instances'),
      client.query('SELECT COUNT(*) FROM lvfr_aemt_plan_placements'),
    ]);
    console.log('   Content blocks: ' + counts[0].rows[0].count);
    console.log('   Prerequisites:  ' + counts[1].rows[0].count);
    console.log('   Templates:      ' + counts[2].rows[0].count);
    console.log('   Instances:      ' + counts[3].rows[0].count);
    console.log('   Placements:     ' + counts[4].rows[0].count);
    console.log('\nCourse planner seed complete!');

  } catch (err) {
    console.error('Error:', err.message);
    if (err.detail) console.error('   Detail:', err.detail);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
