#!/usr/bin/env node
// Reseed Group 14 S1 schedule with corrected templates and course-level recurring_group_id
// Usage: node scripts/reseed-group14-s1.js
//
// Prerequisites: .env.local with SUPABASE_DB_URL or NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

// ─── Load env ──────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

// ─── Supabase REST helpers ─────────────────────────────────────────────────────
async function supabaseQuery(table, { method = 'GET', params = {}, body = null, headers = {} } = {}) {
  let url = `${SUPABASE_URL}/rest/v1/${table}`;
  const qs = new URLSearchParams(params).toString();
  if (qs) url += '?' + qs;

  const opts = {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : method === 'DELETE' ? 'return=minimal' : 'return=representation',
      ...headers,
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${table}: ${res.status} ${text}`);
  }
  if (method === 'DELETE') return null;
  return res.json();
}

// ─── Date helpers ──────────────────────────────────────────────────────────────
function addDays(date, days) {
  const r = new Date(date);
  r.setDate(r.getDate() + days);
  return r;
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function findFirstOccurrence(startDate, targetDow) {
  const d = new Date(startDate);
  let daysUntil = targetDow - d.getDay();
  if (daysUntil < 0) daysUntil += 7;
  return addDays(d, daysUntil);
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Reseed Group 14 S1 ===');

  // 1. Fix template labels — rename "Pharm Lab" to "S1 Lab" for S1 templates
  console.log('\n1. Fixing template labels...');
  const templates = await supabaseQuery('pmi_course_templates', {
    params: {
      select: 'id,course_code,course_name,semester_number,day_index',
      program_type: 'eq.paramedic',
      semester_number: 'eq.1',
    },
  });

  for (const t of templates) {
    if (t.course_name && t.course_name.toLowerCase().includes('pharm lab')) {
      console.log(`  Renaming "${t.course_code} ${t.course_name}" → "S1 Lab"`);
      await supabaseQuery('pmi_course_templates', {
        method: 'PATCH',
        params: { id: `eq.${t.id}` },
        body: { course_name: 'S1 Lab' },
      });
    }
  }

  // 2. Find the PM Grp14 semester/program_schedule
  console.log('\n2. Finding PM Grp14 program schedule...');
  const schedules = await supabaseQuery('pmi_program_schedules', {
    params: {
      select: 'id,semester_id,cohort_id,label,cohort:cohorts(id,cohort_number,program:programs(id,abbreviation))',
    },
  });

  const grp14Schedule = schedules.find(s => {
    if (s.label && s.label.includes('14')) return true;
    if (s.cohort && s.cohort.cohort_number === 14) return true;
    return false;
  });

  if (!grp14Schedule) {
    console.error('Could not find Group 14 program schedule. Creating blocks without program_schedule link.');
  } else {
    console.log(`  Found: ${grp14Schedule.label || `Cohort ${grp14Schedule.cohort?.cohort_number}`} (${grp14Schedule.id})`);
  }

  // 3. Find active semester
  console.log('\n3. Finding active semester...');
  const semesters = await supabaseQuery('pmi_semesters', {
    params: {
      select: 'id,name,is_active',
      is_active: 'eq.true',
    },
  });

  const semester = semesters[0];
  if (!semester) {
    console.error('No active semester found');
    process.exit(1);
  }
  console.log(`  Active semester: ${semester.name} (${semester.id})`);

  const semesterId = grp14Schedule?.semester_id || semester.id;

  // 4. Delete existing blocks
  console.log('\n4. Deleting existing Group 14 S1 blocks...');
  if (grp14Schedule) {
    await supabaseQuery('pmi_schedule_blocks', {
      method: 'DELETE',
      params: {
        program_schedule_id: `eq.${grp14Schedule.id}`,
        semester_id: `eq.${semesterId}`,
      },
    });
    console.log('  Deleted existing blocks.');
  }

  // 5. Fetch fresh templates
  console.log('\n5. Loading S1 templates...');
  const freshTemplates = await supabaseQuery('pmi_course_templates', {
    params: {
      select: '*',
      program_type: 'eq.paramedic',
      semester_number: 'eq.1',
      order: 'sort_order,day_index,start_time',
    },
  });

  console.log(`  Found ${freshTemplates.length} templates`);

  const onGround = freshTemplates.filter(t => !t.is_online);
  const online = freshTemplates.filter(t => t.is_online);

  // 6. Generate dated blocks
  console.log('\n6. Generating dated blocks...');
  const startDate = new Date('2026-01-22T00:00:00');
  const dayMapping = { 1: 4, 2: 5 }; // Day 1 → Thursday, Day 2 → Friday

  // Build course-level recurring group IDs
  const courseGroupIds = new Map();
  for (const t of onGround) {
    const key = `${t.course_code}|${t.course_name}|${t.duration_type}`;
    if (!courseGroupIds.has(key)) courseGroupIds.set(key, randomUUID());
  }

  const blocksToInsert = [];

  for (const t of onGround) {
    const weekday = dayMapping[t.day_index];
    if (weekday === undefined) continue;

    const courseKey = `${t.course_code}|${t.course_name}|${t.duration_type}`;
    const recurringGroupId = courseGroupIds.get(courseKey);

    const firstDate = findFirstOccurrence(startDate, weekday);

    let startWeek = 1, endWeek = 15;
    if (t.duration_type === 'first_half') {
      endWeek = 8;
    } else if (t.duration_type === 'second_half') {
      startWeek = t.day_index === 1 ? 9 : 8;
    }

    let title = `${t.course_code} ${t.course_name}`;
    if (t.duration_type === 'first_half') title += ' (Wks 1-8)';
    else if (t.duration_type === 'second_half') title += ' (Wks 9-15)';

    for (let week = startWeek; week <= endWeek; week++) {
      const blockDate = addDays(firstDate, (week - 1) * 7);
      blocksToInsert.push({
        semester_id: semesterId,
        program_schedule_id: grp14Schedule?.id || null,
        day_of_week: weekday,
        date: formatDate(blockDate),
        week_number: week,
        recurring_group_id: recurringGroupId,
        start_time: t.start_time,
        end_time: t.end_time,
        block_type: t.block_type || 'lecture',
        title,
        course_name: `${t.course_code} ${t.course_name}`,
        content_notes: t.notes || null,
        color: t.color || null,
        is_recurring: true,
        sort_order: t.sort_order || 0,
      });
    }
  }

  console.log(`  Generated ${blocksToInsert.length} blocks to insert`);

  // 7. Insert in batches
  console.log('\n7. Inserting blocks...');
  let inserted = 0;
  for (let i = 0; i < blocksToInsert.length; i += 50) {
    const batch = blocksToInsert.slice(i, i + 50);
    const result = await supabaseQuery('pmi_schedule_blocks', {
      method: 'POST',
      body: batch,
    });
    inserted += result.length;
    process.stdout.write(`  Inserted ${inserted}/${blocksToInsert.length}\r`);
  }
  console.log(`\n  Total inserted: ${inserted}`);

  // 8. Verify course-level grouping
  console.log('\n8. Verifying course-level recurring_group_id...');
  const groupCheck = new Map();
  for (const b of blocksToInsert) {
    const gid = b.recurring_group_id;
    if (!groupCheck.has(gid)) groupCheck.set(gid, new Set());
    groupCheck.get(gid).add(b.day_of_week);
  }

  for (const [gid, days] of groupCheck) {
    const sample = blocksToInsert.find(b => b.recurring_group_id === gid);
    const daysArr = [...days].sort();
    const dayNames = daysArr.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]);
    console.log(`  ${sample.course_name}: ${dayNames.join(' + ')} (${blocksToInsert.filter(b => b.recurring_group_id === gid).length} blocks)`);
  }

  // 9. Summary
  console.log('\n=== Done ===');
  console.log(`Blocks inserted: ${inserted}`);
  console.log(`Course groups: ${courseGroupIds.size}`);
  console.log(`Online courses: ${online.map(t => `${t.course_code} ${t.course_name}`).join(', ') || 'none'}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
