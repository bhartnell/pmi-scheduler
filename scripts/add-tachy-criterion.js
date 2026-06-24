const fs=require('fs'),path=require('path'),{Client}=require('pg');
const envPath=path.join(__dirname,'..','.env.local');
for(const line of fs.readFileSync(envPath,'utf8').split('\n')){const t=line.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<0)continue;const k=t.slice(0,i).trim();if(!process.env[k])process.env[k]=t.slice(i+1).trim();}
const dry=process.argv.includes('--dry-run');
const NEW='Recognizes symptoms due to tachycardia';
(async()=>{
  const c=new Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false}});
  await c.connect();
  try{
    await c.query('BEGIN');
    const seg=(await c.query("select id from adv_cert_segments where key='tachy_mgmt_unstable' and cert_course='acls'")).rows[0];
    if(!seg) throw new Error('tachy_mgmt_unstable not found');
    const crit=(await c.query('select id,text,display_order from adv_cert_segment_criteria where segment_id=$1 and active order by display_order',[seg.id])).rows;
    console.log('current tachy_mgmt_unstable criteria:'); for(const x of crit) console.log(`   ${x.display_order}. ${x.text}`);
    if(crit.some(x=>x.text.toLowerCase().includes('symptoms due to tachycardia'))){console.log('\n✓ already present — no-op'); await c.query('ROLLBACK'); return;}
    // Insert NEW at display_order 4 (before cardioversion). Shift display_order >=4 up by 1.
    const shifted=await c.query('update adv_cert_segment_criteria set display_order=display_order+1 where segment_id=$1 and display_order>=4',[seg.id]);
    const ins=await c.query("insert into adv_cert_segment_criteria (segment_id,text,display_order,is_critical,active) values ($1,$2,4,false,true) returning id",[seg.id,NEW]);
    console.log(`\nshifted ${shifted.rowCount} criterion(s) +1; inserted "${NEW}" at display_order 4 (${ins.rows[0].id})`);
    const after=(await c.query('select text,display_order from adv_cert_segment_criteria where segment_id=$1 and active order by display_order',[seg.id])).rows;
    console.log('after:'); for(const x of after) console.log(`   ${x.display_order}. ${x.text}`);
    if(dry){await c.query('ROLLBACK');console.log('\n🔍 DRY RUN — rolled back.');}else{await c.query('COMMIT');console.log('\n✅ Committed.');}
  }catch(e){await c.query('ROLLBACK');console.error('❌ FAILED (rolled back):',e.message);process.exitCode=1;}
  finally{await c.end();}
})();
