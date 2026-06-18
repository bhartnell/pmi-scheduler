#!/usr/bin/env node
/**
 * RESTORE ACS & Acute Stroke as Day-1 learning blocks (2025 full "Agenda for
 * ACLS Course" page 66 keeps them — matching group-13). They were DELETED (not
 * archived) in the 2025 block rebuild (c5f333aa). This re-inserts them after L3
 * Airway / before L4 Technology Review, keeps LUNCH a full hour, and shifts the
 * afternoon (lab DURATIONS unchanged). Brady/Tachy + Cardiac section frames are
 * re-synced to the shifted block times. Surgical (no wholesale rebuild → links
 * intact). --dry-run rolls back.
 */
const fs=require('fs'),path=require('path'),{Client}=require('pg');
const envPath=path.join(__dirname,'..','.env.local');
for(const line of fs.readFileSync(envPath,'utf8').split('\n')){const t=line.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<0)continue;const k=t.slice(0,i).trim();if(!process.env[k])process.env[k]=t.slice(i+1).trim();}
const dryRun=process.argv.includes('--dry-run');
const COHORT='8577fdc3-eff6-4000-9302-1ee6e3043eeb';
const PS='26d1db7d-edeb-41ce-817b-f74f1b458951';
const SEM='638470a7-5320-4c98-b690-1c77aae710f4';
const D1='2026-06-18';
const SEC_BRADY='2fd5347f-4acc-46c8-9a3a-0c0e0c700ef1';
const SEC_CARDIAC='657a0e7b-6921-4561-95a3-6a1b9a626192';
const dow=(d)=>{const[y,m,dd]=d.split('-').map(Number);return new Date(Date.UTC(y,m-1,dd)).getUTCDay();};

// New Day-1 times from 12:10 onward (title-matched UPDATEs unless marked INSERT).
const SHIFTS=[
  {match:'ACLS · L4 Technology Review',                              s:'12:40',e:'12:55'},
  {match:'ACLS · Lunch',                                            s:'12:55',e:'13:55'}, // full hour
  {match:'ACLS LAB · L5/6 Brady & Tachy (2 groups, swap 14:20)',    s:'13:55',e:'15:55'},
  {match:'ACLS · Break',                                            s:'15:55',e:'16:10', after:'13:00'}, // the afternoon break
  {match:'ACLS · L7 High-Performance Teams',                       s:'16:10',e:'16:40'},
  {match:'ACLS LAB · L8 Cardiac Arrest & Post-Arrest (2 groups)',  s:'16:40',e:'19:20'},
  {match:'ACLS · End of Day 1',                                    s:'19:20',e:'19:35'},
];
const INSERTS=[
  {s:'12:10',e:'12:25',t:'lecture',title:'ACLS · ACS (Acute Coronary Syndromes)'},
  {s:'12:25',e:'12:40',t:'lecture',title:'ACLS · Acute Stroke'},
];

(async()=>{
  const c=new Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false}});
  await c.connect();
  try{
    await c.query('BEGIN');
    // guard: don't double-insert
    const existing=(await c.query("select count(*)::int n from pmi_schedule_blocks psb join pmi_program_schedules pps on psb.program_schedule_id=pps.id where pps.cohort_id=$1 and psb.date=$2 and (psb.title ilike '%Acute Stroke%' or psb.title ilike '%Acute Coronary%')",[COHORT,D1])).rows[0].n;
    if(existing>0){console.log(`⚠ ${existing} ACS/Stroke block(s) already present — aborting to avoid duplicates.`);await c.query('ROLLBACK');return;}

    for(const sh of SHIFTS){
      // the afternoon Break is identified by start_time >= 13:00 to avoid the morning break
      const r=await c.query(
        `update pmi_schedule_blocks psb set start_time=$1,end_time=$2
         from pmi_program_schedules pps
         where psb.program_schedule_id=pps.id and pps.cohort_id=$3 and psb.date=$4 and psb.title=$5
           ${sh.after?'and psb.start_time>=$6':''}`,
        sh.after?[sh.s,sh.e,COHORT,D1,sh.match,sh.after]:[sh.s,sh.e,COHORT,D1,sh.match]);
      console.log(`  shift ${r.rowCount}× "${sh.match}" → ${sh.s}-${sh.e}`);
    }
    for(const ins of INSERTS){
      await c.query(
        `insert into pmi_schedule_blocks
           (semester_id,program_schedule_id,date,day_of_week,start_time,end_time,block_type,title,course_name,status,sort_order,is_recurring)
         values($1,$2,$3,$4,$5,$6,$7,$8,'ACLS','published',0,false)`,
        [SEM,PS,D1,dow(D1),ins.s,ins.e,ins.t,ins.title]);
      console.log(`  INSERT [${ins.t}] ${ins.s}-${ins.e} ${ins.title}`);
    }
    // renumber Day-1 sort_order by start_time
    await c.query(
      `with o as (select psb.id, row_number() over(order by psb.start_time,psb.end_time) rn
                  from pmi_schedule_blocks psb join pmi_program_schedules pps on psb.program_schedule_id=pps.id
                  where pps.cohort_id=$1 and psb.date=$2)
       update pmi_schedule_blocks t set sort_order=o.rn from o where t.id=o.id`,[COHORT,D1]);
    // re-sync section frames
    const f1=await c.query("update lab_days set start_time='13:55',end_time='15:55' where id=$1",[SEC_BRADY]);
    const f2=await c.query("update lab_days set start_time='16:40',end_time='19:20' where id=$1",[SEC_CARDIAC]);
    console.log(`  section frames: brady ${f1.rowCount}× → 13:55-15:55, cardiac ${f2.rowCount}× → 16:40-19:20`);

    // print final Day-1
    const final=(await c.query("select psb.start_time,psb.end_time,psb.block_type,psb.title from pmi_schedule_blocks psb join pmi_program_schedules pps on psb.program_schedule_id=pps.id where pps.cohort_id=$1 and psb.date=$2 order by psb.start_time",[COHORT,D1])).rows;
    console.log('\n=== FINAL DAY 1 ===');
    for(const b of final)console.log(`  ${String(b.start_time).slice(0,5)}-${String(b.end_time).slice(0,5)} [${b.block_type}] ${b.title}`);

    if(dryRun){await c.query('ROLLBACK');console.log('\n🔍 DRY RUN — rolled back.');}
    else{await c.query('COMMIT');console.log('\n✅ Committed.');}
  }catch(e){await c.query('ROLLBACK');console.error('❌ FAILED (rolled back):',e.message);process.exitCode=1;}
  finally{await c.end();}
})();
