const fs=require('fs'),path=require('path'),{Client}=require('pg');
const envPath=path.join(__dirname,'..','.env.local');
for(const line of fs.readFileSync(envPath,'utf8').split('\n')){const t=line.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<0)continue;const k=t.slice(0,i).trim();if(!process.env[k])process.env[k]=t.slice(i+1).trim();}
const has=(v)=>v!==null&&v!==undefined&&String(v).trim()!==''&&String(v).trim()!=='{}';
const SECS=[['Cardiac Arrest (D1 sec2)','657a0e7b-6921-4561-95a3-6a1b9a626192'],['Brady/Tachy (D1 sec3)','2fd5347f-4acc-46c8-9a3a-0c0e0c700ef1'],['Megacode Practice (D2 sec2)','aebf842d-f2e4-41b5-8cf5-264cee7ef7ac'],['Megacode Testing (D2 sec3)','85808c0a-3afe-4fde-a2a6-fc74824ac417']];
(async()=>{
  const c=new Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false}});
  await c.connect();
  console.log('=== STATION CONTENT (per section) ===');
  for(const[name,id] of SECS){
    const sts=(await c.query(`select st.station_number,s.case_code,s.is_active,s.patient_presentation,s.initial_vitals,s.history,s.instructor_notes,s.legacy_code_2020
      from lab_stations st left join scenarios s on s.id=st.scenario_id where st.lab_day_id=$1 order by st.station_number`,[id])).rows;
    console.log(`\n${name}`);
    for(const r of sts){
      const content=`pres:${has(r.patient_presentation)?'Y':'—'} vitals:${has(r.initial_vitals)?'Y':'—'} hist:${has(r.history)?'Y':'—'} instr:${has(r.instructor_notes)?'Y':'—'}`;
      const flag=!r.case_code?'  ⚠ NO SCENARIO':(r.is_active===false?'  ⚠ INACTIVE':(!has(r.patient_presentation)&&!has(r.initial_vitals)?'  ⚠ BLANK':''));
      console.log(`  #${r.station_number} ${String(r.case_code||'(none)').padEnd(16)}${r.legacy_code_2020?'(was '+r.legacy_code_2020+')':''} act=${r.is_active} | ${content}${flag}`);
    }
  }
  // dangling: scenario stations pointing to inactive/missing scenarios
  const dang=(await c.query(`select st.id,st.station_number,st.lab_day_id,st.scenario_id,s.case_code,s.is_active
     from lab_stations st left join scenarios s on s.id=st.scenario_id
     join lab_days ld on ld.id=st.lab_day_id
     where ld.cohort_id='8577fdc3-eff6-4000-9302-1ee6e3043eeb' and st.station_type='scenario'
       and (st.scenario_id is null or s.id is null or s.is_active=false)`)).rows;
  console.log(`\n=== DANGLING REFS (scenario stations w/ null/missing/inactive scenario): ${dang.length} ===`);
  for(const d of dang)console.log(`  ⚠ station ${d.station_number} lab_day ${d.lab_day_id.slice(0,8)} -> ${d.case_code||'NULL'} active=${d.is_active}`);
  // duplicate case_codes
  const dup=(await c.query(`select case_code,count(*) n from scenarios where cert_course='acls' and case_code is not null group by case_code having count(*)>1`)).rows;
  console.log(`\n=== DUPLICATE case_codes (acls): ${dup.length} ===`);
  for(const d of dup)console.log(`  ⚠ ${d.case_code} x${d.n}`);
  // orphan check: 34/36/39/40 deactivated
  const orph=(await c.query("select case_code,is_active from scenarios where case_code=any($1) and cert_course='acls' order by case_code",[['CASE_34','CASE_36','CASE_39','CASE_40']])).rows;
  console.log('\n=== Orphaned 2020 cardiac (should be inactive) ===');
  for(const o of orph)console.log(`  ${o.case_code} active=${o.is_active}`);
  await c.end();
})().catch(e=>{console.error(e.message);process.exit(1)});
