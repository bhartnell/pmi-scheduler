const fs=require('fs'),path=require('path'),{Client}=require('pg');
const envPath=path.join(__dirname,'..','.env.local');
for(const line of fs.readFileSync(envPath,'utf8').split('\n')){const t=line.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<0)continue;const k=t.slice(0,i).trim();if(!process.env[k])process.env[k]=t.slice(i+1).trim();}
const dry=process.argv.includes('--dry-run');
// Back-fill "Recognizes symptoms due to tachycardia" = MET for students who passed the
// tachy section, where the item was added to the rubric AFTER they were graded.
// Passed = section not explicitly failed AND overall megacode passed (null section
// result is an IT-side gap → benefit of the doubt, per Ben). Excludes explicit fails.
(async()=>{
  const c=new Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false}});
  await c.connect();
  try{
    await c.query('BEGIN');
    const crit=(await c.query("select cr.id from adv_cert_segment_criteria cr join adv_cert_segments s on s.id=cr.segment_id where s.key='tachy_mgmt_unstable' and cr.text ilike '%symptoms due to tachycardia%'")).rows[0];
    if(!crit) throw new Error('new tachy criterion not found');
    // eligible segment_results: tachy_mgmt_unstable, overall pass, section not 'fail', no existing result for the new criterion
    const elig=(await c.query(`
      select sr.id, sr.result seg_result, a.overall_result
      from adv_cert_segment_results sr
      join adv_cert_test_attempts a on a.id=sr.attempt_id
      join adv_cert_scenario_segments sss on sss.id=sr.scenario_segment_id
      join adv_cert_segments seg on seg.id=sss.segment_id
      where seg.key='tachy_mgmt_unstable'
        and a.overall_result='pass'
        and coalesce(sr.result,'') <> 'fail'
        and not exists (select 1 from adv_cert_criterion_results x where x.segment_result_id=sr.id and x.criterion_id=$1)`,[crit.id])).rows;
    const explicit=elig.filter(r=>r.seg_result==='pass').length, implicit=elig.filter(r=>!r.seg_result).length;
    console.log(`eligible passers: ${elig.length} (${explicit} explicit section-pass + ${implicit} null-but-overall-pass)`);
    let n=0;
    for(const r of elig){ await c.query('insert into adv_cert_criterion_results (segment_result_id, criterion_id, met) values ($1,$2,true)',[r.id,crit.id]); n++; }
    console.log(`inserted ${n} back-fill criterion_result(s) met=true`);
    // report excluded fails
    const fails=(await c.query(`select count(*)::int n from adv_cert_segment_results sr join adv_cert_scenario_segments sss on sss.id=sr.scenario_segment_id join adv_cert_segments seg on seg.id=sss.segment_id where seg.key='tachy_mgmt_unstable' and sr.result='fail'`)).rows[0].n;
    console.log(`excluded (explicit section fail, NOT back-filled): ${fails}`);
    if(dry){await c.query('ROLLBACK');console.log('\n🔍 DRY RUN — rolled back.');}else{await c.query('COMMIT');console.log('\n✅ Committed.');}
  }catch(e){await c.query('ROLLBACK');console.error('❌ FAILED (rolled back):',e.message);process.exitCode=1;}
  finally{await c.end();}
})();
