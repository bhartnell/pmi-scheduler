const fs=require('fs'),path=require('path'),{Client}=require('pg');
const envPath=path.join(__dirname,'..','.env.local');
for(const line of fs.readFileSync(envPath,'utf8').split('\n')){const t=line.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<0)continue;const k=t.slice(0,i).trim();if(!process.env[k])process.env[k]=t.slice(i+1).trim();}
const FUTURE={CASE_48:'CASE_67',CASE_49:'CASE_68',CASE_50:'CASE_69',CASE_51:'CASE_70',CASE_52:'CASE_71',CASE_53:'CASE_72',CASE_54:'CASE_73',CASE_55:'CASE_74'};
(async()=>{
  const c=new Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false}});
  await c.connect();
  const scen=(await c.query(
    "select id,case_code,title,cert_tier from scenarios where cert_course='acls' and cert_tier in ('megacode_testing','megacode_practice') order by cert_tier desc, case_code"
  )).rows;
  // assembly fingerprint to detect shared/identical rubrics
  const fp={};
  const report=async(s)=>{
    const segs=(await c.query(
      `select sss.sequence_order, seg.id seg_id, seg.key, seg.name, seg.algorithm_type, seg.always_present,
              (select count(*) from adv_cert_segment_criteria cr where cr.segment_id=seg.id and cr.active) ncrit
       from adv_cert_scenario_segments sss join adv_cert_segments seg on seg.id=sss.segment_id
       where sss.scenario_id=$1 order by sss.sequence_order`,[s.id])).rows;
    const future=FUTURE[s.case_code]?` (→ ${FUTURE[s.case_code]})`:'';
    console.log(`\n■ ${s.case_code}${future}  [${s.cert_tier}]`);
    console.log(`  title/rhythms: ${s.title}`);
    if(!segs.length){console.log('  ⚠⚠ NO RUBRIC SEGMENTS ASSEMBLED (missing)');return;}
    const seq=segs.map(x=>`${x.sequence_order}.${x.key}${x.always_present?'*':''}(${x.ncrit}c)`).join('  ');
    console.log(`  rubric segments (${segs.length}): ${seq}`);
    for(const x of segs)console.log(`      ${x.sequence_order}. [${x.algorithm_type||'—'}] ${x.name}  — ${x.ncrit} criteria${x.always_present?'  *always-present':''}`);
    // fingerprint = ordered seg keys (to detect identical assemblies)
    const key=segs.map(x=>x.key).join('>');
    (fp[key]=fp[key]||[]).push(s.case_code);
    return key;
  };
  console.log('================ MEGACODE TESTING (priority — scored tomorrow) ================');
  for(const s of scen.filter(x=>x.cert_tier==='megacode_testing'))await report(s);
  console.log('\n\n================ MEGACODE PRACTICE (currently 48-55; → 67-74 after renumber) ================');
  for(const s of scen.filter(x=>x.cert_tier==='megacode_practice'))await report(s);
  console.log('\n\n================ SHARED-RUBRIC CHECK (identical segment sequences) ================');
  let anyShared=false;
  for(const[k,codes] of Object.entries(fp)){
    if(codes.length>1){anyShared=true;console.log(`  ⚠ SHARED assembly across ${codes.join(', ')}\n      seq: ${k}`);}
  }
  if(!anyShared)console.log('  ✓ every scenario has a UNIQUE segment sequence (no two identical)');
  await c.end();
})().catch(e=>{console.error(e.message);process.exit(1)});
