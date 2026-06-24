const fs=require('fs'),path=require('path'),{Client}=require('pg');
const envPath=path.join(__dirname,'..','.env.local');
for(const line of fs.readFileSync(envPath,'utf8').split('\n')){const t=line.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<0)continue;const k=t.slice(0,i).trim();if(!process.env[k])process.env[k]=t.slice(i+1).trim();}
const dry=process.argv.includes('--dry-run');
// Manual back-fill (Ben): mark "Recognizes symptoms due to tachycardia" = met for
// Esther Mills' CASE_67 attempt (tachy section was explicitly failed but overall
// passed). Targeted, idempotent.
(async()=>{
  const c=new Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false}});
  await c.connect();
  try{
    await c.query('BEGIN');
    const crit=(await c.query("select cr.id from adv_cert_segment_criteria cr join adv_cert_segments s on s.id=cr.segment_id where s.key='tachy_mgmt_unstable' and cr.text ilike '%symptoms due to tachycardia%'")).rows[0];
    if(!crit) throw new Error('criterion not found');
    const sr=(await c.query(`
      select sr.id, st.first_name, st.last_name, s.case_code, sr.result, a.overall_result
      from adv_cert_segment_results sr
      join adv_cert_test_attempts a on a.id=sr.attempt_id
      join adv_cert_scenario_segments sss on sss.id=sr.scenario_segment_id
      join adv_cert_segments seg on seg.id=sss.segment_id
      left join scenarios s on s.id=a.scenario_id
      join students st on st.id=a.team_lead_id
      where seg.key='tachy_mgmt_unstable' and sr.result='fail' and a.overall_result='pass'
        and st.last_name='Mills' and st.first_name='Esther'`)).rows;
    if(sr.length!==1){console.log(`⚠ expected exactly 1 target, found ${sr.length} — aborting`);await c.query('ROLLBACK');return;}
    const target=sr[0];
    console.log(`target: ${target.last_name}, ${target.first_name} — ${target.case_code} (tachy section: ${target.result}, overall: ${target.overall_result}) seg_result ${target.id}`);
    const existing=(await c.query('select met from adv_cert_criterion_results where segment_result_id=$1 and criterion_id=$2',[target.id,crit.id])).rows[0];
    if(existing){console.log(`already has a result (met=${existing.met}) — no-op`);await c.query('ROLLBACK');return;}
    await c.query('insert into adv_cert_criterion_results (segment_result_id, criterion_id, met) values ($1,$2,true)',[target.id,crit.id]);
    console.log('inserted criterion_result met=true for the tachy "recognizes symptoms" item');
    if(dry){await c.query('ROLLBACK');console.log('\n🔍 DRY RUN — rolled back.');}else{await c.query('COMMIT');console.log('\n✅ Committed.');}
  }catch(e){await c.query('ROLLBACK');console.error('❌ FAILED (rolled back):',e.message);process.exitCode=1;}
  finally{await c.end();}
})();
