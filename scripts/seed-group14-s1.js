#!/usr/bin/env node
// Seed Group 14 S1 schedule with dated blocks starting Jan 22, 2026 on Thu/Fri

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

async function seed() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Find active semester
  const { data: semesters } = await supabase
    .from('pmi_semesters')
    .select('id, name')
    .eq('is_active', true)
    .limit(1);

  const semester = semesters && semesters[0];
  if (!semester) {
    console.log('No active semester found');
    return;
  }
  console.log('Semester:', semester.name, semester.id);

  // Find Group 14 cohort
  const { data: cohorts } = await supabase
    .from('cohorts')
    .select('id, cohort_number')
    .gte('cohort_number', 14)
    .lt('cohort_number', 15)
    .limit(1);

  if (!cohorts || cohorts.length === 0) {
    console.log('No Group 14 cohort found');
    return;
  }
  const cohortId = cohorts[0].id;
  console.log('Cohort:', cohorts[0].cohort_number, cohortId);

  // Find or create program schedule
  let { data: ps } = await supabase
    .from('pmi_program_schedules')
    .select('id')
    .eq('cohort_id', cohortId)
    .eq('semester_id', semester.id)
    .eq('is_active', true)
    .limit(1);

  let psId;
  if (!ps || ps.length === 0) {
    const { data: newPs, error } = await supabase
      .from('pmi_program_schedules')
      .insert({
        semester_id: semester.id,
        cohort_id: cohortId,
        class_days: [4, 5],
        color: '#3B82F6',
        label: 'PM Grp14',
      })
      .select('id')
      .single();
    if (error) { console.error('Error creating prog schedule:', error); return; }
    psId = newPs.id;
    console.log('Created program schedule:', psId);
  } else {
    psId = ps[0].id;
    console.log('Existing program schedule:', psId);
  }

  // Clear existing dated blocks
  const { error: delErr } = await supabase
    .from('pmi_schedule_blocks')
    .delete()
    .eq('program_schedule_id', psId)
    .not('date', 'is', null);
  if (delErr) console.log('Clear warning:', delErr.message);

  // Fetch Paramedic S1 templates
  const { data: templates, error: tplErr } = await supabase
    .from('pmi_course_templates')
    .select('*')
    .eq('program_type', 'paramedic')
    .eq('semester_number', 1)
    .order('sort_order')
    .order('day_index')
    .order('start_time');

  if (tplErr) { console.error('Template error:', tplErr); return; }
  console.log('Templates found:', templates.length);

  // Day mapping: Day 1 = Thursday (4), Day 2 = Friday (5)
  const dayMap = { 1: 4, 2: 5 };
  const startDate = new Date('2026-01-22T00:00:00');

  function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }

  function formatDate(d) {
    return d.toISOString().split('T')[0];
  }

  function findFirstOccurrence(start, targetDow) {
    const d = new Date(start);
    let diff = targetDow - d.getDay();
    if (diff < 0) diff += 7;
    return addDays(d, diff);
  }

  const onGround = templates.filter(t => !t.is_online);
  const online = templates.filter(t => t.is_online);
  const blocks = [];

  // Build course-level recurring_group_id (same course across all days shares one ID)
  const courseGroupIds = {};
  for (const t of onGround) {
    const courseKey = `${t.course_code}|${t.course_name}|${t.duration_type}`;
    if (!courseGroupIds[courseKey]) {
      courseGroupIds[courseKey] = crypto.randomUUID();
    }
  }

  for (const t of onGround) {
    const wd = dayMap[t.day_index];
    if (wd === undefined) continue;

    const courseKey = `${t.course_code}|${t.course_name}|${t.duration_type}`;
    const groupId = courseGroupIds[courseKey];
    const firstDate = findFirstOccurrence(startDate, wd);

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
        date: formatDate(blockDate),
        week_number: w,
        recurring_group_id: groupId,
        start_time: t.start_time,
        end_time: t.end_time,
        block_type: t.block_type || 'lecture',
        title: title,
        course_name: t.course_code + ' ' + t.course_name,
        content_notes: t.notes || null,
        color: t.color || null,
        is_recurring: true,
        sort_order: t.sort_order || 0,
      });
    }
  }

  console.log('\nInserting', blocks.length, 'dated blocks...');

  // Insert in batches
  for (let i = 0; i < blocks.length; i += 50) {
    const batch = blocks.slice(i, i + 50);
    const { error } = await supabase.from('pmi_schedule_blocks').insert(batch);
    if (error) {
      console.error('Insert error at batch', i, ':', error.message);
      return;
    }
  }

  // Verify
  const { count } = await supabase
    .from('pmi_schedule_blocks')
    .select('*', { count: 'exact', head: true })
    .eq('program_schedule_id', psId)
    .not('date', 'is', null);

  console.log('\nSUCCESS! Total dated blocks:', count);

  // Show first 8
  const { data: first } = await supabase
    .from('pmi_schedule_blocks')
    .select('date, week_number, course_name, start_time, end_time')
    .eq('program_schedule_id', psId)
    .not('date', 'is', null)
    .order('date')
    .order('start_time')
    .limit(8);

  console.log('\nFirst 8 blocks:');
  if (first) {
    first.forEach(b => console.log(' ', b.date, 'W' + b.week_number, b.course_name, b.start_time + '-' + b.end_time));
  }

  // Show last 4
  const { data: last } = await supabase
    .from('pmi_schedule_blocks')
    .select('date, week_number, course_name, start_time, end_time')
    .eq('program_schedule_id', psId)
    .not('date', 'is', null)
    .order('date', { ascending: false })
    .order('start_time', { ascending: false })
    .limit(4);

  console.log('\nLast 4 blocks:');
  if (last) {
    last.reverse().forEach(b => console.log(' ', b.date, 'W' + b.week_number, b.course_name, b.start_time + '-' + b.end_time));
  }

  // Show online courses
  if (online.length > 0) {
    console.log('\nOnline courses (sidebar):');
    online.forEach(t => console.log(' ', t.course_code, t.course_name));
  }

  // Verify recurring_group_id sharing: each course should have exactly ONE group ID
  const { data: groupCheck } = await supabase
    .from('pmi_schedule_blocks')
    .select('recurring_group_id, course_name')
    .eq('program_schedule_id', psId)
    .not('date', 'is', null);

  if (groupCheck) {
    const courseToGroups = {};
    groupCheck.forEach(b => {
      if (!courseToGroups[b.course_name]) courseToGroups[b.course_name] = new Set();
      courseToGroups[b.course_name].add(b.recurring_group_id);
    });
    console.log('\nRecurring group IDs per course:');
    for (const [course, groups] of Object.entries(courseToGroups)) {
      const groupSet = groups;
      console.log(`  ${course}: ${groupSet.size} group(s) ${groupSet.size === 1 ? '✓' : '✗ BUG!'}`);
    }
  }

  // Count by week
  const { data: weekCounts } = await supabase
    .from('pmi_schedule_blocks')
    .select('week_number')
    .eq('program_schedule_id', psId)
    .not('date', 'is', null);

  if (weekCounts) {
    const weeks = {};
    weekCounts.forEach(b => { weeks[b.week_number] = (weeks[b.week_number] || 0) + 1; });
    console.log('\nBlocks per week:');
    Object.keys(weeks).sort((a, b) => a - b).forEach(w => {
      console.log('  Week', w + ':', weeks[w], 'blocks');
    });
  }
}

seed().catch(console.error);
