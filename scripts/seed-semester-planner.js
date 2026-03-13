#!/usr/bin/env node
/**
 * Seed script for the Semester Scheduling Planner
 * Inserts rooms, semesters, and program schedules from JSON seed data.
 *
 * Usage: node scripts/seed-semester-planner.js
 *
 * Requires SUPABASE_DB_URL in .env.local or environment
 */

const fs = require('fs');
const path = require('path');

// Load environment
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.replace(/\r\n/g, '\n').split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
}

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function seed() {
  const seedData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data', 'scheduling', 'semester_planner_seed.json'), 'utf8')
  );

  console.log('🌱 Seeding Semester Scheduling Planner...\n');

  // 1. Rooms
  console.log('📦 Inserting rooms...');
  for (const room of seedData.rooms) {
    const { data, error } = await supabase
      .from('pmi_rooms')
      .upsert(room, { onConflict: 'name' })
      .select()
      .single();

    if (error) {
      console.error(`  ✗ ${room.name}: ${error.message}`);
    } else {
      console.log(`  ✓ ${data.name} (${data.room_type}, capacity: ${data.capacity ?? 'flexible'})`);
    }
  }

  // 2. Semesters
  console.log('\n📅 Inserting semesters...');
  const semesterMap = {};
  for (const sem of seedData.semesters) {
    const { data, error } = await supabase
      .from('pmi_semesters')
      .upsert(sem, { onConflict: 'name' })
      .select()
      .single();

    if (error) {
      console.error(`  ✗ ${sem.name}: ${error.message}`);
    } else {
      semesterMap[sem.name] = data.id;
      console.log(`  ✓ ${data.name} (${data.start_date} → ${data.end_date})`);
    }
  }

  // 3. Program Schedules — need to look up cohorts
  console.log('\n🎓 Inserting program schedules...');
  const semesterId = semesterMap['Spring 2026'];
  if (!semesterId) {
    console.error('  ✗ Could not find Spring 2026 semester ID');
    return;
  }

  for (const ps of seedData.program_schedules) {
    // Look up program
    const { data: program } = await supabase
      .from('programs')
      .select('id')
      .eq('name', ps.program_name)
      .single();

    if (!program) {
      console.error(`  ✗ Program "${ps.program_name}" not found — skipping ${ps.label}`);
      continue;
    }

    // Look up or create cohort
    let cohortId;
    const { data: existingCohort } = await supabase
      .from('cohorts')
      .select('id')
      .eq('program_id', program.id)
      .eq('cohort_number', ps.cohort_number)
      .single();

    if (existingCohort) {
      cohortId = existingCohort.id;
    } else {
      // Create the cohort
      const { data: newCohort, error: cohortErr } = await supabase
        .from('cohorts')
        .insert({
          program_id: program.id,
          cohort_number: ps.cohort_number,
          is_active: true,
        })
        .select()
        .single();

      if (cohortErr) {
        console.error(`  ✗ Failed to create cohort ${ps.cohort_number}: ${cohortErr.message}`);
        continue;
      }
      cohortId = newCohort.id;
      console.log(`  📝 Created cohort #${ps.cohort_number} for ${ps.program_name}`);
    }

    // Insert program schedule
    const { data: schedule, error: schedErr } = await supabase
      .from('pmi_program_schedules')
      .upsert({
        semester_id: semesterId,
        cohort_id: cohortId,
        class_days: ps.class_days,
        color: ps.color,
        label: ps.label,
        notes: ps.notes,
      }, { onConflict: 'semester_id,cohort_id' })
      .select()
      .single();

    if (schedErr) {
      console.error(`  ✗ ${ps.label}: ${schedErr.message}`);
    } else {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const days = ps.class_days.map(d => dayNames[d]).join('/');
      console.log(`  ✓ ${schedule.label} — ${days} (${ps.color})`);
    }
  }

  // Verify
  console.log('\n📊 Verification:');
  const { count: roomCount } = await supabase.from('pmi_rooms').select('*', { count: 'exact', head: true });
  const { count: semCount } = await supabase.from('pmi_semesters').select('*', { count: 'exact', head: true });
  const { count: psCount } = await supabase.from('pmi_program_schedules').select('*', { count: 'exact', head: true });
  console.log(`  Rooms: ${roomCount}`);
  console.log(`  Semesters: ${semCount}`);
  console.log(`  Program Schedules: ${psCount}`);

  console.log('\n✅ Seed complete!');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
