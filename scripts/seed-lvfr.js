#!/usr/bin/env node
/**
 * Seed LVFR AEMT reference data + instructor availability.
 * Uses pg directly (same pattern as run-migration.js).
 */

const { Client } = require('pg');
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
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* no .env.local */ }

function getConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  const host = process.env.SUPABASE_DB_HOST || 'aws-0-us-west-2.pooler.supabase.com';
  const port = process.env.SUPABASE_DB_PORT || '5432';
  const user = process.env.SUPABASE_DB_USER || 'postgres.mkrqpwncfjpppxyntdtp';
  const password = process.env.SUPABASE_DB_PASSWORD;
  const database = process.env.SUPABASE_DB_NAME || 'postgres';
  if (!password) { console.error('ERROR: No database connection.'); process.exit(1); }
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

function readJson(filename) {
  const filePath = path.join(__dirname, '..', 'data', 'lvfr-aemt', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Escape scalar values for SQL
function esc(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
  return 'NULL';
}

// Escape TEXT[] (Postgres text array)
function escTextArr(arr) {
  if (!arr || !Array.isArray(arr) || arr.length === 0) return "'{}'";
  const items = arr.map(v => `"${String(v).replace(/"/g, '\\"').replace(/'/g, "''")}"`)
  return `'{${items.join(',')}}'`;
}

// Escape JSONB
function escJsonb(val) {
  if (val === null || val === undefined) return 'NULL';
  return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
}

async function run() {
  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log('Connected to database\n');

  try {
    // 1. MODULES
    const calData = readJson('course_calendar.json');
    for (const m of calData.modules) {
      await client.query(`INSERT INTO lvfr_aemt_modules (id, number, name, chapters, exam_day, week_range)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, chapters=EXCLUDED.chapters, exam_day=EXCLUDED.exam_day, week_range=EXCLUDED.week_range`,
        [m.id, m.number, m.name, m.chapters || [], m.exam_day || null, m.week_range || null]);
    }
    console.log(`✅ Modules: ${calData.modules.length}`);

    // 2. COURSE DAYS
    for (const d of calData.days) {
      await client.query(`INSERT INTO lvfr_aemt_course_days (day_number, date, day_of_week, week_number, module_id, day_type, title, chapters_covered, has_lab, lab_name, has_exam, exam_name, exam_module, has_quiz, quiz_chapters, time_blocks, reinforcement_activities)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        ON CONFLICT (day_number) DO UPDATE SET date=EXCLUDED.date, day_of_week=EXCLUDED.day_of_week, week_number=EXCLUDED.week_number, module_id=EXCLUDED.module_id, day_type=EXCLUDED.day_type, title=EXCLUDED.title, chapters_covered=EXCLUDED.chapters_covered, has_lab=EXCLUDED.has_lab, lab_name=EXCLUDED.lab_name, has_exam=EXCLUDED.has_exam, exam_name=EXCLUDED.exam_name, exam_module=EXCLUDED.exam_module, has_quiz=EXCLUDED.has_quiz, quiz_chapters=EXCLUDED.quiz_chapters, time_blocks=EXCLUDED.time_blocks, reinforcement_activities=EXCLUDED.reinforcement_activities`,
        [d.day_number, d.date, d.day_of_week, d.week, d.module_id, d.day_type, d.title||null,
         d.chapters_covered||[], d.has_lab||false, d.lab_name||null, d.has_exam||false,
         d.exam_name||null, d.exam_module||null, d.has_quiz||false, d.quiz_chapters||[],
         d.time_blocks ? JSON.stringify(d.time_blocks) : null,
         d.reinforcement_activities ? JSON.stringify(d.reinforcement_activities) : null]);
    }
    console.log(`✅ Course days: ${calData.days.length}`);

    // 3. SUPPLEMENTARY DAYS
    for (let i = 0; i < calData.supplementary_days.length; i++) {
      const s = calData.supplementary_days[i];
      await client.query(`INSERT INTO lvfr_aemt_supplementary_days (day_number, date, day_of_week, week_number, title, instructor)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (day_number) DO UPDATE SET date=EXCLUDED.date, week_number=EXCLUDED.week_number, title=EXCLUDED.title, instructor=EXCLUDED.instructor`,
        [100+i+1, s.date, 'Monday', s.week, s.content, s.instructor||null]);
    }
    console.log(`✅ Supplementary days: ${calData.supplementary_days.length}`);

    // 4. CHAPTERS
    const chapData = readJson('chapters.json');
    for (const c of chapData.chapters) {
      const td = c.teaching_day !== undefined ? JSON.stringify(c.teaching_day) : null;
      await client.query(`INSERT INTO lvfr_aemt_chapters (id, number, title, module_id, teaching_day, estimated_lecture_min, estimated_lab_min, key_topics, note)
        VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)
        ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, module_id=EXCLUDED.module_id, teaching_day=EXCLUDED.teaching_day, estimated_lecture_min=EXCLUDED.estimated_lecture_min, estimated_lab_min=EXCLUDED.estimated_lab_min, key_topics=EXCLUDED.key_topics, note=EXCLUDED.note`,
        [c.id, c.number, c.title, c.module_id, td, c.estimated_lecture_min||0, c.estimated_lab_min||0, c.key_topics||[], c.note||null]);
    }
    console.log(`✅ Chapters: ${chapData.chapters.length}`);

    // 5. MEDICATIONS
    const medData = readJson('medication_cards.json');
    for (const m of medData.medication_cards) {
      await client.query(`INSERT INTO lvfr_aemt_medications (id, generic_name, brand_names, drug_class, mechanism_of_action, indications, contraindications, dose_adult, dose_pediatric, route, onset, duration, side_effects, special_considerations, snhd_formulary, checkpoint_blanks)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        ON CONFLICT (id) DO UPDATE SET generic_name=EXCLUDED.generic_name, brand_names=EXCLUDED.brand_names, drug_class=EXCLUDED.drug_class, mechanism_of_action=EXCLUDED.mechanism_of_action, indications=EXCLUDED.indications, contraindications=EXCLUDED.contraindications, dose_adult=EXCLUDED.dose_adult, dose_pediatric=EXCLUDED.dose_pediatric, route=EXCLUDED.route, onset=EXCLUDED.onset, duration=EXCLUDED.duration, side_effects=EXCLUDED.side_effects, special_considerations=EXCLUDED.special_considerations, snhd_formulary=EXCLUDED.snhd_formulary, checkpoint_blanks=EXCLUDED.checkpoint_blanks`,
        [m.id, m.generic_name, m.brand_names||[], m.drug_class||null, m.mechanism_of_action||null,
         m.indications||[], m.contraindications||[], m.dose_adult||null, m.dose_pediatric||null,
         m.route||[], m.onset||null, m.duration||null, m.side_effects||[],
         m.special_considerations||null, m.snhd_formulary||false, m.checkpoint_blanks||[]]);
    }
    console.log(`✅ Medications: ${medData.medication_cards.length}`);

    // 6. SKILLS
    const skillsData = readJson('skills_tracking.json');
    let skillCount = 0;
    for (const cat of skillsData.skills_tracking.skill_categories) {
      for (const s of cat.skills) {
        await client.query(`INSERT INTO lvfr_aemt_skills (id, category, name, description, nremt_tested, introduced_day, practice_days, evaluation_day, min_practice_attempts, equipment_needed, safety_note)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          ON CONFLICT (id) DO UPDATE SET category=EXCLUDED.category, name=EXCLUDED.name, description=EXCLUDED.description, nremt_tested=EXCLUDED.nremt_tested, introduced_day=EXCLUDED.introduced_day, practice_days=EXCLUDED.practice_days, evaluation_day=EXCLUDED.evaluation_day, min_practice_attempts=EXCLUDED.min_practice_attempts, equipment_needed=EXCLUDED.equipment_needed, safety_note=EXCLUDED.safety_note`,
          [s.id, cat.name, s.name, s.description||null, s.nremt_tested||false,
           s.introduced_day||null, s.practice_days||[], s.evaluation_day||null,
           s.min_practice_attempts||1, s.equipment_needed||[], s.safety_note||null]);
        skillCount++;
      }
    }
    console.log(`✅ Skills: ${skillCount}`);

    // 7. ASSESSMENTS
    const gradeData = readJson('gradebook.json');
    for (const a of gradeData.gradebook.assessments) {
      const chapters = Array.isArray(a.chapters) ? a.chapters : [];
      await client.query(`INSERT INTO lvfr_aemt_assessments (id, category, day_number, date, title, question_count, chapters, pass_score, note)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (id) DO UPDATE SET category=EXCLUDED.category, day_number=EXCLUDED.day_number, date=EXCLUDED.date, title=EXCLUDED.title, question_count=EXCLUDED.question_count, chapters=EXCLUDED.chapters, pass_score=EXCLUDED.pass_score, note=EXCLUDED.note`,
        [a.id, a.category, a.day||null, a.date||null, a.title, a.questions||null, chapters, a.pass_score||80, a.note||null]);
    }
    console.log(`✅ Assessments: ${gradeData.gradebook.assessments.length}`);

    // 8. INSTRUCTOR ASSIGNMENTS
    const schedData = readJson('instructor_scheduling.json');
    for (const a of schedData.daily_assignments) {
      const notes = [
        a.primary ? `primary: ${a.primary}` : null,
        a.secondary ? `secondary: ${a.secondary}` : null,
        a.ben_status ? `ben_status: ${a.ben_status}` : null,
        a.notes || null,
      ].filter(Boolean).join(' | ') || null;
      await client.query(`INSERT INTO lvfr_aemt_instructor_assignments (day_number, date, min_instructors, notes)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT (day_number) DO UPDATE SET date=EXCLUDED.date, min_instructors=EXCLUDED.min_instructors, notes=EXCLUDED.notes`,
        [a.day, a.date, a.min_instructors||1, notes]);
    }
    console.log(`✅ Instructor assignments: ${schedData.daily_assignments.length}`);

    // =========================================================================
    // 9. INSTRUCTOR AVAILABILITY — Ben, Jimi, Trevor
    // =========================================================================
    console.log('\n--- Seeding instructor availability ---');

    // Look up Ben
    const benResult = await client.query(`SELECT id FROM lab_users WHERE email = 'bhartnell@pmi.edu' LIMIT 1`);
    const benId = benResult.rows.length ? benResult.rows[0].id : null;
    if (!benId) {
      console.log('⚠ Ben (bhartnell@pmi.edu) not found — skipping Ben availability');
    } else {
      console.log(`  Found Ben: ${benId}`);
    }

    // Look up or create Jimi
    let jimiResult = await client.query(`SELECT id FROM lab_users WHERE name ILIKE '%jimi%' LIMIT 1`);
    let jimiId = jimiResult.rows.length ? jimiResult.rows[0].id : null;
    if (!jimiId) {
      const r = await client.query(`INSERT INTO lab_users (name, email, role) VALUES ('Jimi', 'jimi.lvfr@placeholder.pmi.edu', 'instructor') RETURNING id`);
      jimiId = r.rows[0].id;
      console.log(`  Created Jimi: ${jimiId}`);
    } else {
      console.log(`  Found Jimi: ${jimiId}`);
    }

    // Look up or create Trevor
    let trevorResult = await client.query(`SELECT id FROM lab_users WHERE name ILIKE '%trevor%' LIMIT 1`);
    let trevorId = trevorResult.rows.length ? trevorResult.rows[0].id : null;
    if (!trevorId) {
      const r = await client.query(`INSERT INTO lab_users (name, email, role) VALUES ('Trevor', 'trevor.lvfr@placeholder.pmi.edu', 'instructor') RETURNING id`);
      trevorId = r.rows[0].id;
      console.log(`  Created Trevor: ${trevorId}`);
    } else {
      console.log(`  Found Trevor: ${trevorId}`);
    }

    let availCount = 0;
    for (const day of schedData.daily_assignments) {
      // --- BEN ---
      if (benId) {
        let am1 = true, mid = true, pm1 = true, pm2 = true;
        let status = 'available';
        let notes = '';

        if (day.ben_status === 'conflict') {
          am1 = mid = pm1 = pm2 = false;
          status = 'conflict';
          notes = day.notes || 'Full day conflict';
        } else if (day.ben_status === 'partial') {
          const dt = new Date(day.date + 'T12:00:00Z');
          const dow = dt.getUTCDay();
          if (day.date < '2026-08-11') {
            if (dow === 2) { // Tuesday
              am1 = true; mid = false; pm1 = false; pm2 = false;
              status = 'partial';
              notes = 'Pima Airway+Peds 10:15-12:45, Pima Lab 14:15-17:00';
            } else if (dow === 4) { // Thursday
              am1 = true; mid = true; pm1 = false; pm2 = false;
              status = 'partial';
              notes = 'Pima Lab 14:15-17:00';
            } else {
              status = 'partial';
              notes = day.notes || 'Partial availability';
            }
          } else {
            status = 'available';
            notes = 'Full availability after Aug 11';
          }
        }

        await client.query(`INSERT INTO lvfr_aemt_instructor_availability (instructor_id, date, am1_available, mid_available, pm1_available, pm2_available, status, notes, source)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          ON CONFLICT (instructor_id, date) DO UPDATE SET am1_available=EXCLUDED.am1_available, mid_available=EXCLUDED.mid_available, pm1_available=EXCLUDED.pm1_available, pm2_available=EXCLUDED.pm2_available, status=EXCLUDED.status, notes=EXCLUDED.notes, source=EXCLUDED.source`,
          [benId, day.date, am1, mid, pm1, pm2, status, notes, 'imported']);
        availCount++;
      }

      // --- JIMI ---
      await client.query(`INSERT INTO lvfr_aemt_instructor_availability (instructor_id, date, am1_available, mid_available, pm1_available, pm2_available, status, notes, source)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (instructor_id, date) DO UPDATE SET am1_available=EXCLUDED.am1_available, mid_available=EXCLUDED.mid_available, pm1_available=EXCLUDED.pm1_available, pm2_available=EXCLUDED.pm2_available, status=EXCLUDED.status, notes=EXCLUDED.notes, source=EXCLUDED.source`,
        [jimiId, day.date, true, true, true, true, 'available', 'Primary daily instructor — shift schedule pending', 'imported']);
      availCount++;

      // --- TREVOR ---
      await client.query(`INSERT INTO lvfr_aemt_instructor_availability (instructor_id, date, am1_available, mid_available, pm1_available, pm2_available, status, notes, source)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (instructor_id, date) DO UPDATE SET am1_available=EXCLUDED.am1_available, mid_available=EXCLUDED.mid_available, pm1_available=EXCLUDED.pm1_available, pm2_available=EXCLUDED.pm2_available, status=EXCLUDED.status, notes=EXCLUDED.notes, source=EXCLUDED.source`,
        [trevorId, day.date, true, true, true, true, 'available', 'Secondary instructor — schedule pending', 'imported']);
      availCount++;
    }
    console.log(`✅ Instructor availability: ${availCount} rows`);

    // =========================================================================
    // VERIFICATION
    // =========================================================================
    console.log('\n--- Verification ---');
    const checks = [
      ['lvfr_aemt_modules', null],
      ['lvfr_aemt_course_days', 30],
      ['lvfr_aemt_supplementary_days', null],
      ['lvfr_aemt_chapters', 42],
      ['lvfr_aemt_medications', 8],
      ['lvfr_aemt_skills', null],
      ['lvfr_aemt_assessments', null],
      ['lvfr_aemt_instructor_assignments', 30],
      ['lvfr_aemt_instructor_availability', null],
    ];
    for (const [table, expected] of checks) {
      const res = await client.query(`SELECT count(*) FROM ${table}`);
      const count = parseInt(res.rows[0].count);
      const mark = expected ? (count >= expected ? '✅' : `⚠ expected ${expected}`) : '✅';
      console.log(`  ${mark} ${table}: ${count}`);
    }
    console.log('\n🎉 LVFR AEMT seed complete!');
  } catch (err) {
    console.error('\n❌ Seed failed:', err.message);
    if (err.detail) console.error('  Detail:', err.detail);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
