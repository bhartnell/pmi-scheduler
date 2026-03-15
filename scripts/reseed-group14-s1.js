#!/usr/bin/env node
// Re-seed Group 14 S1 schedule with FIXED:
// 1. Course-level recurring_group_id (same course shares ONE ID across all days)
// 2. Lab label: "S1 Lab" instead of "Pharm Lab"
// 3. Proper half-semester transition

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const eq = line.indexOf('=');
  if (eq > 0 && !line.startsWith('#')) {
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

async function reseed() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 1. Fix lab label in course templates
  console.log('=== Step 1: Fix lab template labels ===');
  const { data: labTemplates } = await supabase
    .from('pmi_course_templates')
    .select('id, course_code, course_name, block_type')
    .eq('program_type', 'paramedic')
    .eq('semester_number', 1)
    .eq('block_type', 'lab');

  if (labTemplates && labTemplates.length > 0) {
    for (const lt of labTemplates) {
      const oldName = lt.course_name;
      // Fix any lab named "Pharm Lab" or generic "Lab" to "S1 Lab"
      if (oldName && (oldName.includes('Pharm') || oldName === 'Lab' || oldName.includes('EMS 211'))) {
        const { error } = await supabase
          .from('pmi_course_templates')
          .update({ course_name: 'S1 Lab' })
          .eq('id', lt.id);
        if (error) {
          console.log('  Warning updating template:', error.message);
        } else {
          console.log('  Fixed:', lt.course_code, oldName, '->', 'S1 Lab');
        }
      } else {
        console.log('  OK:', lt.course_code, oldName, '(no change needed)');
      }
    }
  } else {
    console.log('  No lab templates found for paramedic S1');
  }

  // 2. Find active semester
  console.log('\n=== Step 2: Find semester & cohort ===');
  const { data: semesters } = await supabase
    .from('pmi_semesters')
    .select('id, name')
    .eq('is_active', true)
    .limit(1);

  const semester = semesters && semesters[0];
  if (!semester) { console.log('No active semester'); return; }
  console.log('Semester:', semester.name, semester.id);

  // 3. Find Group 14 program schedule
  const { data: cohorts } = await supabase
    .from('cohorts')
    .select('id, cohort_number')
    .gte('cohort_number', 14)
    .lt('cohort_number', 15)
    .limit(1);

  if (!cohorts || cohorts.length === 0) { console.log('No Group 14 cohort'); return; }
  const cohortId = cohorts[0].id;
  console.log('Cohort:', cohorts[0].cohort_number, cohortId);

  const { data: ps } = await supabase
    .from('pmi_program_schedules')
    .select('id')
    .eq('cohort_id', cohortId)
    .eq('semester_id', semester.id)
    .limit(1);

  if (!ps || ps.length === 0) { console.log('No program schedule for Group 14'); return; }
  const psId = ps[0].id;
  console.log('Program schedule:', psId);

  // 4. Delete ALL existing blocks for this program schedule
  console.log('\n=== Step 3: Delete existing blocks ===');
  const { data: existing, error: countErr } = await supabase
    .from('pmi_schedule_blocks')
    .select('id', { count: 'exact' })
    .eq('program_schedule_id', psId);

  console.log('Existing blocks to delete:', existing ? existing.length : 0);

  if (existing && existing.length > 0) {
    const { error: delErr } = await supabase
      .from('pmi_schedule_blocks')
      .delete()
      .eq('program_schedule_id', psId);
    if (delErr) { console.error('Delete error:', delErr.message); return; }
    console.log('Deleted successfully');
  }

  // 5. Re-fetch templates (with fixed labels)
  console.log('\n=== Step 4: Fetch updated templates ===');
  const { data: templates, error: tplErr } = await supabase
    .from('pmi_course_templates')
    .select('*')
    .eq('program_type', 'paramedic')
    .eq('semester_number', 1)
    .order('sort_order')
    .order('day_index')
    .order('start_time');

  if (tplErr) { console.error('Template error:', tplErr); return; }
  console.log('Templates:', templates.length);
  templates.forEach(t => console.log('  ', t.course_code, t.course_name, 'Day', t.day_index, t.start_time + '-' + t.end_time, t.duration_type || 'full'));

  // 6. Generate blocks with COURSE-LEVEL recurring_group_id
  console.log('\n=== Step 5: Generate with course-level grouping ===');
  const dayMap = { 1: 4, 2: 5 }; // Day 1 = Thursday, Day 2 = Friday
  const startDate = new Date('2026-01-22T00:00:00');

  function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
  function fmt(d) { return d.toISOString().split('T')[0]; }
  function findFirst(start, dow) { const d = new Date(start); let diff = dow - d.getDay(); if (diff < 0) diff += 7; return addDays(d, diff); }

  const onGround = templates.filter(t => !t.is_online);
  const online = templates.filter(t => t.is_online);

  // KEY FIX: Build course-level group IDs BEFORE the loop
  // Same course across different days shares ONE recurring_group_id
  const courseGroupIds = new Map();
  for (const t of onGround) {
    const courseKey = [t.course_code, t.course_name, t.duration_type || 'full'].join('|');
    if (!courseGroupIds.has(courseKey)) {
      courseGroupIds.set(courseKey, crypto.randomUUID());
    }
  }

  console.log('\nCourse groups (shared recurring_group_id):');
  for (const [key, id] of courseGroupIds) {
    const matchingTemplates = onGround.filter(t => [t.course_code, t.course_name, t.duration_type || 'full'].join('|') === key);
    const days = matchingTemplates.map(t => 'Day' + t.day_index).join(', ');
    console.log('  ', key, '->', id.slice(0, 8) + '...', '(' + days + ')');
  }

  const blocks = [];
  for (const t of onGround) {
    const wd = dayMap[t.day_index];
    if (wd === undefined) continue;

    const courseKey = [t.course_code, t.course_name, t.duration_type || 'full'].join('|');
    const groupId = courseGroupIds.get(courseKey); // SHARED across days!

    const firstDate = findFirst(startDate, wd);

    let startWeek = 1, endWeek = 15;
    if (t.duration_type === 'first_half') { startWeek = 1; endWeek = 8; }
    else if (t.duration_type === 'second_half') {
      startWeek = t.day_index === 1 ? 9 : 8;
      endWeek = 15;
    }

    let title = t.course_code + ' ' + t.course_name;
    if (t.duration_type === 'first_half') title += ' (Wks 1-8)';
    else if (t.duration_type === 'second_half') title += ' (Wks 9-15)';

    for (let w = startWeek; w <= endWeek; w++) {
      const blockDate = addDays(firstDate, (w - 1) * 7);
      blocks.push({
        semester_id: semester.id,
        program_schedule_id: psId,
        day_of_week: wd,
        date: fmt(blockDate),
        week_number: w,
        recurring_group_id: groupId,
        start_time: t.start_time,
        end_time: t.end_time,
        block_type: t.block_type || 'lecture',
        title,
        course_name: t.course_code + ' ' + t.course_name,
        content_notes: t.notes || null,
        color: t.color || null,
        is_recurring: true,
        sort_order: t.sort_order || 0,
      });
    }
  }

  console.log('\nTotal blocks to insert:', blocks.length);

  // 7. Insert in batches
  for (let i = 0; i < blocks.length; i += 50) {
    const batch = blocks.slice(i, i + 50);
    const { error } = await supabase.from('pmi_schedule_blocks').insert(batch);
    if (error) { console.error('Insert error at', i, ':', error.message); return; }
  }

  // 8. Verify course-level grouping
  console.log('\n=== Step 6: Verify grouping ===');
  const { data: allBlocks } = await supabase
    .from('pmi_schedule_blocks')
    .select('recurring_group_id, course_name, day_of_week, date')
    .eq('program_schedule_id', psId)
    .not('date', 'is', null)
    .order('recurring_group_id')
    .order('date');

  if (allBlocks) {
    // Group by recurring_group_id
    const groups = {};
    for (const b of allBlocks) {
      const gid = b.recurring_group_id || 'none';
      if (!groups[gid]) groups[gid] = { course: b.course_name, days: new Set(), count: 0 };
      groups[gid].days.add(b.day_of_week);
      groups[gid].count++;
    }

    console.log('\nRecurring groups:');
    for (const [gid, info] of Object.entries(groups)) {
      const dayNames = { 4: 'Thu', 5: 'Fri' };
      const days = [...info.days].map(d => dayNames[d] || d).join('+');
      console.log('  ', gid.slice(0, 8) + '...', info.course, '|', days, '|', info.count, 'blocks');
    }

    // Check: Does EMS 141 share one group across Thu + Fri?
    const ems141Groups = Object.entries(groups).filter(([, info]) => info.course && info.course.includes('141'));
    if (ems141Groups.length > 0) {
      for (const [gid, info] of ems141Groups) {
        if (info.days.size >= 2) {
          console.log('\n  OK: EMS 141 shares one group across', info.days.size, 'days,', info.count, 'blocks total');
        } else {
          console.log('\n  WARNING: EMS 141 only on', info.days.size, 'day(s) in group', gid.slice(0, 8));
        }
      }
    }
  }

  console.log('\nTotal:', allBlocks ? allBlocks.length : 0, 'blocks inserted');

  // Show first few
  const { data: first } = await supabase
    .from('pmi_schedule_blocks')
    .select('date, week_number, course_name, start_time, end_time, day_of_week')
    .eq('program_schedule_id', psId)
    .not('date', 'is', null)
    .order('date')
    .order('start_time')
    .limit(10);

  if (first) {
    console.log('\nFirst 10 blocks:');
    const dayNames = { 4: 'Thu', 5: 'Fri' };
    first.forEach(b => console.log('  ', b.date, 'W' + b.week_number, dayNames[b.day_of_week] || b.day_of_week, b.course_name, b.start_time + '-' + b.end_time));
  }
}

reseed().catch(console.error);
