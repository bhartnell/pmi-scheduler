#!/usr/bin/env node
// Direct-to-DB execution of the seed-instructor-availability
// logic. Mirrors /api/admin/seed-instructor-availability exactly
// — same filters, same idempotency checks, same insert shapes —
// but runs against Supabase via the service-role key so we don't
// have to wait on Vercel deploys to land before the operator
// gets seeded data.
//
// Idempotent: skips templates and availability rows already
// present + covering the slot. Safe to re-run.

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

const START_DATE = '2026-05-11';
const END_DATE = '2026-08-21';
const START_TIME = '08:30:00';
const END_TIME = '17:00:00';
const WEEKDAYS = [1, 2, 3, 4, 5];
const EMAIL_EXCLUSIONS = ['kfivelstad@pmi.edu', 'lvems@pmi.edu'];
const DRY_RUN = process.argv.includes('--dry-run');

(async () => {
  const { data: instructors, error: iErr } = await supabase
    .from('lab_users')
    .select('id, name, email')
    .in('role', ['superadmin', 'admin', 'lead_instructor', 'instructor'])
    .eq('is_active', true)
    .or('is_part_time.is.null,is_part_time.eq.false')
    .not('email', 'ilike', '%gmail.com%')
    .not('email', 'in', `(${EMAIL_EXCLUSIONS.map(e => `"${e}"`).join(',')})`)
    .order('name');

  if (iErr) {
    console.error('Instructor lookup failed:', iErr.message);
    process.exit(1);
  }
  console.log(`Targets: ${instructors.length} instructors`);

  // Generate weekday dates in window
  const dates = [];
  let ms = new Date(START_DATE + 'T00:00:00Z').getTime();
  const endMs = new Date(END_DATE + 'T00:00:00Z').getTime();
  while (ms <= endMs) {
    const d = new Date(ms);
    if (WEEKDAYS.includes(d.getUTCDay())) dates.push(d.toISOString().slice(0, 10));
    ms += 86400000;
  }
  console.log(`Weekday dates in window: ${dates.length}`);

  let templateInserted = 0, templateSkipped = 0;
  let availabilityInserted = 0, availabilitySkipped = 0;
  const errors = [];

  for (const instr of instructors) {
    console.log(`\n──── ${instr.name} <${instr.email}> ────`);

    // Template idempotency
    const { data: existingTpl } = await supabase
      .from('recurring_availability_templates')
      .select('id, weekdays, start_time, end_time, start_date, end_date, is_active')
      .eq('instructor_id', instr.id);
    const matches = (existingTpl ?? []).some(t => {
      if (!t.is_active) return false;
      if (t.start_date > START_DATE || t.end_date < END_DATE) return false;
      if (t.start_time !== START_TIME || t.end_time !== END_TIME) return false;
      const wkSet = new Set(t.weekdays ?? []);
      return WEEKDAYS.every(w => wkSet.has(w));
    });
    if (matches) {
      console.log('  Template: existing match, skip');
      templateSkipped++;
    } else if (DRY_RUN) {
      console.log('  Template: would insert (dry run)');
    } else {
      const { error: tErr } = await supabase
        .from('recurring_availability_templates')
        .insert({
          instructor_id: instr.id,
          weekdays: WEEKDAYS,
          start_time: START_TIME,
          end_time: END_TIME,
          is_all_day: false,
          frequency: 'weekly',
          start_date: START_DATE,
          end_date: END_DATE,
          notes: 'Seeded full-time default availability',
          is_active: true,
        });
      if (tErr) {
        errors.push(`${instr.name}: template insert — ${tErr.message}`);
        console.log('  Template insert FAILED:', tErr.message);
      } else {
        templateInserted++;
        console.log('  Template inserted ✓');
      }
    }

    // Availability idempotency
    const { data: existingAvail } = await supabase
      .from('instructor_availability')
      .select('date, start_time, end_time, is_all_day')
      .eq('instructor_id', instr.id)
      .gte('date', START_DATE)
      .lte('date', END_DATE);
    const covered = new Set();
    for (const a of existingAvail ?? []) {
      if (a.is_all_day) { covered.add(a.date); continue; }
      if (a.start_time && a.end_time && a.start_time <= START_TIME && a.end_time >= END_TIME) {
        covered.add(a.date);
      }
    }

    const rowsToInsert = dates
      .filter(d => !covered.has(d))
      .map(d => ({
        instructor_id: instr.id,
        date: d,
        start_time: START_TIME,
        end_time: END_TIME,
        is_all_day: false,
        notes: 'Seeded full-time default availability',
      }));
    availabilitySkipped += dates.length - rowsToInsert.length;
    console.log(`  Availability: ${rowsToInsert.length} to insert, ${dates.length - rowsToInsert.length} already covered`);

    if (DRY_RUN || rowsToInsert.length === 0) continue;

    for (let i = 0; i < rowsToInsert.length; i += 100) {
      const batch = rowsToInsert.slice(i, i + 100);
      const { error: aErr } = await supabase
        .from('instructor_availability')
        .insert(batch);
      if (aErr) {
        errors.push(`${instr.name}: availability batch insert — ${aErr.message}`);
        console.log(`    batch ${i / 100 + 1} FAILED:`, aErr.message);
      } else {
        availabilityInserted += batch.length;
        console.log(`    batch ${i / 100 + 1} inserted ${batch.length} rows`);
      }
    }
  }

  console.log('\n──── SUMMARY ────');
  console.log(`Templates: inserted=${templateInserted}, skipped=${templateSkipped}`);
  console.log(`Availability: inserted=${availabilityInserted}, skipped=${availabilitySkipped}`);
  console.log(`Errors: ${errors.length}`);
  for (const e of errors) console.log('  ', e);

  // Final verify
  const { data: finalCheck } = await supabase
    .from('lab_users')
    .select('email')
    .in('role', ['superadmin', 'admin', 'lead_instructor', 'instructor'])
    .eq('is_active', true)
    .or('is_part_time.is.null,is_part_time.eq.false')
    .not('email', 'ilike', '%gmail.com%')
    .not('email', 'in', `(${EMAIL_EXCLUSIONS.map(e => `"${e}"`).join(',')})`);

  console.log('\n──── PER-INSTRUCTOR FINAL COUNTS ────');
  for (const u of finalCheck ?? []) {
    const { count: aCount } = await supabase
      .from('instructor_availability')
      .select('*', { count: 'exact', head: true })
      .eq('instructor_id', (await supabase.from('lab_users').select('id').eq('email', u.email).single()).data.id)
      .gte('date', START_DATE)
      .lte('date', END_DATE);
    console.log(`  ${u.email}: ${aCount} rows in window`);
  }
})();
