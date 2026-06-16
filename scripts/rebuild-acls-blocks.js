#!/usr/bin/env node
/**
 * Rebuild ACLS pmi_schedule_blocks for G14 from the authoritative
 * "ACLS group 13.xlsx" Time column (our adapted clock — NOT the AHA
 * "Start times" reference). One INDEPENDENT block per lesson (split, never
 * pre-combined — see memory schedule-blocks-modular-not-combined), breaks/lunch
 * visible, informative course_name labels, lab-vs-lesson distinction.
 *
 * Scope: pmi_schedule_blocks ONLY. Lab-day stations (grading layer) untouched.
 * Backs up the existing G14 ACLS blocks before deleting; delete is scoped to
 * G14's program_schedule_id so other cohorts' same-date blocks (e.g. G5's EMT
 * Lecture) are never touched.
 *
 * Usage: node scripts/rebuild-acls-blocks.js [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const envPath = path.join(__dirname, '..', '.env.local');
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('='); if (i < 0) continue;
  const k = t.slice(0, i).trim(); if (!process.env[k]) process.env[k] = t.slice(i + 1).trim();
}

const dryRun = process.argv.includes('--dry-run');
const G14_PS = '26d1db7d-edeb-41ce-817b-f74f1b458951';
const G14 = '8577fdc3-eff6-4000-9302-1ee6e3043eeb';
const D1 = '2026-06-18', D2 = '2026-06-19';

// type: pmi block_type (lecture|lab|admin|exam|meeting|other). lab=true links to the lab_day.
const DAY1 = [
  ['08:00','08:30','admin','ACLS · Welcome & Course Administration','R. Young',false],
  ['08:30','08:45','lecture','ACLS · L1 Course Overview & Organization','R. Young',false],
  ['08:45','09:00','lecture','ACLS · Trad 2: Systems of Care','M. Schaffer',false],
  ['09:00','09:15','lecture','ACLS · Trad 3: Science of Resuscitation','M. Schaffer',false],
  ['09:15','09:30','lecture','ACLS · Trad 4: Systematic Approach','M. Schaffer',false],
  ['09:30','10:00','lecture','ACLS · Trad 5: CPR Coach','M. Schaffer',false],
  ['10:00','10:30','lab','ACLS LAB · High-Quality BLS (L6)','All instructors',true],
  ['10:30','11:00','other','ACLS · Break','',false],
  ['11:00','11:15','lecture','ACLS · L8 Technology Review (Lifepak/Zoll/Laerdal)','B. Hartnell',false],
  ['11:15','11:30','lecture','ACLS · L9 Recognition: Clinical Deterioration','J. Lomonaco',false],
  ['11:30','11:45','lab','ACLS LAB · L10 Acute Coronary Syndromes','J. Lomonaco',true],
  ['11:45','12:00','lab','ACLS LAB · L11 Acute Stroke','M. Schaffer',true],
  ['12:00','13:00','other','ACLS · Lunch','',false],
  ['13:00','13:30','lecture','ACLS · L12 High-Performance Teams','M. Schaffer',false],
  ['13:30','14:00','other','ACLS · Break','',false],
  ['14:00','16:00','lab','ACLS LAB · L13 Cardiac Arrest & Post-Arrest (Cases 34/36/39/40)','All instructors',true],
  ['16:00','16:15','lab','ACLS LAB · L14 Preventing Arrest: Bradycardia','J. Lomonaco',true],
  ['16:15','16:30','lab','ACLS LAB · L15 Preventing Arrest: Tachycardia','J. Lomonaco',true],
  ['16:30','17:00','lab','ACLS LAB · Brady & Tachy Scenario','All instructors',true],
  ['17:00','17:30','meeting','ACLS · Debrief — End of Day 1','',false],
];
// Day 2 afternoon is intentionally FLEXIBLE: lunch defaults to noon; the
// 1300-1400 block is a "Megacode Practice (if needed)" buffer the group often
// SKIPS (front-loaded prep) and goes straight to testing — so it's labeled as
// optional, not pinned. The written exam is the AHA ONLINE exam taken on
// students' own computers via the AHA site (external — our system doesn't
// administer it).
const DAY2 = [
  ['08:30','09:00','admin','ACLS · Roster & Review','',false],
  ['09:00','09:30','lab','ACLS LAB · L16 Megacode Practice — Intro & Demo','',true],
  ['09:30','10:00','other','ACLS · Break','All instructors',false],
  ['10:00','12:00','lab','ACLS LAB · L16 Megacode Practice (Cases 16/17/26/27 → 48-55)','All instructors',true],
  ['12:00','13:00','other','ACLS · Lunch','',false],
  ['13:00','14:00','lab','ACLS LAB · Extra Megacode Practice if needed — else start Testing','All instructors',true],
  ['14:00','15:00','lab','ACLS LAB · Megacode Testing (Megacode 2/4/9/10)','All instructors',true],
  ['15:00','16:00','exam','ACLS · AHA Online Written Exam (external — student computers)','',false],
  ['16:00','17:00','other','ACLS · Remediation','',false],
  ['17:00','17:30','meeting','ACLS · End of Day 2','',false],
];

function dow(d){ const [y,m,da]=d.split('-').map(Number); return new Date(Date.UTC(y,m-1,da)).getUTCDay(); }
const GENERIC = new Set(['','all instructors','other','—']);
async function resolveInstr(client, name, cache){
  if(!name) return null; const norm=name.trim().toLowerCase();
  if(GENERIC.has(norm)) return null;
  if(cache.has(norm)) return cache.get(norm);
  const parts=name.trim().replace(/\./g,'').split(/\s+/);
  const last=parts[parts.length-1], fi=(parts[0]||'').charAt(0).toLowerCase();
  const rows=(await client.query(`SELECT id,name,role FROM lab_users WHERE name ILIKE $1`,['%'+last+'%'])).rows;
  let m=rows; if(fi) m=rows.filter(r=>(r.name||'').trim().charAt(0).toLowerCase()===fi);
  if(m.length>1){ const ng=m.filter(r=>r.role!=='guest'); if(ng.length===1) m=ng; }
  const id=m.length===1?m[0].id:null; cache.set(norm,id); return id;
}

async function main(){
  const client=new Client({connectionString:process.env.SUPABASE_DB_URL||process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
  await client.connect();
  const cache=new Map();
  try{
    await client.query('BEGIN');
    const labDays={};
    for(const d of [D1,D2]){
      labDays[d]=(await client.query(`SELECT id FROM lab_days WHERE cohort_id=$1 AND date=$2`,[G14,d])).rows[0]?.id||null;
    }
    const semId={};
    for(const d of [D1,D2]){
      semId[d]=(await client.query(`SELECT id FROM pmi_semesters WHERE start_date<=$1 AND end_date>=$1 AND is_active=true ORDER BY start_date LIMIT 1`,[d])).rows[0]?.id||null;
    }
    // backup existing G14 ACLS blocks
    const existing=(await client.query(`SELECT * FROM pmi_schedule_blocks WHERE date IN($1,$2) AND program_schedule_id=$3`,[D1,D2,G14_PS])).rows;
    fs.mkdirSync(path.join(__dirname,'..','data','acls','backups'),{recursive:true});
    fs.writeFileSync(path.join(__dirname,'..','data','acls','backups','g14_acls_blocks_pre_rebuild3_20260615.json'),JSON.stringify(existing,null,2));
    console.log(`Backed up ${existing.length} existing G14 ACLS blocks.`);
    // delete them
    const del=await client.query(`DELETE FROM pmi_schedule_blocks WHERE date IN($1,$2) AND program_schedule_id=$3`,[D1,D2,G14_PS]);
    console.log(`Deleted ${del.rowCount}.`);
    // confirm other cohorts untouched
    const g5=(await client.query(`SELECT count(*) n FROM pmi_schedule_blocks WHERE date=$1 AND title='EMT Lecture'`,[D1])).rows[0].n;
    console.log(`G5 "EMT Lecture" still present: ${g5} (expect 1)`);
    // insert rebuilt
    let inserted=0;
    for(const [d,rows] of [[D1,DAY1],[D2,DAY2]]){
      let sort=0;
      for(const [s,e,type,label,instr,lab] of rows){
        sort++;
        const iid=await resolveInstr(client,instr,cache);
        await client.query(
          `INSERT INTO pmi_schedule_blocks (semester_id,program_schedule_id,start_time,end_time,block_type,title,course_name,content_notes,date,day_of_week,sort_order,instructor_id,linked_lab_day_id,status,is_recurring)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'published',false)`,
          [semId[d],G14_PS,s+':00',e+':00',type,label,label, instr?`Instructor: ${instr}`:null, d,dow(d),sort,iid, lab?labDays[d]:null]
        );
        inserted++;
      }
    }
    console.log(`Inserted ${inserted} rebuilt blocks (${DAY1.length} Day 1 + ${DAY2.length} Day 2).`);
    if(dryRun){ await client.query('ROLLBACK'); console.log('🔍 DRY RUN — rolled back.'); }
    else { await client.query('COMMIT'); console.log('✅ Committed.'); }
  }catch(e){ await client.query('ROLLBACK'); console.error('❌ FAILED (rolled back):',e.message); process.exitCode=1; }
  finally{ await client.end(); }
}
main();
