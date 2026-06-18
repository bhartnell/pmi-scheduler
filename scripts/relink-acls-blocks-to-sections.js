#!/usr/bin/env node
/**
 * Re-link G14 ACLS schedule blocks from the monolithic section-1 fallback to the
 * REAL sections, and fix a stale block title. Data-only, idempotent, dry-run.
 *
 * The lab blocks were created (pre-sections) linked to section-1; that's the
 * "stale reference" — they should point at the real sections so click-through +
 * calendar dedup reflect the current structure. Non-sectioned Day-1 blocks
 * (BLS/ACS/Stroke — no dedicated section) keep their section-1 link.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('='); if (i < 0) continue;
    const k = t.slice(0, i).trim(); if (!process.env[k]) process.env[k] = t.slice(i + 1).trim();
  }
}
const dryRun = process.argv.includes('--dry-run');
const COHORT = '8577fdc3-eff6-4000-9302-1ee6e3043eeb';

async function main() {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query('BEGIN');
    // Resolve section ids per date.
    const secs = (await c.query(
      "select id, date::text, section_number, section_label from lab_days where cohort_id=$1 and cert_course='acls' and section_number>1 order by date, section_number", [COHORT]
    )).rows;
    const secOf = (date, label) => secs.find(s => s.date === date && (s.section_label || '').toLowerCase().includes(label));
    const d1cardiac = secOf('2026-06-18', 'cardiac'), d1bt = secOf('2026-06-18', 'brady');
    const d2prac = secOf('2026-06-19', 'megacode practice'), d2test = secOf('2026-06-19', 'megacode testing');

    // (date, title-keyword) -> target section. Order matters: 'testing' before 'practice'.
    const rules = [
      { date: '2026-06-18', kw: /cardiac arrest/i, sec: d1cardiac },
      { date: '2026-06-18', kw: /bradycardia|tachycardia|brady & tachy|brady\/tachy/i, sec: d1bt },
      { date: '2026-06-19', kw: /megacode testing/i, sec: d2test },
      { date: '2026-06-19', kw: /megacode practice/i, sec: d2prac },
    ];

    const blocks = (await c.query(
      "select psb.id, psb.date::text, psb.title, psb.linked_lab_day_id, psb.linked_section_number from pmi_schedule_blocks psb join pmi_program_schedules pps on psb.program_schedule_id=pps.id where pps.cohort_id=$1 and psb.date in ('2026-06-18','2026-06-19') and psb.block_type='lab' order by psb.date, psb.start_time", [COHORT]
    )).rows;

    let relinked = 0, retitled = 0, unchanged = 0;
    for (const b of blocks) {
      const rule = rules.find(r => r.date === b.date && r.kw.test(b.title || ''));
      if (rule && rule.sec) {
        if (b.linked_lab_day_id !== rule.sec.id || b.linked_section_number !== rule.sec.section_number) {
          await c.query('update pmi_schedule_blocks set linked_lab_day_id=$1, linked_section_number=$2, updated_at=now() where id=$3',
            [rule.sec.id, rule.sec.section_number, b.id]);
          console.log(`  RELINK  ${b.date} "${b.title}" → ${rule.sec.section_label} (sec${rule.sec.section_number})`);
          relinked++;
        } else { unchanged++; }
      } else {
        console.log(`  keep    ${b.date} "${b.title}" (no matching section — stays on its current link)`);
        unchanged++;
      }
    }

    // Stale title fix.
    const stale = (await c.query(
      "select psb.id, psb.title from pmi_schedule_blocks psb join pmi_program_schedules pps on psb.program_schedule_id=pps.id where pps.cohort_id=$1 and psb.date='2026-06-19' and psb.title ilike '%16/17/26/27%'", [COHORT]
    )).rows;
    for (const s of stale) {
      const nt = 'ACLS LAB · L16 Megacode Practice (Cases 48–51)';
      await c.query('update pmi_schedule_blocks set title=$1, updated_at=now() where id=$2', [nt, s.id]);
      console.log(`  RETITLE "${s.title}" → "${nt}"`);
      retitled++;
    }

    console.log(`\n--- summary --- relinked: ${relinked}, retitled: ${retitled}, unchanged: ${unchanged}`);
    if (dryRun) { await c.query('ROLLBACK'); console.log('🔍 DRY RUN — rolled back.'); }
    else { await c.query('COMMIT'); console.log('✅ Committed.'); }
  } catch (e) {
    await c.query('ROLLBACK'); console.error('❌ FAILED (rolled back):', e.message); process.exitCode = 1;
  } finally { await c.end(); }
}
main();
