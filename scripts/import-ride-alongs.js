#!/usr/bin/env node
// Import EMT Group 4 Ride-Along data from XLSX spreadsheet into database.
//
// Usage:
//   node scripts/import-ride-alongs.js <path-to-xlsx>
//   node scripts/import-ride-alongs.js <path-to-xlsx> --dry-run
//
// Imports into: ride_along_templates, ride_along_shifts,
//               ride_along_assignments, ride_along_availability

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// ─── Load .env.local ───────────────────────────────────────────────
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
} catch { /* .env.local not found */ }

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

// ─── Helpers ────────────────────────────────────────────────────────

/** Convert Excel serial date number to JS Date */
function excelDateToDate(serial) {
  if (typeof serial === 'string') {
    // Already a date string like "03/20/2026"
    const d = new Date(serial);
    if (!isNaN(d.getTime())) return d;
    return null;
  }
  if (typeof serial !== 'number') return null;
  // Excel epoch is 1899-12-30
  const utcDays = Math.floor(serial - 25569);
  return new Date(utcDays * 86400000);
}

/** Format Date as YYYY-MM-DD */
function formatDate(d) {
  if (!d) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Parse time string like "0400-1600" into {start: "04:00", end: "16:00"} */
function parseTimeRange(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return { start: null, end: null };
  const m = timeStr.match(/(\d{4})-(\d{4})/);
  if (!m) return { start: null, end: null };
  const fmt = (t) => t.substring(0, 2) + ':' + t.substring(2, 4);
  return { start: fmt(m[1]), end: fmt(m[2]) };
}

/** Classify shift type based on start hour */
function classifyShiftType(startTime) {
  if (!startTime) return null;
  const hour = parseInt(startTime.split(':')[0], 10);
  if (hour >= 3 && hour < 12) return 'day';
  if (hour >= 12 && hour <= 16) return 'swing';
  if (hour >= 17 && hour <= 23) return 'night';
  return 'night'; // 0000-0200 treated as night
}

/** Map day name to day_of_week integer (0=Sun, 5=Fri, 6=Sat) */
function dayNameToInt(name) {
  const map = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  return map[(name || '').toLowerCase().trim()] ?? null;
}

// ─── Unit/Preceptor definitions ─────────────────────────────────────

const PRECEPTOR_MAP = {
  '203A': 'AEMT Dolane',
  '210B': 'AEMT Dylan',
  '211B': 'AEMT Phoenix',
  '302B': 'Medic Ashli',
  '315A': 'Medic Phil',
  '319A': 'Medic Michael',
  '332B': 'Medic Charles',
};

const UNIT_SCHEDULE = [
  // Friday (day_of_week = 5)
  { unit: '302B', time: '0400-1600', day: 5 },
  { unit: '332B', time: '1200-0000', day: 5 },
  { unit: '210B', time: '1745-0545', day: 5 },
  { unit: '211B', time: '1815-0615', day: 5 },
  // Saturday (day_of_week = 6)
  { unit: '302B', time: '0400-1600', day: 6 },
  { unit: '210B', time: '1745-0545', day: 6 },
  { unit: '211B', time: '1815-0615', day: 6 },
  // Sunday (day_of_week = 0)
  { unit: '203A', time: '0515-1715', day: 0 },
  { unit: '315A', time: '1130-2330', day: 0 },
  { unit: '319A', time: '1600-0400', day: 0 },
  { unit: '210B', time: '1745-0545', day: 0 },
];

// ─── Parse Spreadsheet ──────────────────────────────────────────────

function parseSpreadsheet(filePath) {
  const wb = XLSX.readFile(filePath);

  // 1. Parse Form Responses → availability
  const formSheet = XLSX.utils.sheet_to_json(wb.Sheets['Form Responses 1'], { header: 1 });
  const availabilityRows = [];
  // Use latest submission per student (by normalized name, prefer pmi.edu email)
  const latestByName = new Map();

  for (let i = 1; i < formSheet.length; i++) {
    const row = formSheet[i];
    if (!row || !row[1]) continue;
    const email = (row[1] || '').toString().trim().toLowerCase();
    const firstName = (row[2] || '').toString().trim();
    const lastName = (row[3] || '').toString().trim();
    const dayPref = (row[4] || '').toString();
    const shiftPref = (row[5] || '').toString();
    const comments = (row[6] || '').toString().trim();
    const timestamp = row[0]; // Excel serial

    // Parse available days
    const available_days = {};
    const dayNames = ['friday', 'saturday', 'sunday'];
    if (dayPref.toLowerCase().includes('no preference')) {
      dayNames.forEach(d => available_days[d] = true);
    } else {
      for (const d of dayNames) {
        if (dayPref.toLowerCase().includes(d)) available_days[d] = true;
      }
    }

    // Parse preferred shift types
    let preferred_shift_type = [];
    if (shiftPref.toLowerCase().includes('no preference')) {
      preferred_shift_type = ['day', 'swing', 'night'];
    } else {
      if (shiftPref.toLowerCase().includes('day shift')) preferred_shift_type.push('day');
      if (shiftPref.toLowerCase().includes('swing shift')) preferred_shift_type.push('swing');
      if (shiftPref.toLowerCase().includes('night shift')) preferred_shift_type.push('night');
    }

    const entry = {
      email, firstName, lastName,
      available_days, preferred_shift_type,
      notes: comments || null,
      timestamp,
    };

    // Key by normalized name to merge pmi.edu and personal gmail submissions
    const nameKey = `${firstName.toLowerCase()}_${lastName.toLowerCase()}`;
    const existing = latestByName.get(nameKey);
    if (!existing || (timestamp && existing.timestamp && timestamp > existing.timestamp)) {
      // Prefer pmi.edu email even if this submission is newer with personal email
      if (existing && existing.email.endsWith('@my.pmi.edu') && !email.endsWith('@my.pmi.edu')) {
        entry.email = existing.email;
      }
      latestByName.set(nameKey, entry);
    }
  }
  availabilityRows.push(...latestByName.values());

  // 2. Parse Master Schedule → shifts + assignments
  const masterSheet = XLSX.utils.sheet_to_json(wb.Sheets['Master Schedule'], { header: 1 });
  const shiftRows = [];

  for (let i = 2; i < masterSheet.length; i++) {
    const row = masterSheet[i];
    if (!row || row[0] == null) continue;
    // Skip legend/header rows
    if (typeof row[0] === 'string' && (row[0].startsWith('Legend') || row[0].startsWith('EMT') || row[0] === 'Date')) continue;

    const dateRaw = row[0];
    const day = (row[1] || '').toString().trim();
    const unit = (row[2] || '').toString().trim();
    const preceptor = (row[3] || '').toString().trim();
    const timeRange = (row[4] || '').toString().trim();
    const studentName = (row[5] || '').toString().trim();
    const notes = (row[6] || '').toString().trim() || null;

    if (!unit || !studentName) continue;

    const date = excelDateToDate(dateRaw);
    if (!date) {
      console.warn(`  WARN: Could not parse date for row ${i}: ${dateRaw}`);
      continue;
    }

    const { start, end } = parseTimeRange(timeRange);
    const shiftType = classifyShiftType(start);

    shiftRows.push({
      date: formatDate(date),
      dayName: day,
      unit,
      preceptor,
      timeRange,
      startTime: start,
      endTime: end,
      shiftType,
      studentName,
      notes,
    });
  }

  return { availabilityRows, shiftRows };
}

// ─── Student Matching ───────────────────────────────────────────────

async function loadStudents(client) {
  const res = await client.query(`
    SELECT id, first_name, last_name, email
    FROM students
    ORDER BY last_name, first_name
  `);
  return res.rows;
}

function matchStudent(students, name, email) {
  // Try email match first (most reliable)
  if (email) {
    const emailLower = email.toLowerCase().trim();
    const byEmail = students.find(s => s.email && s.email.toLowerCase() === emailLower);
    if (byEmail) return byEmail;
  }

  // Try name match
  if (!name) return null;
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return null;

  const firstName = parts[0].toLowerCase();
  const lastName = parts.slice(1).join(' ').toLowerCase();

  // Exact match
  let match = students.find(s =>
    s.first_name.toLowerCase() === firstName &&
    s.last_name.toLowerCase() === lastName
  );
  if (match) return match;

  // Try first name + last name starts with (handles "Salazar Salgado" vs "Salgado")
  match = students.find(s =>
    s.first_name.toLowerCase() === firstName &&
    (s.last_name.toLowerCase().includes(lastName) || lastName.includes(s.last_name.toLowerCase()))
  );
  if (match) return match;

  // Case-insensitive partial match on last name
  match = students.find(s =>
    s.first_name.toLowerCase() === firstName &&
    (s.last_name.toLowerCase().startsWith(lastName.split(' ')[0]) ||
     lastName.split(' ')[0].startsWith(s.last_name.toLowerCase().split(' ')[0]))
  );
  return match || null;
}

// ─── Main Import ────────────────────────────────────────────────────

async function run() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const filePath = args.find(a => !a.startsWith('--'));

  if (!filePath) {
    console.error('Usage: node scripts/import-ride-alongs.js <file.xlsx> [--dry-run]');
    process.exit(1);
  }

  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  console.log('\n=== EMT Group 4 Ride-Along Import ===');
  console.log(`File: ${resolvedPath}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  // Parse spreadsheet
  const { availabilityRows, shiftRows } = parseSpreadsheet(resolvedPath);
  console.log(`Parsed ${availabilityRows.length} availability records`);
  console.log(`Parsed ${shiftRows.length} shift/assignment records\n`);

  if (dryRun) {
    console.log('--- Templates to create ---');
    for (const u of UNIT_SCHEDULE) {
      const { start, end } = parseTimeRange(u.time);
      console.log(`  ${u.unit} | day=${u.day} | ${u.time} | type=${classifyShiftType(start)} | preceptor=${PRECEPTOR_MAP[u.unit]}`);
    }
    console.log('\n--- Availability records ---');
    for (const a of availabilityRows) {
      console.log(`  ${a.firstName} ${a.lastName} (${a.email}) | days=${JSON.stringify(a.available_days)} | shifts=${a.preferred_shift_type.join(',')} | notes=${a.notes || ''}`);
    }
    console.log('\n--- Shifts + Assignments ---');
    for (const s of shiftRows) {
      console.log(`  ${s.date} ${s.dayName} | ${s.unit} ${s.timeRange} | ${s.studentName} | ${s.notes || ''}`);
    }
    console.log('\nDry run complete.');
    return;
  }

  // Connect to database
  const connStr = getConnectionString();
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to database.\n');

  try {
    const students = await loadStudents(client);
    console.log(`Loaded ${students.length} students from database.\n`);

    // ─── 1. Import Templates ─────────────────────────────────────
    console.log('--- Importing ride_along_templates ---');
    const templateIds = {}; // key: "unit_day" → template id

    for (const u of UNIT_SCHEDULE) {
      const { start, end } = parseTimeRange(u.time);
      const shiftType = classifyShiftType(start);
      const preceptor = PRECEPTOR_MAP[u.unit];
      const dayNames = { 0: 'Sun', 5: 'Fri', 6: 'Sat' };
      const name = `${u.unit} ${dayNames[u.day]} ${u.time}`;

      // Upsert: check if exists first
      const existing = await client.query(
        `SELECT id FROM ride_along_templates WHERE unit_number = $1 AND day_of_week = $2`,
        [u.unit, u.day]
      );

      let templateId;
      if (existing.rows.length > 0) {
        templateId = existing.rows[0].id;
        await client.query(
          `UPDATE ride_along_templates SET name=$1, shift_type=$2, start_time=$3, end_time=$4, preceptor_name=$5, is_active=true WHERE id=$6`,
          [name, shiftType, start, end, preceptor, templateId]
        );
        console.log(`  Updated template: ${name}`);
      } else {
        const ins = await client.query(
          `INSERT INTO ride_along_templates (name, day_of_week, shift_type, start_time, end_time, max_students, unit_number, preceptor_name, is_active)
           VALUES ($1, $2, $3, $4, $5, 1, $6, $7, true) RETURNING id`,
          [name, u.day, shiftType, start, end, u.unit, preceptor]
        );
        templateId = ins.rows[0].id;
        console.log(`  Created template: ${name}`);
      }
      templateIds[`${u.unit}_${u.day}`] = templateId;
    }
    console.log(`  Total templates: ${Object.keys(templateIds).length}\n`);

    // ─── 2. Import Availability ──────────────────────────────────
    console.log('--- Importing ride_along_availability ---');
    let availImported = 0;
    let availSkipped = 0;

    for (const a of availabilityRows) {
      const student = matchStudent(students, `${a.firstName} ${a.lastName}`, a.email);
      if (!student) {
        console.warn(`  WARN: No student match for ${a.firstName} ${a.lastName} (${a.email}) — skipping`);
        availSkipped++;
        continue;
      }

      // Check for existing availability record
      const existing = await client.query(
        `SELECT id FROM ride_along_availability WHERE student_id = $1`,
        [student.id]
      );

      if (existing.rows.length > 0) {
        await client.query(
          `UPDATE ride_along_availability
           SET available_days = $1, preferred_shift_type = $2, notes = $3, updated_at = NOW()
           WHERE student_id = $4`,
          [JSON.stringify(a.available_days), a.preferred_shift_type, a.notes, student.id]
        );
        console.log(`  Updated availability: ${student.first_name} ${student.last_name}`);
      } else {
        await client.query(
          `INSERT INTO ride_along_availability (student_id, available_days, preferred_shift_type, notes)
           VALUES ($1, $2, $3, $4)`,
          [student.id, JSON.stringify(a.available_days), a.preferred_shift_type, a.notes]
        );
        console.log(`  Created availability: ${student.first_name} ${student.last_name}`);
      }
      availImported++;
    }
    console.log(`  Imported: ${availImported}, Skipped: ${availSkipped}\n`);

    // ─── 3. Import Shifts + Assignments ──────────────────────────
    console.log('--- Importing ride_along_shifts + ride_along_assignments ---');
    let shiftsCreated = 0;
    let assignmentsCreated = 0;
    let assignmentsSkipped = 0;

    // Group shift rows by date+unit to avoid duplicates
    const shiftKey = (s) => `${s.date}_${s.unit}`;
    const shiftIdMap = new Map(); // key → shift DB id

    for (const s of shiftRows) {
      const key = shiftKey(s);

      // Create shift if not already created for this date+unit
      if (!shiftIdMap.has(key)) {
        // Check if shift already exists in DB
        const existing = await client.query(
          `SELECT id FROM ride_along_shifts WHERE shift_date = $1 AND unit_number = $2`,
          [s.date, s.unit]
        );

        let shiftId;
        if (existing.rows.length > 0) {
          shiftId = existing.rows[0].id;
          console.log(`  Existing shift: ${s.date} ${s.unit}`);
        } else {
          const ins = await client.query(
            `INSERT INTO ride_along_shifts (shift_date, shift_type, start_time, end_time, unit_number, preceptor_name, status, location)
             VALUES ($1, $2, $3, $4, $5, $6, 'filled', 'LVFR')
             RETURNING id`,
            [s.date, s.shiftType, s.startTime, s.endTime, s.unit, s.preceptor]
          );
          shiftId = ins.rows[0].id;
          shiftsCreated++;
          console.log(`  Created shift: ${s.date} ${s.unit} (${s.timeRange})`);
        }
        shiftIdMap.set(key, shiftId);
      }

      const shiftId = shiftIdMap.get(key);

      // Match student and create assignment
      const student = matchStudent(students, s.studentName);
      if (!student) {
        console.warn(`  WARN: No student match for "${s.studentName}" — skipping assignment`);
        assignmentsSkipped++;
        continue;
      }

      // Check for existing assignment
      const existingAssign = await client.query(
        `SELECT id FROM ride_along_assignments WHERE shift_id = $1 AND student_id = $2`,
        [shiftId, student.id]
      );

      if (existingAssign.rows.length > 0) {
        console.log(`  Existing assignment: ${student.first_name} ${student.last_name} → ${s.date} ${s.unit}`);
      } else {
        await client.query(
          `INSERT INTO ride_along_assignments (shift_id, student_id, status, preceptor_name, notes)
           VALUES ($1, $2, 'assigned', $3, $4)`,
          [shiftId, student.id, s.preceptor, s.notes]
        );
        assignmentsCreated++;
        console.log(`  Assigned: ${student.first_name} ${student.last_name} → ${s.date} ${s.unit}`);
      }
    }
    console.log(`  Shifts created: ${shiftsCreated}`);
    console.log(`  Assignments created: ${assignmentsCreated}, Skipped: ${assignmentsSkipped}\n`);

    console.log('=== Import complete ===');
  } catch (err) {
    console.error(`\nERROR: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
